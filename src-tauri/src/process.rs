use std::collections::VecDeque;

use serde::Serialize;
use ts_rs::TS;

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
}
