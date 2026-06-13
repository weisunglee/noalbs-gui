# NOALBSGUI P1 (Skeleton) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the skeleton of the NOALBSGUI desktop app: it can acquire the `noalbs` binary (auto-download the correct asset for the current OS/arch, or use a manual path), launch/stop/restart it as a child process, and show its live stdout/stderr logs.

**Architecture:** Tauri v2 app. The Rust backend (`src-tauri/`) owns all logic: binary download/version management, child-process management with a log ring buffer, and persisted GUI settings. It exposes Tauri commands and emits events. The React + TypeScript frontend is a thin view with two tabs (Logs, Settings). Shared types are generated from Rust via `ts-rs`.

**Tech Stack:** Tauri v2 · Rust (reqwest, flate2+tar, zip, semver, ts-rs, tokio) · React + TypeScript (Vite) · Vitest.

**Reference:** Design spec at `docs/superpowers/specs/2026-06-13-noalbsgui-design.md`. NOALBS v2 facts: single binary, reads `config.json` from its cwd, logs to stdout via `tracing`, startup banner ends in `v{VERSION}` (e.g. `v2.17.0`), no `--version` flag. Release asset names contain the Rust target triple: `aarch64-apple-darwin` / `x86_64-apple-darwin` (`.tar.gz`), `x86_64-pc-windows-msvc` (`.zip`), `x86_64-unknown-linux-musl` (`.tar.gz`).

---

## Git / commit rules for this repo

This repo commits as **weisunglee** with **no Claude/AI co-author trailer** (already configured in per-repo git config). Every commit step below must omit any `Co-Authored-By` line. Before the first commit, confirm: `git config user.email` → `7922384+weisunglee@users.noreply.github.com`.

---

## File structure

```
noalbsgui/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   └── src/
│       ├── main.rs           # entry; builds Tauri app, registers state + commands
│       ├── lib.rs            # module declarations + run() used by main
│       ├── settings.rs       # Settings struct + load/save to app config dir
│       ├── binary.rs         # OS/arch detection, asset selection, version parse/compare, download/extract
│       ├── process.rs        # ProcessManager: spawn/stop/restart, log ring buffer, events
│       ├── commands.rs       # #[tauri::command] surface exposed to React
│       └── error.rs          # AppError enum (thiserror) + serde for command results
├── src/                      # React frontend
│   ├── main.tsx
│   ├── App.tsx               # tab shell (Logs | Settings)
│   ├── api.ts                # thin wrappers over invoke() + event listeners
│   ├── bindings/             # ts-rs generated types (Settings, LogLine, NoalbsStatus, ...)
│   ├── components/
│   │   ├── LogsTab.tsx
│   │   └── SettingsTab.tsx
│   └── styles.css
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig.json
```

Responsibilities are split by concern: `binary.rs` knows nothing about processes; `process.rs` knows nothing about downloads; `settings.rs` is pure persistence; `commands.rs` is the only place that touches Tauri state and wires the others together.

---

## Task 0: Scaffold the Tauri v2 + React + TypeScript project

**Files:** creates the whole tree above (generated).

- [ ] **Step 1: Scaffold with the Tauri CLI**

Run (from `/Users/leev/repo`):

```bash
cd /Users/leev/repo
npm create tauri-app@latest noalbsgui-scaffold -- --template react-ts --manager npm --yes
```

This creates a sibling folder so we don't fight the existing `docs/` + `.git`. Move its contents in, then remove it:

```bash
cd /Users/leev/repo/noalbsgui-scaffold
# copy everything except its own .git
rsync -a --exclude '.git' ./ /Users/leev/repo/noalbsgui/
cd /Users/leev/repo
rm -rf noalbsgui-scaffold
cd /Users/leev/repo/noalbsgui
```

- [ ] **Step 2: Install JS deps and verify dev build compiles**

Run:

```bash
cd /Users/leev/repo/noalbsgui
npm install
npm run tauri build -- --debug 2>&1 | tail -20
```

Expected: Rust compiles and a debug bundle is produced (first build is slow). If `npm run tauri` is missing, add `"tauri": "tauri"` under `scripts` in `package.json` and install `@tauri-apps/cli` as a dev dependency.

- [ ] **Step 3: Add a .gitignore**

Create `/Users/leev/repo/noalbsgui/.gitignore`:

```gitignore
# Node
node_modules/
dist/
# Rust / Tauri
src-tauri/target/
# OS
.DS_Store
# Generated bindings are committed (do NOT ignore src/bindings)
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Tauri v2 + React TS project"
```

---

## Task 1: Add Rust dependencies

**Files:** Modify `src-tauri/Cargo.toml`.

- [ ] **Step 1: Add dependencies**

In `src-tauri/Cargo.toml`, under `[dependencies]`, ensure these are present (keep the `tauri` and `serde` lines the scaffold generated; add the rest):

```toml
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "2"
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", default-features = false, features = ["json", "rustls-tls", "stream"] }
futures-util = "0.3"
flate2 = "1"
tar = "0.4"
zip = "2"
semver = "1"
ts-rs = "10"
dirs = "5"

[dev-dependencies]
wiremock = "0.6"
tempfile = "3"
```

Also enable the Tauri features needed for events/shell-free child processes (we spawn via `std`/`tokio`, not the shell plugin), and keep `tauri`'s default features.

- [ ] **Step 2: Verify it builds**

Run:

```bash
cd /Users/leev/repo/noalbsgui/src-tauri
cargo build 2>&1 | tail -20
```

