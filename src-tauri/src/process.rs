use std::collections::VecDeque;
use std::path::Path;
use std::process::Stdio;
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use ts_rs::TS;

use crate::error::{AppError, AppResult};

pub const LOG_CAP: usize = 5000;

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub enum LogStream {
    Stdout,
    Stderr,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct LogLine {
    pub seq: u64,
    pub stream: LogStream,
    pub text: String,
}

/// Bounded buffer of recent log lines.
#[derive(Default)]
pub struct LogBuffer {
    lines: VecDeque<LogLine>,
    next_seq: u64,
}

impl LogBuffer {
    pub fn push(&mut self, stream: LogStream, text: String) -> LogLine {
        let line = LogLine { seq: self.next_seq, stream, text };
        self.next_seq += 1;
        self.lines.push_back(line.clone());
        while self.lines.len() > LOG_CAP {
            self.lines.pop_front();
        }
        line
    }

    pub fn snapshot(&self) -> Vec<LogLine> {
        self.lines.iter().cloned().collect()
    }

    pub fn clear(&mut self) {
        self.lines.clear();
    }
}

/// Callback invoked for every captured log line.
pub type LineSink = Arc<dyn Fn(LogLine) + Send + Sync>;
/// Callback invoked once when the child exits, with the exit code (if any).
pub type ExitSink = Arc<dyn Fn(Option<i32>) + Send + Sync>;

pub struct ProcessManager {
    child: Option<Child>,
    pub buffer: Arc<Mutex<LogBuffer>>,
    started_at: Option<std::time::Instant>,
}

impl Default for ProcessManager {
    fn default() -> Self {
        Self { child: None, buffer: Arc::new(Mutex::new(LogBuffer::default())), started_at: None }
    }
}

impl ProcessManager {
    pub fn is_running(&self) -> bool {
        self.child.is_some()
    }

    /// Spawn `binary` with working dir `cwd` and the given env vars.
    /// Each captured line is pushed to the buffer and forwarded to `on_line`.
    pub fn start(
        &mut self,
        binary: &Path,
        cwd: &Path,
        envs: &[(String, String)],
        on_line: LineSink,
        on_exit: ExitSink,
    ) -> AppResult<()> {
        if self.is_running() {
            return Err(AppError::Other("already running".into()));
        }

        let mut cmd = Command::new(binary);
        cmd.current_dir(cwd)
            .envs(envs.iter().cloned())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);

        // CREATE_NO_WINDOW: don't pop up a console window for the child on
        // Windows. tokio's Command exposes this as an inherent method.
        #[cfg(windows)]
        cmd.creation_flags(0x0800_0000);

        let mut child = cmd.spawn()?;
        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();

        let buffer = self.buffer.clone();
        spawn_reader(stdout, LogStream::Stdout, buffer.clone(), on_line.clone());
        spawn_reader(stderr, LogStream::Stderr, buffer, on_line);

        self.child = Some(child);
        self.started_at = Some(std::time::Instant::now());

        // Exit reporting in P1 is handled lazily by `poll_exit` (called from the
        // get_status command). The `on_exit` sink is wired through for a future
        // dedicated waiter task; silence the unused-var warning for now.
        let _ = on_exit;
        Ok(())
    }

    pub fn uptime_secs(&self) -> Option<u64> {
        self.started_at.map(|t| t.elapsed().as_secs())
    }

    /// Non-blocking check: if the child has exited, take it and return its code.
    pub fn poll_exit(&mut self) -> Option<Option<i32>> {
        if let Some(child) = self.child.as_mut() {
            match child.try_wait() {
                Ok(Some(status)) => {
                    self.child = None;
                    self.started_at = None;
                    Some(status.code())
                }
                _ => None,
            }
        } else {
            None
        }
    }

    pub async fn stop(&mut self) -> AppResult<()> {
        if let Some(mut child) = self.child.take() {
            self.started_at = None;
            let _ = child.start_kill();
            let _ = child.wait().await;
            Ok(())
        } else {
            Err(AppError::NotRunning)
        }
    }

    /// Synchronously signal the child to terminate without awaiting reaping.
    /// Used during app shutdown, where the Tauri event loop is tearing down and
    /// we can't run async code (and `kill_on_drop` won't fire because managed
    /// state isn't dropped on exit). The orphaned child is reaped by the OS once
    /// the GUI process exits.
    pub fn kill_sync(&mut self) {
        if let Some(mut child) = self.child.take() {
            self.started_at = None;
            let _ = child.start_kill();
        }
    }
}

fn spawn_reader<R>(reader: R, stream: LogStream, buffer: Arc<Mutex<LogBuffer>>, on_line: LineSink)
where
    R: tokio::io::AsyncRead + Unpin + Send + 'static,
{
    tokio::spawn(async move {
        let mut lines = BufReader::new(reader).lines();
        while let Ok(Some(text)) = lines.next_line().await {
            let line = {
                let mut buf = buffer.lock().unwrap();
                buf.push(stream.clone(), text)
            };
            on_line(line);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn assigns_increasing_seq() {
        let mut b = LogBuffer::default();
        let a = b.push(LogStream::Stdout, "a".into());
        let c = b.push(LogStream::Stderr, "b".into());
        assert_eq!(a.seq, 0);
        assert_eq!(c.seq, 1);
    }

    #[test]
    fn caps_at_log_cap() {
        let mut b = LogBuffer::default();
        for i in 0..(LOG_CAP + 10) {
            b.push(LogStream::Stdout, format!("line {i}"));
        }
        let snap = b.snapshot();
        assert_eq!(snap.len(), LOG_CAP);
        assert_eq!(snap.first().unwrap().seq, 10);
    }

    #[cfg(unix)]
    use std::sync::Mutex as StdMutex;

    #[cfg(unix)]
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn captures_lines_from_child() {
        let dir = tempfile::tempdir().unwrap();
        let script = dir.path().join("fake_noalbs.sh");
        std::fs::write(&script, "#!/bin/sh\necho hello\necho world\n").unwrap();
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o755)).unwrap();
        }

        let captured: Arc<StdMutex<Vec<String>>> = Arc::new(StdMutex::new(Vec::new()));
        let cap2 = captured.clone();
        let on_line: LineSink = Arc::new(move |l: LogLine| {
            cap2.lock().unwrap().push(l.text);
        });
        let on_exit: ExitSink = Arc::new(|_| {});

        let mut pm = ProcessManager::default();
        pm.start(&script, dir.path(), &[], on_line, on_exit).unwrap();

        // Wait deterministically until both lines are captured (or time out),
        // rather than relying on a fixed sleep that flakes under load.
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
        loop {
            if captured.lock().unwrap().len() >= 2 {
                break;
            }
            if std::time::Instant::now() >= deadline {
                panic!("timed out waiting for captured lines: {:?}", captured.lock().unwrap());
            }
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }

        let lines = captured.lock().unwrap().clone();
        assert!(lines.contains(&"hello".to_string()), "got: {lines:?}");
        assert!(lines.contains(&"world".to_string()), "got: {lines:?}");
        assert_eq!(pm.buffer.lock().unwrap().snapshot().len(), 2);
    }
}
