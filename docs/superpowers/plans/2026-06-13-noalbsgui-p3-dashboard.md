# NOALBSGUI P3 (Status Dashboard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A Dashboard tab showing noalbs's live status, parsed from its stdout log + process state: running/uptime/version, OBS connection state, current scene + last switch type, switcher state, and the loaded user.

**Scope decision (important):** **No bitrate chart.** Verified against noalbs v2 source: bitrate is computed only for the `!bitrate` chat reply and is **never written to stdout** (stream servers log raw stats only at `trace` level). A real bitrate feed would require the GUI to poll each server's `statsUrl` itself (re-implementing noalbs's per-type stats parsing) — explicitly out of scope. P3 surfaces the clean `info`-level signals instead.

**Architecture:** A pure Rust parser `status::parse_status_line(line, &mut NoalbsStatus) -> bool` extracts status from each captured log line. The process line-reader (already running per spawned child) feeds the parser into a shared `NoalbsStatus` in `AppState`; changes emit a `noalbs-status` event. A `get_dashboard` command returns a full snapshot (running, uptime, version, status) for initial load + polling. React `DashboardTab` subscribes + polls. Consistent with the Rust-core / React-view architecture.

**Tech Stack:** Tauri v2 · Rust (serde, ts-rs) · React + TS. No new deps.

**Reference:** Builds on merged P1/P2. The reliable `info`-level log messages (from noalbs v2 source) the parser targets — note tracing's default line format is `<ts> <LEVEL> <target>: <message>`, so match on the message text:
- `Scene switched to [{SwitchType:?}] {scene}` — e.g. `Scene switched to [Normal] LIVE` (switcher.rs). → current scene + switch type.
- OBS (obs_v5.rs): message exactly `Connecting`, `Connected`, or `Disconnected`.
- Switcher states (switcher.rs): `Running switcher` / `Switcher running`, `Switcher disabled waiting till enabled`, `Waiting for OBS connection`, `Waiting till OBS starts streaming`, `Not able to switch, waiting for scene switch to a switchable scene`, `Offline timeout reached, stopping the stream`.
- `Loaded user: {name}` (noalbs.rs) → user.
- `Stopping NOALBS {name}` (noalbs.rs, via println) → stopping.

---

## Repo conventions (MUST follow)
- **Commit as `weisunglee`. NEVER run `git config`. NEVER add `Co-Authored-By`/Claude/AI lines.** Plain `git commit -m`.
- **PR workflow** — branch `p3-dashboard`, never push `main`.
- **Rust: `SDKROOT=$(xcrun --sdk macosx --show-sdk-path) cargo test|build`.** **Node 22** for npm/tsc.
- ts-rs `export_to = "../../src/bindings/"` (verified).

---

## File structure
```
src-tauri/src/
  status.rs        # NEW: NoalbsStatus + parse_status_line + tests (+ ts-rs)
  process.rs       # MODIFY: track started_at; uptime_secs()
  commands.rs      # MODIFY: AppState.status; wire parsing into start_noalbs on_line; get_dashboard; reset on start
  lib.rs           # MODIFY: declare status module; manage status state; register get_dashboard
src/
  api.ts           # MODIFY: getDashboard wrapper + onStatus event listener
  components/
    DashboardTab.tsx   # NEW
  App.tsx          # MODIFY: add "Dashboard" tab (first, default)
```

---

## Task 1: Status model + log parser (`status.rs`)

**Files:** Create `src-tauri/src/status.rs`; modify `lib.rs` (`pub mod status;`).

- [ ] **Step 1: Write model + parser + tests**

