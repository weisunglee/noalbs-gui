# Single-instance noalbs-gui

**Date:** 2026-07-04
**Status:** Approved

## Problem

Launching noalbs-gui while it is already running creates a second process. Two
GUIs can each spawn a noalbs child, which answers chat twice. The app should
only ever run once; a second launch must not create a new process.

## Decision

Use the official `tauri-plugin-single-instance` plugin. When a second instance
starts, the plugin detects the running instance via platform-native primitives
(named mutex on Windows, D-Bus on Linux, a local socket on macOS), exits the
new process immediately, and fires a callback in the first instance. In that
callback we bring the existing window to the front.

A hand-rolled lock file / local socket was rejected: it would reimplement what
the plugin already solves, plus stale-lock edge cases after a crash.

## Changes

- `src-tauri/Cargo.toml`: add `tauri-plugin-single-instance = "2"`.
- `src-tauri/src/lib.rs`: register the plugin **first** on the builder (the
  plugin docs require it to be registered before others so the duplicate exits
  as early as possible). The callback gets the main window and calls
  `unminimize()`, `show()`, and `set_focus()`.
- No frontend changes. No capability changes (the plugin has no JS API).

## Non-impact

The existing kill-noalbs-on-exit logic in `run()` is unaffected: the duplicate
process exits inside plugin initialization, before `setup()` runs, so it never
creates an `AppState` or a `ProcessManager`.

## Verification

1. `cargo build` succeeds.
2. Launch the app twice. The second launch must not show a new window; the
   existing window is unminimized and focused instead.
3. Activity Monitor shows a single noalbsgui process.