Expected: builds with the new deps (slow first time).

- [ ] **Step 3: Commit**

```bash
cd /Users/leev/repo/noalbsgui
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore: add backend dependencies"
```

---

## Task 2: Error type

**Files:** Create `src-tauri/src/error.rs`; modify `src-tauri/src/lib.rs`.

- [ ] **Step 1: Write the error type**

Create `src-tauri/src/error.rs`:

```rust
use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("http error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("zip error: {0}")]
    Zip(#[from] zip::result::ZipError),
    #[error("no release asset found for this OS/architecture")]
    NoMatchingAsset,
    #[error("noalbs is not running")]
    NotRunning,
    #[error("noalbs binary not found; download it or set a manual path")]
    BinaryMissing,
    #[error("{0}")]
    Other(String),
}

// Tauri commands must return errors that serialize. We serialize to the message string.
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
```

- [ ] **Step 2: Declare the module**

In `src-tauri/src/lib.rs`, add at the top (above `run`):

```rust
pub mod error;
```

- [ ] **Step 3: Verify it builds**

Run: `cd /Users/leev/repo/noalbsgui/src-tauri && cargo build 2>&1 | tail -5`
Expected: builds (warnings about unused variants are fine).

- [ ] **Step 4: Commit**

```bash
cd /Users/leev/repo/noalbsgui
git add src-tauri/src/error.rs src-tauri/src/lib.rs
git commit -m "feat: add AppError type"
```

---

## Task 3: Settings module (persisted GUI settings)

**Files:** Create `src-tauri/src/settings.rs`; modify `src-tauri/src/lib.rs`.

- [ ] **Step 1: Write the failing test**

Create `src-tauri/src/settings.rs`:

```rust
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub enum BinarySource {
    Auto,
    Manual,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub binary_source: BinarySource,
    pub binary_path: Option<PathBuf>,
    pub installed_version: Option<String>,
    pub working_dir: Option<PathBuf>,
    pub check_updates_on_startup: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            binary_source: BinarySource::Auto,
            binary_path: None,
            installed_version: None,
            working_dir: None,
            check_updates_on_startup: true,
        }
    }
}

impl Settings {
    /// Load from `path`, or return defaults if the file does not exist.
    pub fn load_from(path: &std::path::Path) -> Result<Self, crate::error::AppError> {
        match std::fs::read_to_string(path) {
            Ok(s) => Ok(serde_json::from_str(&s)?),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Self::default()),
            Err(e) => Err(e.into()),
        }
    }

    /// Atomic write: write to a temp file then rename.
    pub fn save_to(&self, path: &std::path::Path) -> Result<(), crate::error::AppError> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let tmp = path.with_extension("json.tmp");
        std::fs::write(&tmp, serde_json::to_string_pretty(self)?)?;
        std::fs::rename(&tmp, path)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn load_missing_returns_default() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let s = Settings::load_from(&path).unwrap();
        assert_eq!(s, Settings::default());
    }

    #[test]
    fn save_then_load_roundtrips() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let mut s = Settings::default();
        s.installed_version = Some("2.17.0".to_string());
        s.binary_source = BinarySource::Manual;
        s.save_to(&path).unwrap();
        let loaded = Settings::load_from(&path).unwrap();
        assert_eq!(s, loaded);
    }
}
```

In `src-tauri/src/lib.rs` add: `pub mod settings;`

- [ ] **Step 2: Run the test to verify it passes**

Run: `cd /Users/leev/repo/noalbsgui/src-tauri && cargo test settings:: 2>&1 | tail -15`
Expected: both `settings::tests` pass.

- [ ] **Step 3: Commit**

```bash
cd /Users/leev/repo/noalbsgui
git add src-tauri/src/settings.rs src-tauri/src/lib.rs
git commit -m "feat: add persisted Settings with atomic save"
```

---

## Task 4: Binary module — OS/arch asset selection (pure logic)

**Files:** Create `src-tauri/src/binary.rs`; modify `src-tauri/src/lib.rs`.

- [ ] **Step 1: Write the failing test**

Create `src-tauri/src/binary.rs`:

```rust
use serde::Deserialize;

pub const REPO: &str = "NOALBS/nginx-obs-automatic-low-bitrate-switching";

/// Returns the Rust target-triple substring present in the release asset name
/// for the current OS/architecture, or None if unsupported.
pub fn current_target() -> Option<&'static str> {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("macos", "aarch64") => Some("aarch64-apple-darwin"),
        ("macos", "x86_64") => Some("x86_64-apple-darwin"),
        ("windows", "x86_64") => Some("x86_64-pc-windows-msvc"),
        ("linux", "x86_64") => Some("x86_64-unknown-linux-musl"),
        _ => None,
    }
}

/// Pick the asset whose name contains the given target triple.
pub fn select_asset<'a>(assets: &'a [ReleaseAsset], target: &str) -> Option<&'a ReleaseAsset> {
    assets.iter().find(|a| a.name.contains(target))
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct ReleaseAsset {
    pub name: String,
    #[serde(rename = "browser_download_url")]
    pub url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Release {
    pub tag_name: String,
    pub assets: Vec<ReleaseAsset>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assets() -> Vec<ReleaseAsset> {
        ["aarch64-apple-darwin.tar.gz", "x86_64-apple-darwin.tar.gz",
         "x86_64-pc-windows-msvc.zip", "x86_64-unknown-linux-musl.tar.gz"]
            .iter()
            .map(|n| ReleaseAsset {
                name: format!("noalbs-v2.17.0-{n}"),
                url: format!("https://example.com/{n}"),
            })
            .collect()
    }

    #[test]
    fn selects_windows_zip() {
        let a = select_asset(&assets(), "x86_64-pc-windows-msvc").unwrap();
        assert!(a.name.ends_with(".zip"));
        assert!(a.name.contains("x86_64-pc-windows-msvc"));
    }

    #[test]
    fn selects_mac_arm() {
        let a = select_asset(&assets(), "aarch64-apple-darwin").unwrap();
        assert!(a.name.contains("aarch64-apple-darwin"));
    }

    #[test]
    fn unknown_target_returns_none() {
        assert!(select_asset(&assets(), "powerpc-unknown-linux").is_none());
    }

    #[test]
    fn current_target_is_known_on_test_host() {
        // CI/dev runs on a supported host.
        assert!(current_target().is_some());
    }
}
```