```rust
use serde::Serialize;
use ts_rs::TS;

#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub enum ObsConnection {
    Disconnected,
    Connecting,
    Connected,
}

#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct NoalbsStatus {
    pub obs: ObsConnection,
    pub current_scene: Option<String>,
    pub last_switch_type: Option<String>,
    pub switcher_state: Option<String>,
    pub user: Option<String>,
}

impl Default for NoalbsStatus {
    fn default() -> Self {
        Self {
            obs: ObsConnection::Disconnected,
            current_scene: None,
            last_switch_type: None,
            switcher_state: None,
            user: None,
        }
    }
}

/// Update `status` from a single captured log line. Returns true if anything
/// changed. Matches on the message text within tracing's default line format
/// (`<ts> <LEVEL> <target>: <message>`), so it is tolerant of the prefix.
pub fn parse_status_line(line: &str, status: &mut NoalbsStatus) -> bool {
    let before = status.clone();

    if let Some(rest) = line.split("Scene switched to [").nth(1) {
        // rest looks like: `Normal] LIVE`
        if let Some((ty, scene)) = rest.split_once("] ") {
            status.last_switch_type = Some(ty.trim().to_string());
            status.current_scene = Some(scene.trim().to_string());
        }
    } else if let Some(rest) = line.split("Loaded user: ").nth(1) {
        status.user = Some(rest.trim().to_string());
    } else if ends_with_msg(line, "Disconnected") {
        status.obs = ObsConnection::Disconnected;
    } else if ends_with_msg(line, "Connecting") {
        status.obs = ObsConnection::Connecting;
    } else if ends_with_msg(line, "Connected") {
        status.obs = ObsConnection::Connected;
    } else if line.contains("Offline timeout reached") {
        status.switcher_state = Some("Offline timeout — stopping stream".to_string());
    } else if line.contains("Switcher disabled") {
        status.switcher_state = Some("Disabled".to_string());
    } else if line.contains("Waiting for OBS connection") {
        status.switcher_state = Some("Waiting for OBS".to_string());
    } else if line.contains("Waiting till OBS starts streaming") {
        status.switcher_state = Some("Waiting for streaming".to_string());
    } else if line.contains("waiting for scene switch to a switchable scene") {
        status.switcher_state = Some("Waiting for switchable scene".to_string());
    } else if line.contains("Switcher running") || line.contains("Running switcher") {
        status.switcher_state = Some("Running".to_string());
    }

    *status != before
}

/// True if the log line's message (the part after the last "<target>: ") equals
/// `msg` — i.e. the trimmed line ends with `msg`. Disambiguates Connected vs
/// Disconnected (checked in the right order by the caller).
fn ends_with_msg(line: &str, msg: &str) -> bool {
    line.trim_end().ends_with(msg)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(lines: &[&str]) -> NoalbsStatus {
        let mut s = NoalbsStatus::default();
        for l in lines {
            parse_status_line(l, &mut s);
        }
        s
    }

    #[test]
    fn parses_scene_switch() {
        let s = parse(&["2026-06-13T12:00:00Z  INFO noalbs::switcher: Scene switched to [Normal] LIVE"]);
        assert_eq!(s.current_scene.as_deref(), Some("LIVE"));
        assert_eq!(s.last_switch_type.as_deref(), Some("Normal"));
    }

    #[test]
    fn parses_scene_with_spaces() {
        let s = parse(&["...: Scene switched to [Offline] My BRB Scene"]);
        assert_eq!(s.current_scene.as_deref(), Some("My BRB Scene"));
        assert_eq!(s.last_switch_type.as_deref(), Some("Offline"));
    }

    #[test]
    fn obs_connection_transitions() {
        let mut s = NoalbsStatus::default();
        assert_eq!(s.obs, ObsConnection::Disconnected);
        parse_status_line("... INFO noalbs::broadcasting_software::obs_v5: Connecting", &mut s);
        assert_eq!(s.obs, ObsConnection::Connecting);
        parse_status_line("... INFO noalbs::broadcasting_software::obs_v5: Connected", &mut s);
        assert_eq!(s.obs, ObsConnection::Connected);
        parse_status_line("... WARN noalbs::broadcasting_software::obs_v5: Disconnected", &mut s);
        assert_eq!(s.obs, ObsConnection::Disconnected);
    }

    #[test]
    fn disconnected_not_misread_as_connected() {
        let mut s = NoalbsStatus::default();
        s.obs = ObsConnection::Connected;
        let changed = parse_status_line("... WARN ...obs_v5: Disconnected", &mut s);
        assert!(changed);
        assert_eq!(s.obs, ObsConnection::Disconnected);
    }

    #[test]
    fn parses_user_and_switcher_state() {
        let s = parse(&[
            "... INFO noalbs::noalbs: Loaded user: b3ck",
            "... INFO noalbs::switcher: Switcher running",
        ]);
        assert_eq!(s.user.as_deref(), Some("b3ck"));
        assert_eq!(s.switcher_state.as_deref(), Some("Running"));
    }

    #[test]
    fn unmatched_line_does_not_change() {
        let mut s = NoalbsStatus::default();
        let changed = parse_status_line("... INFO noalbs: some unrelated line", &mut s);
        assert!(!changed);
    }
}
```

- [ ] **Step 2: Run tests + bindings**

`cd src-tauri && SDKROOT=$(xcrun --sdk macosx --show-sdk-path) cargo test status::` → 6 pass. Full `cargo test` → `NoalbsStatus.ts` + `ObsConnection.ts` in `src/bindings/`.

- [ ] **Step 3: Commit**
```bash
git add src-tauri/src/status.rs src-tauri/src/lib.rs src/bindings
git commit -m "feat: add noalbs status log parser"
```

---

## Task 2: Wire status into process + commands

**Files:** Modify `src-tauri/src/process.rs`, `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs`.

- [ ] **Step 1: Track uptime in ProcessManager**

