# noalbs-gui

[![Release](https://github.com/weisunglee/noalbs-gui/actions/workflows/release.yml/badge.svg)](https://github.com/weisunglee/noalbs-gui/actions/workflows/release.yml)
[![CI](https://github.com/weisunglee/noalbs-gui/actions/workflows/ci.yml/badge.svg)](https://github.com/weisunglee/noalbs-gui/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/weisunglee/noalbs-gui?include_prereleases)](https://github.com/weisunglee/noalbs-gui/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A cross-platform desktop GUI for [**NOALBS**](https://github.com/NOALBS/nginx-obs-automatic-low-bitrate-switching) (NGINX/OBS Automatic Low-Bitrate Switching).

**➡️ [Download the latest build](https://github.com/weisunglee/noalbs-gui/releases/latest)** — portable, no install: unzip/extract and run. (Builds are unsigned; see [Building from source](#building-from-source) for the security-warning note.)

> It's portable: the app keeps its settings and the downloaded `noalbs` binary in a `noalbsgui-data` folder **next to the executable**, so keep it in a writable location (e.g. its own folder, not a read-only mount).

NOALBS is a tool for IRL streamers that automatically switches scenes in OBS based on your incoming stream's bitrate — when your connection drops, it flips to a "low" or "offline" scene, and switches back when it recovers. It's powerful, but it's configured by hand-editing a `config.json` and an `.env`, and run from a terminal.

**noalbs-gui wraps the official `noalbs` binary** and gives you a friendly window instead: download and run noalbs, edit every setting with forms, and watch its live status — no JSON or command line required.

> noalbs-gui is an unofficial companion app. It does not modify or re-implement NOALBS; it runs the official release binary as a child process. Not affiliated with the NOALBS project.

---

## Features

- **Get the binary for you** — downloads the correct official `noalbs` release for your OS/architecture (or point it at a binary you already have), shows the installed version, and checks for updates. The release ships a starter `config.json` and `.env`, which are placed for you (without overwriting any you already have).
- **Run it** — start / stop / restart noalbs as a managed child process.
- **Live logs** — noalbs's output streamed into a filterable, auto-scrolling log view.
- **Full config editor** — a form for the entire `config.json`:
  - switcher options, bitrate/RTT triggers, switching scenes
  - OBS connection (host / port / password)
  - **stream servers** — add/remove/prioritise, with type-specific fields for all supported types (NGINX, Node-Media-Server, Nimble, SRT-Live-Server, BELABOX, MediaMTX, RIST, Xiu, OpenIRL, IRLHosting), plus optional auth, scene overrides, and `dependsOn`
  - **chat** — Twitch/Kick platform, admins, language, prefix, toggles, and per-command permission/alias overrides
  - an **Advanced (raw JSON)** tab for power users, kept in sync with the form
- **Credentials editor** — edit noalbs's `.env` (Twitch bot username/OAuth, API port, log dir). Secrets are masked by default, and a **Get token** button opens the token generator. Unrelated lines in your `.env` are preserved.
- **Status dashboard** — at-a-glance running state + uptime + version, OBS connection, current scene + last switch, switcher state, and the loaded user (parsed live from noalbs's log).

Editing the config and saving while noalbs is running will offer to restart it so the changes take effect.

> **Note on bitrate:** the dashboard does not show a live bitrate graph. NOALBS does not print bitrate to its log (it only reports it to chat via `!bitrate`), so it isn't available to the GUI without re-implementing each stream server's stats polling. This may change if a future NOALBS exposes it.

---

## Supported platforms

noalbs-gui runs anywhere Tauri does, but it can only auto-download a `noalbs` binary for the targets the NOALBS project releases:

| OS | Architecture | Auto-download |
| --- | --- | --- |
| macOS | Apple Silicon (arm64) | ✅ |
| macOS | Intel (x86_64) | ✅ |
| Windows | x86_64 | ✅ |
| Linux | x86_64 | ✅ |

On other targets you can still use the GUI by pointing it at a `noalbs` binary you built yourself.

---

## Building from source

### Prerequisites

- **Rust** (stable) — <https://www.rust-lang.org/tools/install>
- **Node.js 22+** (see `.nvmrc`) and npm
- **Tauri v2 system dependencies** for your OS — follow the official guide: <https://v2.tauri.app/start/prerequisites/>
  - **macOS:** Xcode Command Line Tools (`xcode-select --install`)
  - **Linux:** `webkit2gtk`, `libappindicator`, etc. (see the Tauri guide for your distro)
  - **Windows:** WebView2 (preinstalled on Windows 11) + the MSVC build tools

### Clone and run

```bash
git clone https://github.com/weisunglee/noalbs-gui.git
cd noalbs-gui
npm install

# Run in development (hot-reloading window):
npm run tauri dev

# Build a production bundle/installer for your platform:
npm run tauri build
```

The installer/app bundle is written to `src-tauri/target/release/bundle/`.

---

## How it works

noalbs-gui follows a thin-shell architecture:

- **Rust backend** (`src-tauri/`) owns all the logic — downloading/extracting the binary, managing the child process and its log buffer, reading/writing `config.json` and `.env`, and parsing status from the log. Configuration is modelled as Rust types that mirror NOALBS's schema exactly.
- **React + TypeScript frontend** (`src/`) is the view. TypeScript types are generated from the Rust models with [`ts-rs`](https://github.com/Aleph-Alpha/ts-rs), so the UI and backend can't drift out of sync.

```
src-tauri/src/   Rust: binary download, process mgmt, config/.env models, status parser, Tauri commands
src/             React: Dashboard / Settings / Config / Logs tabs
src/bindings/    Auto-generated TypeScript types (do not edit by hand)
```

---

## Contributing

Issues and pull requests are welcome. The codebase is built in phases (skeleton → config editor → dashboard); design specs and implementation plans live under `docs/`.

## Acknowledgements

- [NOALBS](https://github.com/NOALBS/nginx-obs-automatic-low-bitrate-switching) by b3ck and 715209 — the engine this GUI drives.
- [Tauri](https://tauri.app/).

## License

[MIT](LICENSE) © weisunglee