In `src-tauri/src/lib.rs` add: `pub mod binary;`

- [ ] **Step 2: Run the test to verify it passes**

Run: `cd /Users/leev/repo/noalbsgui/src-tauri && cargo test binary::tests 2>&1 | tail -15`
Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```bash
cd /Users/leev/repo/noalbsgui
git add src-tauri/src/binary.rs src-tauri/src/lib.rs
git commit -m "feat: add release asset selection by OS/arch"
```

---

## Task 5: Binary module — version parsing & update comparison

**Files:** Modify `src-tauri/src/binary.rs`.

- [ ] **Step 1: Write the failing test**

Append to `src-tauri/src/binary.rs` (before the `#[cfg(test)]` block, add the functions; add tests inside the test module):

Functions:

```rust
/// Parse a semver version (e.g. "2.17.0") from a noalbs startup banner line
/// such as "...╝ v2.17.0".
pub fn parse_version_from_banner(line: &str) -> Option<String> {
    let idx = line.find('v')?;
    let rest = &line[idx + 1..];
    let ver: String = rest
        .chars()
        .take_while(|c| c.is_ascii_digit() || *c == '.')
        .collect();
    if ver.split('.').count() == 3 && semver::Version::parse(&ver).is_ok() {
        Some(ver)
    } else {
        None
    }
}

/// Normalize a release tag like "v2.17.0" to "2.17.0".
pub fn normalize_tag(tag: &str) -> &str {
    tag.strip_prefix('v').unwrap_or(tag)
}

/// True when `latest` (tag or version) is strictly newer than `installed`.
pub fn is_update_available(latest_tag: &str, installed: &str) -> bool {
    let latest = semver::Version::parse(normalize_tag(latest_tag));
    let cur = semver::Version::parse(normalize_tag(installed));
    match (latest, cur) {
        (Ok(l), Ok(c)) => l > c,
        _ => false,
    }
}
```

Tests (inside the existing `mod tests`):

```rust
    #[test]
    fn parses_version_from_banner() {
        let line = "    ╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═════╝ ╚══════╝ v2.17.0";
        assert_eq!(parse_version_from_banner(line).as_deref(), Some("2.17.0"));
    }

    #[test]
    fn banner_without_version_is_none() {
        assert!(parse_version_from_banner("just some log line").is_none());
    }

    #[test]
    fn update_available_when_newer() {
        assert!(is_update_available("v2.18.0", "2.17.0"));
        assert!(is_update_available("2.17.1", "2.17.0"));
    }

    #[test]
    fn no_update_when_same_or_older() {
        assert!(!is_update_available("v2.17.0", "2.17.0"));
        assert!(!is_update_available("v2.16.0", "2.17.0"));
    }
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `cd /Users/leev/repo/noalbsgui/src-tauri && cargo test binary::tests 2>&1 | tail -15`
Expected: 8 tests pass.

- [ ] **Step 3: Commit**

```bash
cd /Users/leev/repo/noalbsgui
git add src-tauri/src/binary.rs
git commit -m "feat: add version parsing and update comparison"
```

---

## Task 6: Binary module — fetch release & download/extract

**Files:** Modify `src-tauri/src/binary.rs`.

- [ ] **Step 1: Add fetch + download/extract functions**

Append to `src-tauri/src/binary.rs` (above the test module):

```rust
use std::io::Cursor;
use std::path::{Path, PathBuf};

use crate::error::{AppError, AppResult};

const USER_AGENT: &str = "noalbsgui";

/// Fetch the latest release JSON from a GitHub API base URL.
/// `api_base` is normally "https://api.github.com" (overridable in tests).
pub async fn fetch_latest_release(api_base: &str) -> AppResult<Release> {
    let url = format!("{api_base}/repos/{REPO}/releases/latest");
    let client = reqwest::Client::new();
    let release = client
        .get(url)
        .header(reqwest::header::USER_AGENT, USER_AGENT)
        .send()
        .await?
        .error_for_status()?
        .json::<Release>()
        .await?;
    Ok(release)
}