In `process.rs`, add a start timestamp. Add field `started_at: Option<std::time::Instant>` to `ProcessManager` (default `None`). In `start(...)`, set `self.started_at = Some(std::time::Instant::now());` after a successful spawn. In `stop(...)` and when `poll_exit` takes the child, set `self.started_at = None`. Add:
```rust
pub fn uptime_secs(&self) -> Option<u64> {
    self.started_at.map(|t| t.elapsed().as_secs())
}
```
(Update the `Default` impl / struct literal accordingly.) Existing process tests must still pass.

- [ ] **Step 2: AppState gains shared status; wire parsing + get_dashboard**

In `commands.rs`:
- Add `use crate::status::{self, NoalbsStatus};` and `use std::sync::{Arc, Mutex as StdMutex};` (Arc may already be imported).
- Add to `AppState`: `pub status: Arc<StdMutex<NoalbsStatus>>,`.
- In `start_noalbs`: reset status at start, and parse each line in the existing `on_line` closure, emitting `noalbs-status` on change:

```rust
// reset before (re)start
*state.status.lock().unwrap() = NoalbsStatus::default();

let status = state.status.clone();
let app_for_line = app.clone();
let on_line: LineSink = Arc::new(move |line: LogLine| {
    let _ = app_for_line.emit("noalbs-log", line.clone());
    let changed = {
        let mut s = status.lock().unwrap();
        status::parse_status_line(&line.text, &mut s)
    };
    if changed {
        let snapshot = status.lock().unwrap().clone();
        let _ = app_for_line.emit("noalbs-status", snapshot);
    }
});
```
(Keep the existing `on_exit` sink.)

- Add a dashboard snapshot command + type:
```rust
#[derive(serde::Serialize, ts_rs::TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct DashboardSnapshot {
    pub running: bool,
    pub uptime_secs: Option<u64>,
    pub version: Option<String>,
    pub status: NoalbsStatus,
}

#[tauri::command]
pub async fn get_dashboard(state: State<'_, AppState>) -> AppResult<DashboardSnapshot> {
    let version = state.settings.lock().await.installed_version.clone();
    let mut pm = state.process.lock().await;
    pm.poll_exit(); // refresh running + clear uptime if it exited
    let running = pm.is_running();
    let uptime_secs = pm.uptime_secs();
    let status = state.status.lock().unwrap().clone();
    Ok(DashboardSnapshot { running, uptime_secs, version, status })
}
```
> When `poll_exit` clears the child it also clears `started_at` (Step 1), so `uptime_secs` is `None` once stopped. If the process is not running, the parsed `status` reflects the last-seen values until the next start resets it — acceptable; the `running:false` flag is the authority for "is it live".

- [ ] **Step 3: Manage status state + register command in lib.rs**

