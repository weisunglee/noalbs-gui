# NOALBSGUI — Design Spec

- **Date:** 2026-06-13
- **Status:** Draft for review
- **Goal:** A desktop GUI that makes [NOALBS](https://github.com/NOALBS/nginx-obs-automatic-low-bitrate-switching) (v2, Rust) easy to use — wrapping the official `noalbs` binary as an external child process, managing its configuration, and monitoring its output.

---

## 1. Background — facts about NOALBS v2

Established by reading the `v2` branch source:

- **Single executable.** On startup it reads `config.json` from its working directory, then `.env` for credentials/options (`TWITCH_BOT_USERNAME`, `TWITCH_BOT_OAUTH`, `API_PORT`, `LOG_DIR`, `LOG_FILE_NAME`, `CONFIG_DIR`).
- **Output goes to stdout** via `tracing` by default; only writes to a file when `LOG_DIR` is set. → The reliable way to monitor it is to **spawn it as a child process and capture stdout/stderr.**
- **No config hot-reload.** No file watcher (no `notify` dependency; `config.rs` only has `load`/`save`). → **Editing `config.json` requires restarting noalbs to take effect.**
- **`config.json` is the central, well-structured config** (`user`, `switcher`, `software`, `chat`, `streamServers`, `optionalScenes`, `optionalOptions`). Editing it by hand is the main pain point — this is the GUI's biggest value.
- **WebSocket API is immature and low-value.** Enabled only when `API_PORT` is set. Requests are limited to `auth` / `setPassword` / `me` (returns config) / `logout`; events are only `sceneSwitched` and `prefixChanged`. It **cannot** switch scenes or send control commands, and `me` only returns config we already read from disk. Its only incremental value is scene-switch events (and it requires setting a password first). → Treat WS as an optional, later-phase enhancement.
- **Version info:** `VERSION = CARGO_PKG_VERSION`. `print_logo()` prints the ASCII banner ending in `v{VERSION}` (e.g. `v2.17.0`) to **stdout** at startup. There is **no `--version` CLI flag** (main.rs parses no args).
- **Release targets (4):** `aarch64-apple-darwin` (macOS arm64), `x86_64-apple-darwin` (macOS x64), `x86_64-pc-windows-msvc` (Windows x64, `.zip`), `x86_64-unknown-linux-musl` (Linux x64, `.tar.gz`). **No** Windows/Linux arm64.

---

## 2. Scope

**In scope (full feature set, delivered in phases):**

1. Acquire the noalbs binary — **auto-download** the correct asset for the user's OS/arch, **and** allow a **manual path override**.
2. Launch / stop / restart noalbs as a child process.
3. Live log viewer (stdout/stderr).
4. Full **form-based** `config.json` editor, plus an **advanced raw-JSON tab**.
5. Edit noalbs's `.env` — including **secret-by-default** credential fields and a **"get token"** helper linking to <https://irlhosting.com/tmi/>.
6. Monitoring dashboard — running state, current scene, OBS connection, and **bitrate parsed from logs (best-effort, experimental)**.
7. **Version display + update check** — show installed version, check GitHub releases, prompt the user to update.

**Out of scope (YAGNI):**

- Multi-user `CONFIG_DIR` (single `config.json` for now; future work).
- Modifying noalbs source — we only wrap it.
- Reimplementing chat-command control — scene switching etc. stays in noalbs.

---

## 3. Architecture

**Approach: Rust core, React view.** Tauri's Rust backend owns all heavy work (process management, file IO, binary download, log parsing, optional WS). React is the view layer, communicating via Tauri commands and events. Config is defined once as Rust structs and **TypeScript types are auto-generated via `ts-rs`** so the form and backend never drift from noalbs's schema.

**Stack:** Tauri v2 · Rust backend · React + TypeScript frontend.

### 3.1 Rust backend modules (`src-tauri/src/`)

| Module | Responsibility |
|---|---|
| `process.rs` | spawn/stop/restart the noalbs child; read stdout/stderr line-by-line → emit `noalbs-log` events; track run state + exit code; set cwd (config.json location) and env vars. Maintain a ring buffer of recent log lines. |
| `config.rs` | Rust structs mirroring noalbs `config.json` (serde, camelCase, `ts-rs` derive); `load`/`save` with atomic write; validation. Single source of truth for config types. |
| `env_file.rs` | Read/write `.env` (Twitch creds, `API_PORT`, optional `LOG_DIR`). **Preserves unknown lines** the user added manually. Atomic write. |
| `binary.rs` | **Download source = the official NOALBS repo releases** (`github.com/NOALBS/nginx-obs-automatic-low-bitrate-switching`). Detect OS/arch → query `releases/latest` to learn the latest version → select the correct asset for the current OS/arch → download → extract (`.tar.gz`/`.zip`) → store in app data dir. Tracks downloaded version. Update check = compare installed version vs `releases/latest` `tag_name`; if newer, prompt the user; on confirm, download the matching asset and replace. Manual path override. |
| `version.rs` | Resolve installed version: from the stored downloaded tag, or by parsing `v(x.y.z)` from the startup banner on stdout. If unknown, report none (UI shows nothing). |
| `log_parser.rs` | Best-effort regex parse of stdout lines → bitrate, scene switches, OBS connect/disconnect, errors. Degradable; clearly labeled experimental. Feeds `noalbs-status` events. |
| `ws_client.rs` | (Optional, later phase) Connect to noalbs WS at `127.0.0.1:{API_PORT}/ws`; auth; subscribe to `sceneSwitched`/`prefixChanged` to enrich the dashboard. Degrades silently if unavailable. |
| `settings.rs` | GUI's own settings in app data dir: binary source (auto/manual) + path, working dir, "check for updates on startup", theme, window prefs. |
| `commands.rs` / `lib.rs` | Tauri commands exposed to React; wire everything via `Arc<Mutex<AppState>>` and event channels. |

### 3.2 React frontend (`src/`) — four tabs

- **Dashboard:** run state, uptime, current scene (best-effort: log/WS), bitrate chart (best-effort, experimental badge), OBS connection status, installed version + "update available" indicator.
- **Config:** form-based editor (`react-hook-form` + `zod`) with sections matching config structure; `streamServers` list with add/remove/reorder-by-priority and server-type-specific fields; **Advanced tab** = raw JSON editor (Monaco or CodeMirror) two-way synced with the form. Save → if running, prompt/auto restart.
- **Logs:** live virtualized list, filter by level, search, autoscroll, clear; backfills history from the Rust ring buffer on mount.
- **Settings:** binary source (auto-download/update button + version display, or manual path picker), working dir, Twitch bot credentials (`.env`), `API_PORT` toggle + WS password, "check for updates on startup", theme.
- **Types:** auto-generated from Rust via `ts-rs` into `bindings/`.

---

## 4. Data flow

- **Config:** React form ⇄ `get_config` / `save_config` ⇄ `config.rs` ⇄ `config.json`. On save → atomic write → if noalbs running, restart to apply.
- **Logs:** noalbs stdout/stderr → `process.rs` line reader → `noalbs-log` events → React appends; Rust ring buffer holds history for late-mounting views.
- **Status:** `log_parser` (+ optional `ws_client`) → `noalbs-status` events → Dashboard.
- **Binary/version:** Settings → `ensure_binary` / `check_update` / `update_binary` → `binary.rs` → progress events → installed version + path stored in settings.
- **Lifecycle:** start → write `.env` / set env vars, set cwd, spawn; stop → kill child; restart → after config save or update.

---

## 5. Secrets handling

- Sensitive fields (`TWITCH_BOT_OAUTH`, WS password) are **password-style, hidden by default**, with an explicit "show" toggle; never shown as plaintext on load.
- Never written to logs, events, or error messages.
- A **"Get token"** button next to the OAuth field opens <https://irlhosting.com/tmi/> in the system browser, with a short instruction to paste the result back.
- `.env` written via atomic write, **preserving unknown lines** so manual user edits aren't clobbered.

---

## 6. Error handling

- **Binary download:** network error / missing asset / extraction failure → surfaced in UI with retry; fall back to manual path.
- **noalbs crash/exit:** detect child exit → show exit code + last log lines → offer restart. Never die silently.
- **Unparseable `config.json`:** only enter the form when it parses; on parse failure, fall back to the raw-JSON editor and show the error — **never overwrite a config we couldn't parse without explicit confirmation.** Missing file → offer to create from a template.
- **Save safety:** temp file + atomic rename for both `config.json` and `.env`.
- **WS (optional):** if `API_PORT` unset or auth fails, the dashboard degrades to log-parse-only and clearly shows "live API not connected."

---

## 7. Testing (TDD)

- **Rust unit tests:** config (de)serialization round-trip against a real sample `config.json`; `.env` parse/serialize preserving unknown lines; `log_parser` regexes against captured sample log lines; `binary.rs` asset selection per OS/arch; version banner parsing.
- **Integration:** a fake "noalbs" script that prints known log lines (including the version banner) to test process management and parsing without the real binary.
- **Frontend:** form `zod` validation; form ⇄ raw-JSON sync.

---

## 8. Delivery phases

Scope is the full feature set; delivered incrementally:

1. **P1 — Skeleton:** Tauri+React project; binary auto-download + manual path; start/stop/restart; live log viewer.
2. **P2 — Core value:** config form editor (incl. `streamServers`, advanced JSON tab); `.env` secret editing + token helper; restart-on-save.
3. **P3 — Monitoring:** Dashboard; best-effort log parsing for bitrate/status (experimental).
4. **P4 — Enhancements:** version/update check + prompt; optional WS (`sceneSwitched`); themes; startup update check.