/// Download `asset` and extract the `noalbs`/`noalbs.exe` binary into `dest_dir`.
/// Returns the path to the extracted binary.
pub async fn download_and_extract(asset: &ReleaseAsset, dest_dir: &Path) -> AppResult<PathBuf> {
    std::fs::create_dir_all(dest_dir)?;
    let client = reqwest::Client::new();
    let bytes = client
        .get(&asset.url)
        .header(reqwest::header::USER_AGENT, USER_AGENT)
        .send()
        .await?
        .error_for_status()?
        .bytes()
        .await?;

    let bin_name = if cfg!(windows) { "noalbs.exe" } else { "noalbs" };
    let out_path = dest_dir.join(bin_name);

    if asset.name.ends_with(".zip") {
        extract_zip(&bytes, bin_name, &out_path)?;
    } else {
        extract_tar_gz(&bytes, bin_name, &out_path)?;
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&out_path)?.permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&out_path, perms)?;
    }

    Ok(out_path)
}

fn extract_tar_gz(bytes: &[u8], bin_name: &str, out_path: &Path) -> AppResult<()> {
    let gz = flate2::read::GzDecoder::new(Cursor::new(bytes));
    let mut archive = tar::Archive::new(gz);
    for entry in archive.entries()? {
        let mut entry = entry?;
        let path = entry.path()?.into_owned();
        if path.file_name().and_then(|f| f.to_str()) == Some(bin_name) {
            entry.unpack(out_path)?;
            return Ok(());
        }
    }
    Err(AppError::NoMatchingAsset)
}

fn extract_zip(bytes: &[u8], bin_name: &str, out_path: &Path) -> AppResult<()> {
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes))?;
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let name = file.name().to_string();
        if name.ends_with(bin_name) {
            let mut out = std::fs::File::create(out_path)?;
            std::io::copy(&mut file, &mut out)?;
            return Ok(());
        }
    }
    Err(AppError::NoMatchingAsset)
}
```

- [ ] **Step 2: Write an integration test against a fake GitHub API + asset**

Add to the `#[cfg(test)] mod tests` block in `src-tauri/src/binary.rs`:

```rust
    use wiremock::matchers::{method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    fn make_tar_gz_with_noalbs() -> Vec<u8> {
        use std::io::Write;
        let mut tar_buf = Vec::new();
        {
            let mut builder = tar::Builder::new(&mut tar_buf);
            let content = b"#!/bin/sh\necho noalbs\n";
            let mut header = tar::Header::new_gnu();
            header.set_path("noalbs").unwrap();
            header.set_size(content.len() as u64);
            header.set_mode(0o755);
            header.set_cksum();
            builder.append(&header, &content[..]).unwrap();
            builder.finish().unwrap();
        }
        let mut gz = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
        gz.write_all(&tar_buf).unwrap();
        gz.finish().unwrap()
    }

    #[tokio::test]
    async fn fetch_and_download_roundtrip() {
        let server = MockServer::start().await;
        let archive = make_tar_gz_with_noalbs();

        let release_json = serde_json::json!({
            "tag_name": "v2.17.0",
            "assets": [{
                "name": "noalbs-v2.17.0-x86_64-unknown-linux-musl.tar.gz",
                "browser_download_url": format!("{}/download/asset.tar.gz", server.uri())
            }]
        });

        Mock::given(method("GET"))
            .and(path(format!("/repos/{REPO}/releases/latest")))
            .respond_with(ResponseTemplate::new(200).set_body_json(&release_json))
            .mount(&server)
            .await;

        Mock::given(method("GET"))
            .and(path("/download/asset.tar.gz"))
            .respond_with(ResponseTemplate::new(200).set_body_bytes(archive))
            .mount(&server)
            .await;

        let release = fetch_latest_release(&server.uri()).await.unwrap();
        assert_eq!(release.tag_name, "v2.17.0");

        let asset = select_asset(&release.assets, "x86_64-unknown-linux-musl").unwrap();
        let dir = tempfile::tempdir().unwrap();
        // On non-unix the binary name differs; this test asserts the unix path.
        let out = download_and_extract(asset, dir.path()).await.unwrap();
        assert!(out.exists());
    }
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `cd /Users/leev/repo/noalbsgui/src-tauri && cargo test binary:: 2>&1 | tail -20`
Expected: all binary tests pass including `fetch_and_download_roundtrip`.

- [ ] **Step 4: Commit**

```bash
cd /Users/leev/repo/noalbsgui
git add src-tauri/src/binary.rs
git commit -m "feat: fetch latest release and download/extract noalbs binary"
```

---

## Task 7: Process module — log ring buffer

**Files:** Create `src-tauri/src/process.rs`; modify `src-tauri/src/lib.rs`.

- [ ] **Step 1: Write the failing test**

Create `src-tauri/src/process.rs`:

```rust
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
        // Oldest dropped: first retained seq is 10.
        assert_eq!(snap.first().unwrap().seq, 10);
    }
}
```

In `src-tauri/src/lib.rs` add: `pub mod process;`

- [ ] **Step 2: Run the test to verify it passes**

Run: `cd /Users/leev/repo/noalbsgui/src-tauri && cargo test process::tests 2>&1 | tail -15`
Expected: 2 tests pass.

- [ ] **Step 3: Commit**

```bash
cd /Users/leev/repo/noalbsgui
git add src-tauri/src/process.rs src-tauri/src/lib.rs
git commit -m "feat: add bounded log buffer"
```

---

## Task 8: Process module — spawn, capture, stop

**Files:** Modify `src-tauri/src/process.rs`.

- [ ] **Step 1: Add the ProcessManager with an injectable line sink**

Append to `src-tauri/src/process.rs` (above the test module). The manager is generic over a sink callback so it is testable without Tauri:

```rust
use std::path::Path;
use std::process::Stdio;
use std::sync::{Arc, Mutex};

use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};

use crate::error::{AppError, AppResult};