In `lib.rs` `.setup(...)`, add `status: std::sync::Arc::new(std::sync::Mutex::new(noalbsgui::status::NoalbsStatus::default()))` (adjust path to the crate's module) to the `AppState { ... }` construction. Register `get_dashboard` in `generate_handler!`.

- [ ] **Step 4: Build + test**
`cd src-tauri && SDKROOT=$(xcrun --sdk macosx --show-sdk-path) cargo build && cargo test` — compiles, all pass (incl. the unix process-capture test). `DashboardSnapshot.ts` generated.

- [ ] **Step 5: Commit**
```bash
git add src-tauri/src/process.rs src-tauri/src/commands.rs src-tauri/src/lib.rs src/bindings
git commit -m "feat: track uptime and expose parsed status via get_dashboard"
```

---

## Task 3: Dashboard tab (frontend)

**Files:** Modify `src/api.ts`; create `src/components/DashboardTab.tsx`; modify `src/App.tsx`, `src/styles.css`.

- [ ] **Step 1: api.ts** — add:
```ts
import type { DashboardSnapshot } from "./bindings/DashboardSnapshot";
import type { NoalbsStatus } from "./bindings/NoalbsStatus";
// ...in api object:
  getDashboard: () => invoke<DashboardSnapshot>("get_dashboard"),
// ...new listener:
export function onStatus(cb: (s: NoalbsStatus) => void): Promise<UnlistenFn> {
  return listen<NoalbsStatus>("noalbs-status", (e) => cb(e.payload));
}
```

- [ ] **Step 2: DashboardTab.tsx**
```tsx
import { useEffect, useState } from "react";
import { api, onStatus } from "../api";
import type { DashboardSnapshot } from "../bindings/DashboardSnapshot";

function fmtUptime(secs: number | null): string {
  if (secs === null) return "—";
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  return (h > 0 ? `${h}h ` : "") + `${m}m ${s}s`;
}

export function DashboardTab() {
  const [d, setD] = useState<DashboardSnapshot | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const refresh = () => api.getDashboard().then(setD).catch(() => {});
    refresh();
    const id = setInterval(refresh, 1000); // ticks uptime + running
    onStatus(() => refresh()).then((u) => (unlisten = u));
    return () => { clearInterval(id); unlisten?.(); };
  }, []);

  if (!d) return <p>Loading…</p>;
  const st = d.status;

  return (
    <section className="dashboard">
      <div className="cards">
        <div className={`card ${d.running ? "ok" : "off"}`}>
          <h3>noalbs</h3>
          <p>{d.running ? "running" : "stopped"}</p>
          <small>uptime {fmtUptime(d.uptimeSecs)}{d.version ? ` · v${d.version}` : ""}</small>
        </div>
        <div className={`card ${st.obs === "connected" ? "ok" : st.obs === "connecting" ? "warn" : "off"}`}>
          <h3>OBS</h3>
          <p>{st.obs}</p>
        </div>
        <div className="card">
          <h3>Scene</h3>
          <p>{st.currentScene ?? "—"}</p>
          <small>{st.lastSwitchType ? `last switch: ${st.lastSwitchType}` : ""}</small>
        </div>
        <div className="card">
          <h3>Switcher</h3>
          <p>{st.switcherState ?? "—"}</p>
          <small>{st.user ? `user: ${st.user}` : ""}</small>
        </div>
      </div>
      {!d.running && <p className="note">Start noalbs from the Settings tab to see live status.</p>}
    </section>
  );
}
```
> Note: `st.obs` is the serialized `ObsConnection` — confirm the casing in the generated `ObsConnection.ts` (serde `rename_all = "camelCase"` on a unit-variant enum produces `"connected"`/`"connecting"`/`"disconnected"`). Match the comparison strings to whatever it actually emits.

- [ ] **Step 3: App.tsx** — add `"dashboard"` to the `Tab` union, make it the FIRST tab and the default (`useState<Tab>("dashboard")`), render `<DashboardTab />`.

- [ ] **Step 4: styles** — append to `src/styles.css`:
```css
.dashboard .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: .75rem; }
.dashboard .card { border: 1px solid #ccc; border-radius: 8px; padding: .75rem; }
.dashboard .card h3 { margin: 0 0 .25rem; font-size: .8rem; text-transform: uppercase; color: #888; }
.dashboard .card p { margin: 0; font-size: 1.1rem; font-weight: 600; }
.dashboard .card.ok { border-color: #0a0; }
.dashboard .card.warn { border-color: #e90; }
.dashboard .card.off { border-color: #c33; }
```

- [ ] **Step 5: Verify + commit**
```bash
cd /Users/leev/repo/noalbsgui
npx tsc --noEmit   # clean
npm run build      # clean
git add src/api.ts src/components/DashboardTab.tsx src/App.tsx src/styles.css
git commit -m "feat: add status Dashboard tab"
```

---

## Task 4: Manual end-to-end verification

**Files:** none.

- [ ] **Step 1:** `cd src-tauri && SDKROOT=$(xcrun --sdk macosx --show-sdk-path) cargo test` all pass (run twice — the process-capture test is timing-based but was made deterministic in P1). `npx tsc --noEmit` + `npm run build` clean.
- [ ] **Step 2:** `npm run tauri dev`. Opens on **Dashboard** — shows "stopped" with the hint.
- [ ] **Step 3:** Start noalbs (Settings). Dashboard: "running" + uptime ticking + version. With a valid OBS + config, OBS card goes Connecting→Connected; Scene card fills when a switch happens; Switcher card shows state; user appears. (Without OBS, you'll at least see "running", uptime, and the switcher/OBS "waiting"/"connecting" states from the log.)
- [ ] **Step 4:** Stop noalbs → Dashboard flips to "stopped", uptime "—" within ~1s.
- [ ] **Step 5:** Author hygiene: `git log --format='%an <%ae>%n%b' main..HEAD | grep -iE 'tomtom|claude|co-authored'` → empty.

---

## Self-review notes (against scope)
- **Status dashboard (no bitrate)** → matches the agreed scope; bitrate explicitly omitted with rationale.
- **Parsed signals**: scene+switch type, OBS connection, switcher state, user (Task 1, tested against realistic log lines incl. the Disconnected-vs-Connected disambiguation).
- **Running/uptime/version**: process state + settings (Task 2).
- **Live updates**: `noalbs-status` event on parse change + 1s poll for uptime/running (Task 3).
- **Reset on (re)start**: status cleared in `start_noalbs` so stale values don't linger across restarts.
- **Deferred:** bitrate (needs noalbs to expose it or GUI stats-polling); optional WS `sceneSwitched` cross-check (P4); themes/startup-update-check (P4).
- **Known limitation:** parsed status reflects last-seen log values while stopped (the `running:false` flag is the authority); the parser depends on noalbs's `info`-level message wording, so a future noalbs log-format change could require updating the match strings (localized to `status.rs`, covered by tests).
