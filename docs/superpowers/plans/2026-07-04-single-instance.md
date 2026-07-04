# Single-Instance noalbs-gui Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Launching noalbs-gui while it is already running must not create a new process; the existing window is focused instead.

**Architecture:** Register the official `tauri-plugin-single-instance` plugin first on the Tauri builder. The duplicate process exits inside plugin init (before `setup()`), and the callback in the surviving process unminimizes and focuses the main window.

**Tech Stack:** Tauri 2 (Rust), tauri-plugin-single-instance 2.

**Spec:** `docs/superpowers/specs/2026-07-04-single-instance-design.md`

## Global Constraints

- The plugin must be the **first** `.plugin()` registered on the builder (per plugin docs, so the duplicate exits as early as possible).
- No frontend changes, no capability changes.
- The main window has the default label `main` (no label set in `tauri.conf.json`).

---

### Task 1: Register the single-instance plugin

**Files:**
- Modify: `src-tauri/Cargo.toml` (dependencies section)
- Modify: `src-tauri/src/lib.rs:12-14` (builder chain)

**Interfaces:**
- Consumes: nothing from other tasks (only task).
- Produces: n/a.

**Note on TDD:** Plugin registration has no unit-testable surface — the observable behavior is OS-level process arbitration. Verification is behavioral (steps 3–4), matching the spec's Verification section.

- [ ] **Step 1: Add the dependency**

In `src-tauri/Cargo.toml`, under `[dependencies]`, after the `tauri-plugin-dialog = "2"` line, add:

```toml
tauri-plugin-single-instance = "2"
```

- [ ] **Step 2: Register the plugin first on the builder**

In `src-tauri/src/lib.rs`, change:

```rust
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
```

to:

```rust
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // A second launch landed here in the surviving process; the
            // duplicate has already exited. Surface the existing window.
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
```

- [ ] **Step 3: Build**

Run: `cargo build --manifest-path src-tauri/Cargo.toml`
Expected: compiles with no errors (warnings unchanged from before).

- [ ] **Step 4: Behavioral verification**

Run: `npm run tauri build` (or use an existing debug binary via `npm run tauri dev`), then launch the produced app twice:

1. Start the app. Minimize its window.
2. Start the app again (double-click the .app / run the binary a second time).

Expected:
- No second window appears.
- The existing window is unminimized and focused.
- `pgrep -fl noalbs-gui` (or Activity Monitor) shows a single GUI process.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lib.rs
git commit -m "feat: only allow a single running instance of the GUI"
```