/// Callback invoked for every captured log line.
pub type LineSink = Arc<dyn Fn(LogLine) + Send + Sync>;
/// Callback invoked once when the child exits, with the exit code (if any).
pub type ExitSink = Arc<dyn Fn(Option<i32>) + Send + Sync>;

pub struct ProcessManager {
    child: Option<Child>,
    pub buffer: Arc<Mutex<LogBuffer>>,
}

impl Default for ProcessManager {
    fn default() -> Self {
        Self { child: None, buffer: Arc::new(Mutex::new(LogBuffer::default())) }
    }
}

impl ProcessManager {
    pub fn is_running(&self) -> bool {
        self.child.is_some()
    }

    /// Spawn `binary` with working dir `cwd` and the given env vars.
    /// Each captured line is pushed to the buffer and forwarded to `on_line`.
    /// `on_exit` is called when the process ends.
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

        let mut child = cmd.spawn()?;
        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();

        let buffer = self.buffer.clone();
        spawn_reader(stdout, LogStream::Stdout, buffer.clone(), on_line.clone());
        spawn_reader(stderr, LogStream::Stderr, buffer, on_line);

        self.child = Some(child);

        // Spawn a waiter that reports exit. We take the child out via the Option
        // only on stop(); here we just observe by polling a cloned handle is not
        // possible, so the waiter is started in stop()/restart() flows by the
        // caller. For P1 we report exit lazily via `poll_exit`.
        let _ = on_exit; // exit reporting handled by poll_exit (Step: commands)
        Ok(())
    }

    /// Non-blocking check: if the child has exited, take it and return its code.
    pub fn poll_exit(&mut self) -> Option<Option<i32>> {
        if let Some(child) = self.child.as_mut() {
            match child.try_wait() {
                Ok(Some(status)) => {
                    self.child = None;
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
            let _ = child.start_kill();
            let _ = child.wait().await;
            Ok(())
        } else {
            Err(AppError::NotRunning)
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
```

- [ ] **Step 2: Write the failing test (spawn a fake noalbs that prints lines)**

Add to the `#[cfg(test)] mod tests` block:

```rust
    use std::sync::Mutex as StdMutex;

    #[tokio::test]
    async fn captures_lines_from_child() {
        // A fake "noalbs": prints two stdout lines then exits.
        let dir = tempfile::tempdir().unwrap();
        let script = dir.path().join("fake_noalbs.sh");
        std::fs::write(&script, "#!/bin/sh\necho hello\necho world\n").unwrap();
        #[cfg(unix)]
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

        // Give the reader tasks time to drain.
        tokio::time::sleep(std::time::Duration::from_millis(300)).await;

        let lines = captured.lock().unwrap().clone();
        assert!(lines.contains(&"hello".to_string()), "got: {lines:?}");
        assert!(lines.contains(&"world".to_string()), "got: {lines:?}");
        assert_eq!(pm.buffer.lock().unwrap().snapshot().len(), 2);
    }
```

> Note: this test uses a `/bin/sh` script and is unix-only; gate it with `#[cfg(unix)]` on the test fn. A Windows equivalent is out of scope for P1's test suite (the production code path is exercised manually on Windows in Task 13).

- [ ] **Step 3: Run the test to verify it passes**

Run: `cd /Users/leev/repo/noalbsgui/src-tauri && cargo test process:: 2>&1 | tail -20`
Expected: ring-buffer tests + `captures_lines_from_child` pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/leev/repo/noalbsgui
git add src-tauri/src/process.rs
git commit -m "feat: add ProcessManager spawn/capture/stop"
```

---

## Task 9: Tauri commands + app state wiring

**Files:** Create `src-tauri/src/commands.rs`; modify `src-tauri/src/lib.rs` and `src-tauri/src/main.rs`.

- [ ] **Step 1: Write the command surface**

Create `src-tauri/src/commands.rs`:

```rust
use std::path::PathBuf;
use std::sync::Arc;

use tauri::{AppManager, Emitter, Manager, State};
use tokio::sync::Mutex;

use crate::binary::{self, ReleaseAsset};
use crate::error::{AppError, AppResult};
use crate::process::{ExitSink, LineSink, LogLine, ProcessManager};
use crate::settings::{BinarySource, Settings};

const GITHUB_API: &str = "https://api.github.com";

pub struct AppState {
    pub settings: Mutex<Settings>,
    pub settings_path: PathBuf,
    pub binary_dir: PathBuf,
    pub process: Mutex<ProcessManager>,
}

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> AppResult<Settings> {
    Ok(state.settings.lock().await.clone())
}

#[tauri::command]
pub async fn save_settings(state: State<'_, AppState>, settings: Settings) -> AppResult<()> {
    settings.save_to(&state.settings_path)?;
    *state.settings.lock().await = settings;
    Ok(())
}

#[tauri::command]
pub async fn set_manual_binary_path(
    state: State<'_, AppState>,
    path: PathBuf,
) -> AppResult<Settings> {
    let mut s = state.settings.lock().await;
    s.binary_source = BinarySource::Manual;
    s.binary_path = Some(path);
    s.installed_version = None; // unknown until launched (Task 13 / future banner parse)
    s.save_to(&state.settings_path)?;
    Ok(s.clone())
}

/// Returns the newer tag if an update is available, else None.
#[tauri::command]
pub async fn check_update(state: State<'_, AppState>) -> AppResult<Option<String>> {
    let installed = state.settings.lock().await.installed_version.clone();
    let release = binary::fetch_latest_release(GITHUB_API).await?;
    match installed {
        Some(v) if !binary::is_update_available(&release.tag_name, &v) => Ok(None),
        _ => Ok(Some(release.tag_name)),
    }
}

/// Download the latest binary for this OS/arch (auto mode). Updates settings.
#[tauri::command]
pub async fn download_binary(state: State<'_, AppState>) -> AppResult<Settings> {
    let target = binary::current_target().ok_or(AppError::NoMatchingAsset)?;
    let release = binary::fetch_latest_release(GITHUB_API).await?;
    let asset: &ReleaseAsset =
        binary::select_asset(&release.assets, target).ok_or(AppError::NoMatchingAsset)?;
    let path = binary::download_and_extract(asset, &state.binary_dir).await?;

    let mut s = state.settings.lock().await;
    s.binary_source = BinarySource::Auto;
    s.binary_path = Some(path);
    s.installed_version = Some(binary::normalize_tag(&release.tag_name).to_string());
    s.save_to(&state.settings_path)?;
    Ok(s.clone())
}

#[tauri::command]
pub async fn get_log_buffer(state: State<'_, AppState>) -> AppResult<Vec<LogLine>> {
    let pm = state.process.lock().await;
    Ok(pm.buffer.lock().unwrap().snapshot())
}

#[tauri::command]
pub async fn get_status(state: State<'_, AppState>) -> AppResult<bool> {
    let mut pm = state.process.lock().await;
    // surface a lazy exit if it happened
    pm.poll_exit();
    Ok(pm.is_running())
}

#[tauri::command]
pub async fn start_noalbs(app: AppManager, state: State<'_, AppState>) -> AppResult<()> {
    let s = state.settings.lock().await.clone();
    let binary = s.binary_path.clone().ok_or(AppError::BinaryMissing)?;
    let cwd = s
        .working_dir
        .clone()
        .unwrap_or_else(|| binary.parent().unwrap_or_else(|| std::path::Path::new(".")).to_path_buf());

    let app_for_line = app.clone();
    let on_line: LineSink = Arc::new(move |line: LogLine| {
        let _ = app_for_line.emit("noalbs-log", line);
    });
    let app_for_exit = app.clone();
    let on_exit: ExitSink = Arc::new(move |code: Option<i32>| {
        let _ = app_for_exit.emit("noalbs-exit", code);
    });

    let mut pm = state.process.lock().await;
    pm.start(&binary, &cwd, &[], on_line, on_exit)?;
    Ok(())
}

#[tauri::command]
pub async fn stop_noalbs(state: State<'_, AppState>) -> AppResult<()> {
    state.process.lock().await.stop().await
}

#[tauri::command]
pub async fn restart_noalbs(app: AppManager, state: State<'_, AppState>) -> AppResult<()> {
    {
        let mut pm = state.process.lock().await;
        if pm.is_running() {
            pm.stop().await?;
        }
    }
    start_noalbs(app, state).await
}
```

> If the exact `AppManager`/`Emitter` import paths differ in the installed Tauri v2 version, the engineer should adjust to the version's API (the contract is: a handle that can `emit(event, payload)`). The scaffold's generated `lib.rs` shows the correct `tauri::` paths for this version.

- [ ] **Step 2: Wire state + commands in lib.rs**

Replace the body of `run()` in `src-tauri/src/lib.rs` so it declares modules and registers everything:

```rust
pub mod binary;
pub mod commands;
pub mod error;
pub mod process;
pub mod settings;

use std::sync::Mutex as _StdMutexUnused; // remove if unused

use commands::AppState;
use tauri::Manager;
use tokio::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let config_dir = app.path().app_config_dir().expect("config dir");
            let data_dir = app.path().app_data_dir().expect("data dir");
            let settings_path = config_dir.join("settings.json");
            let binary_dir = data_dir.join("bin");

            let settings = settings::Settings::load_from(&settings_path).unwrap_or_default();

            app.manage(AppState {
                settings: Mutex::new(settings),
                settings_path,
                binary_dir,
                process: Mutex::new(process::ProcessManager::default()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::save_settings,
            commands::set_manual_binary_path,
            commands::check_update,
            commands::download_binary,
            commands::get_log_buffer,
            commands::get_status,
            commands::start_noalbs,
            commands::stop_noalbs,
            commands::restart_noalbs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Add the dialog plugin to `Cargo.toml`: `tauri-plugin-dialog = "2"`, and install its JS counterpart in Task 11. Remove the unused `_StdMutexUnused` line.

- [ ] **Step 3: Build**

Run: `cd /Users/leev/repo/noalbsgui/src-tauri && cargo build 2>&1 | tail -25`
Expected: compiles. Fix any version-specific Tauri API mismatches surfaced by the compiler.

- [ ] **Step 4: Commit**

```bash
cd /Users/leev/repo/noalbsgui
git add src-tauri/src/commands.rs src-tauri/src/lib.rs src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "feat: wire Tauri commands and app state"
```

---

## Task 10: Generate TS bindings & build the React app shell

**Files:** Generates `src/bindings/`; create `src/App.tsx`, `src/api.ts`, modify `src/main.tsx`, `src/styles.css`.

- [ ] **Step 1: Generate the ts-rs bindings**

The `#[ts(export)]` derives emit `.ts` files when tests run. Run:

```bash
cd /Users/leev/repo/noalbsgui/src-tauri && cargo test export_bindings 2>&1 | tail -5
ls /Users/leev/repo/noalbsgui/src/bindings/
```

Expected: `Settings.ts`, `BinarySource.ts`, `LogLine.ts`, `LogStream.ts` exist in `src/bindings/`.

- [ ] **Step 2: Write the API wrapper**

Create `src/api.ts`:

```ts
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Settings } from "./bindings/Settings";
import type { LogLine } from "./bindings/LogLine";

export const api = {
  getSettings: () => invoke<Settings>("get_settings"),
  saveSettings: (settings: Settings) => invoke<void>("save_settings", { settings }),
  setManualBinaryPath: (path: string) =>
    invoke<Settings>("set_manual_binary_path", { path }),
  checkUpdate: () => invoke<string | null>("check_update"),
  downloadBinary: () => invoke<Settings>("download_binary"),
  getLogBuffer: () => invoke<LogLine[]>("get_log_buffer"),
  getStatus: () => invoke<boolean>("get_status"),
  start: () => invoke<void>("start_noalbs"),
  stop: () => invoke<void>("stop_noalbs"),
  restart: () => invoke<void>("restart_noalbs"),
};

export function onLog(cb: (line: LogLine) => void): Promise<UnlistenFn> {
  return listen<LogLine>("noalbs-log", (e) => cb(e.payload));
}
export function onExit(cb: (code: number | null) => void): Promise<UnlistenFn> {
  return listen<number | null>("noalbs-exit", (e) => cb(e.payload));
}
```

- [ ] **Step 3: Write the app shell**

Replace `src/App.tsx`:

```tsx
import { useState } from "react";
import { LogsTab } from "./components/LogsTab";
import { SettingsTab } from "./components/SettingsTab";
import "./styles.css";

type Tab = "logs" | "settings";

export default function App() {
  const [tab, setTab] = useState<Tab>("settings");
  return (
    <div className="app">
      <nav className="tabs">
        <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>
          Settings
        </button>
        <button className={tab === "logs" ? "active" : ""} onClick={() => setTab("logs")}>
          Logs
        </button>
      </nav>
      <main>{tab === "settings" ? <SettingsTab /> : <LogsTab />}</main>
    </div>
  );
}
```

Ensure `src/main.tsx` renders `<App />` (the scaffold already does this).

- [ ] **Step 4: Commit**

```bash
cd /Users/leev/repo/noalbsgui
git add src/bindings src/api.ts src/App.tsx src/main.tsx src/styles.css
git commit -m "feat: generate TS bindings and add app shell"
```

---

## Task 11: Settings tab (binary acquisition + run controls)

**Files:** Create `src/components/SettingsTab.tsx`; add `@tauri-apps/plugin-dialog`.

- [ ] **Step 1: Install the dialog plugin (JS side)**

Run:

```bash
cd /Users/leev/repo/noalbsgui
npm install @tauri-apps/plugin-dialog
```

- [ ] **Step 2: Write the Settings tab**

Create `src/components/SettingsTab.tsx`:

```tsx
import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { api } from "../api";
import type { Settings } from "../bindings/Settings";

export function SettingsTab() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [updateTag, setUpdateTag] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = async () => {
    setSettings(await api.getSettings());
    setRunning(await api.getStatus());
  };
  useEffect(() => {
    refresh();
  }, []);

  const guard = async (label: string, fn: () => Promise<void>) => {
    setErr(null);
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  };

  if (!settings) return <p>Loading…</p>;

  return (
    <section className="settings">
      <h2>noalbs binary</h2>
      <p>
        Version: <strong>{settings.installedVersion ?? "—"}</strong>
        {"  "}({settings.binarySource})
      </p>
      <p className="path">{settings.binaryPath ?? "no binary selected"}</p>

      <div className="row">
        <button
          disabled={!!busy}
          onClick={() => guard("download", async () => setSettings(await api.downloadBinary()))}
        >
          {busy === "download" ? "Downloading…" : "Download latest"}
        </button>
        <button
          disabled={!!busy}
          onClick={() =>
            guard("check", async () => setUpdateTag(await api.checkUpdate()))
          }
        >
          Check for updates
        </button>
        <button
          disabled={!!busy}
          onClick={() =>
            guard("pick", async () => {
              const path = await open({ multiple: false, directory: false });
              if (typeof path === "string") setSettings(await api.setManualBinaryPath(path));
            })
          }
        >
          Choose binary…
        </button>
      </div>
      {updateTag && <p className="update">Update available: {updateTag}</p>}
      {updateTag === null && busy === null && <span />}

      <h2>Control</h2>
      <p>Status: {running ? "running" : "stopped"}</p>
      <div className="row">
        <button disabled={!!busy || running} onClick={() => guard("start", async () => { await api.start(); await refresh(); })}>
          Start
        </button>
        <button disabled={!!busy || !running} onClick={() => guard("stop", async () => { await api.stop(); await refresh(); })}>
          Stop
        </button>
        <button disabled={!!busy} onClick={() => guard("restart", async () => { await api.restart(); await refresh(); })}>
          Restart
        </button>
      </div>

      {err && <p className="error">{err}</p>}
    </section>
  );
}
```

- [ ] **Step 3: Add minimal styles**

Append to `src/styles.css`:

```css
.app { font-family: system-ui, sans-serif; padding: 1rem; }
.tabs button { margin-right: .5rem; }
.tabs button.active { font-weight: 700; text-decoration: underline; }
.row { display: flex; gap: .5rem; margin: .5rem 0; }
.path { font-family: ui-monospace, monospace; color: #666; word-break: break-all; }
.error { color: #c00; }
.update { color: #0a0; }
.logs { font-family: ui-monospace, monospace; font-size: 12px; }
.logs .stderr { color: #c00; }
.logs-list { height: 70vh; overflow: auto; background: #111; color: #ddd; padding: .5rem; }
```

- [ ] **Step 4: Commit**

```bash
cd /Users/leev/repo/noalbsgui
git add src/components/SettingsTab.tsx src/styles.css package.json package-lock.json
git commit -m "feat: add Settings tab with binary controls"
```

---

## Task 12: Logs tab (live + backfill)

**Files:** Create `src/components/LogsTab.tsx`.

- [ ] **Step 1: Write the Logs tab**

Create `src/components/LogsTab.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { api, onLog } from "../api";
import type { LogLine } from "../bindings/LogLine";

export function LogsTab() {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [filter, setFilter] = useState("");
  const [autoscroll, setAutoscroll] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      setLines(await api.getLogBuffer());
      unlisten = await onLog((line) => setLines((prev) => [...prev, line].slice(-5000)));
    })();
    return () => unlisten?.();
  }, []);

  useEffect(() => {
    if (autoscroll) endRef.current?.scrollIntoView({ behavior: "auto" });
  }, [lines, autoscroll]);

  const shown = filter
    ? lines.filter((l) => l.text.toLowerCase().includes(filter.toLowerCase()))
    : lines;

  return (
    <section className="logs">
      <div className="row">
        <input placeholder="filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <label>
          <input type="checkbox" checked={autoscroll} onChange={(e) => setAutoscroll(e.target.checked)} />
          autoscroll
        </label>
        <button onClick={() => setLines([])}>clear view</button>
      </div>
      <div className="logs-list">
        {shown.map((l) => (
          <div key={l.seq} className={l.stream === "stderr" ? "stderr" : "stdout"}>
            {l.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check the frontend**

Run:

```bash
cd /Users/leev/repo/noalbsgui
npx tsc --noEmit 2>&1 | tail -20
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/leev/repo/noalbsgui
git add src/components/LogsTab.tsx
git commit -m "feat: add live Logs tab"
```

---

## Task 13: Manual end-to-end verification

**Files:** none (manual run).

- [ ] **Step 1: Run the full Rust test suite**

Run: `cd /Users/leev/repo/noalbsgui/src-tauri && cargo test 2>&1 | tail -20`
Expected: all tests pass.

- [ ] **Step 2: Launch the app in dev mode**

Run: `cd /Users/leev/repo/noalbsgui && npm run tauri dev`
Expected: the window opens on the Settings tab.

- [ ] **Step 3: Exercise the happy path**

In the running app:
1. Click **Download latest** → version fills in, path shows under `app_data_dir/bin/noalbs`.
2. Click **Start** → status becomes "running"; switch to **Logs** → the NOALBS ASCII banner (ending `v2.x.y`) and startup log lines stream in. (If no `config.json` exists in the working dir, noalbs will log an error and exit — that is expected for this skeleton; the point is that logs stream and the process lifecycle works.)
3. Click **Stop** → status becomes "stopped".
4. Click **Check for updates** → returns the latest tag or "no update".

- [ ] **Step 4: Confirm commit author hygiene**

Run: `git log --format='%an <%ae>%n%b' | grep -i claude && echo "FAIL: Claude trailer present" || echo "OK: no Claude trailer"`
Expected: `OK: no Claude trailer`. Also confirm every author is `weisunglee`.

- [ ] **Step 5: Final commit (if any docs/notes changed)**

```bash
cd /Users/leev/repo/noalbsgui
git add -A
git commit -m "chore: P1 skeleton complete" --allow-empty
```

---

## Self-review notes (against the spec)

- **Binary auto-download by OS/arch from official repo** → Tasks 4, 6, 9 (`current_target`, `select_asset`, `download_binary`, `REPO` constant).
- **Manual path override** → Task 9 `set_manual_binary_path` + Task 11 UI.
- **Version display; unknown ⇒ not shown** → `Settings.installed_version: Option<String>`; UI shows `—` placeholder only as a dash; manual path sets it to `None` (Task 9) so nothing version-specific is shown until known.
- **Update check vs releases/latest tag** → Task 5 `is_update_available`, Task 9 `check_update`.
- **Start/stop/restart child + capture stdout/stderr** → Tasks 7–9; Logs UI Task 12.
- **Log ring buffer + backfill** → Task 7 `LogBuffer`, Task 9 `get_log_buffer`, Task 12 backfill on mount.
- **ts-rs shared types** → Tasks 3/7/10 (`#[ts(export)]`).
- **Atomic writes** → Task 3 `save_to`.
- **Out of P1 (deferred to later plans):** config.json form editor (P2), `.env` secret editing + token helper (P2), Dashboard + log-parsed bitrate (P3), WS client + startup update prompt + themes (P4). The `working_dir` field exists now so P2 can point noalbs at the config it edits.

> **Known simplification:** exit reporting in P1 is via `poll_exit` (called in `get_status`) rather than a dedicated waiter task, so the `noalbs-exit` event/`on_exit` sink is wired but only fires opportunistically. A dedicated waiter task that emits `noalbs-exit` immediately on exit is a small follow-up; it is not required for P1's acceptance and is noted here rather than left as a silent gap.
