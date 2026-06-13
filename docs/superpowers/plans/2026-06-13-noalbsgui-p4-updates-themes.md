# NOALBSGUI P4 (Update check + Themes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Two enhancements: (1) **startup update check + one-click update** — on launch, optionally check for a newer noalbs release and offer to update in place; (2) **themes** — light / dark / follow-system, persisted. (Release signing was considered and dropped.)

**Architecture:** Pure additive work over the merged P1–P3. The update flow reuses existing backend commands (`check_update`, `download_binary`, `restart_noalbs`) — only a settings flag and frontend UI are new. Themes add a `theme` field to `Settings` (Rust + ts-rs) and a small CSS-variable system applied at the document root; no new backend logic.

**Tech Stack:** Tauri v2 · Rust (serde, ts-rs) · React + TS. No new deps.

**Reference (current state, on `main`):**
- `Settings` = `{ binarySource, binaryPath: string|null, installedVersion: string|null, workingDir: string|null, checkUpdatesOnStartup: boolean }` (settings.rs). `checkUpdatesOnStartup` defaults `true` but is currently **unused** — no UI, no startup check.
- Commands already present: `check_update -> string | null` (newer tag, or null; note: returns the latest tag when `installedVersion` is null), `download_binary -> Settings` (downloads+extracts the latest, updates settings), `get_status -> boolean`, `restart_noalbs`, `get_settings`, `save_settings`.
- `App.tsx` renders a tab bar (Dashboard | Settings | Config | Logs). `styles.css` uses hard-coded colours (no theming yet).

---

## Repo conventions (MUST follow)
- **Commit as `weisunglee`. NEVER run `git config`. NEVER add `Co-Authored-By`/Claude/AI lines.** Plain `git commit -m`.
- **PR workflow** — branch `p4-update-themes`, never push `main`. **CI (`build-and-test`) must pass to merge** (branch protection).
- **Rust: `SDKROOT=$(xcrun --sdk macosx --show-sdk-path) cargo test|build`.** **Node 22** for npm/tsc.
- ts-rs `export_to = "../../src/bindings/"`.

---

## File structure
```
src-tauri/src/settings.rs   # MODIFY: add Theme enum + theme field (serde default)
src/theme.ts                # NEW: applyTheme() + system-theme watcher
src/components/UpdateBanner.tsx  # NEW: startup check + one-click update
src/components/SettingsTab.tsx   # MODIFY: theme selector + "check on startup" toggle
src/App.tsx                 # MODIFY: apply theme on load; render UpdateBanner
src/styles.css              # MODIFY: CSS variables (light/dark) + use them
```

---

## Task 1: Add `theme` to Settings (Rust + ts-rs)

**Files:** Modify `src-tauri/src/settings.rs`.

- [ ] **Step 1: Add the Theme enum + field**

Add the enum (note `Default` derive with `#[default]` so a missing `theme` in an old `settings.json` deserialises to `System`):

```rust
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS, Default)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub enum Theme {
    #[default]
    System,
    Light,
    Dark,
}
```

Add to `Settings` (with `#[serde(default)]` so existing settings files without the key still load):

```rust
    #[serde(default)]
    pub theme: Theme,
```

In `Settings::default()`, add `theme: Theme::System,`.

- [ ] **Step 2: Extend the roundtrip test**

In the existing `save_then_load_roundtrips` test, also set + assert the theme:
```rust
        s.theme = Theme::Dark;
```
(the existing `assert_eq!(s, loaded)` then covers it). Add a focused test that an old-style settings JSON without `theme` loads as `System`:
```rust
    #[test]
    fn missing_theme_defaults_to_system() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        std::fs::write(&path, r#"{"binarySource":"auto","binaryPath":null,"installedVersion":null,"workingDir":null,"checkUpdatesOnStartup":true}"#).unwrap();
        let s = Settings::load_from(&path).unwrap();
        assert_eq!(s.theme, Theme::System);
    }
```

- [ ] **Step 3: Test + bindings + commit**

`cd src-tauri && SDKROOT=$(xcrun --sdk macosx --show-sdk-path) cargo test settings::` → pass. Full `cargo test` → `Theme.ts` generated, `Settings.ts` updated. Commit:
```bash
git add src-tauri/src/settings.rs src/bindings
git commit -m "feat: add theme setting"
```

---

## Task 2: Theme system (frontend)

**Files:** Create `src/theme.ts`; modify `src/styles.css`, `src/App.tsx`, `src/components/SettingsTab.tsx`.

- [ ] **Step 1: `src/theme.ts`**

```ts
import type { Theme } from "./bindings/Theme";

function resolve(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme; // "light" | "dark"
}

/** Apply a theme to the document root (sets data-theme to a concrete light/dark). */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = resolve(theme);
}

/** Re-apply when the OS theme changes, but only while the setting is "system".
 * Returns an unsubscribe fn. `getTheme` is read live so it always sees the latest. */
export function watchSystemTheme(getTheme: () => Theme): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    if (getTheme() === "system") applyTheme("system");
  };
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}
```

> The generated `Theme.ts` values are `"system" | "light" | "dark"` (serde camelCase on the enum variants). Confirm against `src/bindings/Theme.ts` and match the string comparisons.

- [ ] **Step 2: `styles.css` — variables + light/dark palettes**

Prepend a variables block and a base, then convert the existing hard-coded colours to variables:

```css
:root {
  --bg: #ffffff; --fg: #1a1a1a; --muted: #666; --border: #ccc;
  --error: #c00; --ok: #0a0; --warn: #e90;
  --card-bg: #fafafa; --input-bg: #fff; --input-fg: #1a1a1a;
  --logs-bg: #111; --logs-fg: #ddd; --banner-bg: #e8f0fe;
}
:root[data-theme="dark"] {
  --bg: #1e1e1e; --fg: #e6e6e6; --muted: #9a9a9a; --border: #3a3a3a;
  --error: #ff6b6b; --ok: #5cc85c; --warn: #e0a020;
  --card-bg: #262626; --input-bg: #2b2b2b; --input-fg: #e6e6e6;
  --logs-bg: #0d0d0d; --logs-fg: #dddddd; --banner-bg: #243447;
}
html, body { margin: 0; background: var(--bg); color: var(--fg); }
input, select, textarea, button {
  background: var(--input-bg); color: var(--input-fg);
  border: 1px solid var(--border); border-radius: 4px; padding: .15rem .35rem;
}
```

Then update the existing rules to use the variables:
- `.path { color: var(--muted); ... }`
- `.error { color: var(--error); }`
- `.update { color: var(--ok); }`
- `.note { color: var(--muted); ... }`
- `.logs-list { background: var(--logs-bg); color: var(--logs-fg); ... }`
- `.server-entry { border: 1px solid var(--border); ... }`
- `.dashboard .card { border: 1px solid var(--border); background: var(--card-bg); ... }`
- `.dashboard .card h3 { color: var(--muted); ... }`
- `.dashboard .card.ok { border-color: var(--ok); }` / `.warn { border-color: var(--warn); }` / `.off { border-color: var(--error); }`

> Known limitation: the CodeMirror raw-JSON editor (Config → Advanced) renders with its own light theme and won't follow dark mode in P4. Acceptable; a `@codemirror/theme-one-dark` swap can be a later polish. Note it, don't scope-creep.

- [ ] **Step 3: Apply theme in `App.tsx`**

On mount, load settings, apply the theme, and watch system changes. Add near the top of `App()`:
```tsx
import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { applyTheme, watchSystemTheme } from "./theme";
import type { Theme } from "./bindings/Theme";
// ...
  const themeRef = useRef<Theme>("system");
  useEffect(() => {
    api.getSettings().then((s) => { themeRef.current = s.theme; applyTheme(s.theme); }).catch(() => {});
    const unwatch = watchSystemTheme(() => themeRef.current);
    return unwatch;
  }, []);
```
(Keep the existing tab state/render. The `themeRef` lets the SettingsTab's live changes be reflected by the system watcher — see Step 4, which updates `themeRef` via a window event.)

To let the SettingsTab notify App of a theme change without prop-drilling, use a tiny custom event: in App's effect also add
```tsx
    const onThemeChange = (e: Event) => { themeRef.current = (e as CustomEvent<Theme>).detail; };
    window.addEventListener("themechange", onThemeChange as EventListener);
```
and unsubscribe it in the cleanup alongside `unwatch`.

- [ ] **Step 4: Theme selector in `SettingsTab.tsx`**

Read the current `SettingsTab.tsx`. Add an "Appearance" section. It must: read the current theme from settings, on change call `api.saveSettings({ ...settings, theme })`, `applyTheme(theme)`, and dispatch `window.dispatchEvent(new CustomEvent("themechange", { detail: theme }))` so App's system-watcher tracks it. Example control:
```tsx
// imports: import { applyTheme } from "../theme"; import type { Theme } from "../bindings/Theme";
<section>
  <h2>Appearance</h2>
  <label>Theme
    <select value={settings.theme} onChange={(e) => {
      const theme = e.target.value as Theme;
      const next = { ...settings, theme };
      setSettings(next);
      api.saveSettings(next);
      applyTheme(theme);
      window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
    }}>
      <option value="system">Follow system</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>
</section>
```
(Adapt to the SettingsTab's existing `settings`/`setSettings` state names.)

- [ ] **Step 5: Verify + commit**

```bash
cd /Users/leev/repo/noalbsgui
npx tsc --noEmit && npm run build
git add src/theme.ts src/styles.css src/App.tsx src/components/SettingsTab.tsx
git commit -m "feat: add light/dark/system theme"
```

---

## Task 3: Startup update check + one-click update

**Files:** Create `src/components/UpdateBanner.tsx`; modify `src/App.tsx`, `src/components/SettingsTab.tsx`.

- [ ] **Step 1: `UpdateBanner.tsx`**

```tsx
import { useEffect, useState } from "react";
import { api } from "../api";

export function UpdateBanner() {
  const [tag, setTag] = useState<string | null>(null);   // newer version tag, if any
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await api.getSettings();
        // Only auto-check when enabled AND a version is actually installed
        // (otherwise check_update reports the latest tag as an "update").
        if (!s.checkUpdatesOnStartup || !s.installedVersion) return;
        const newer = await api.checkUpdate();
        if (newer) setTag(newer);
      } catch {
        /* offline / no network — silently skip the startup check */
      }
    })();
  }, []);

  if (!tag || dismissed) return null;

  const update = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api.downloadBinary();
      const running = await api.getStatus();
      if (running && confirm("Updated. Restart noalbs now to run the new version?")) {
        await api.restart();
      }
      setMsg(`Updated to ${tag}.`);
      setTag(null);
    } catch (e) {
      setMsg(`Update failed: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="update-banner">
      <span>A new noalbs version is available: <strong>{tag}</strong>.</span>
      <button disabled={busy} onClick={update}>{busy ? "Updating…" : "Update now"}</button>
      <button disabled={busy} onClick={() => setDismissed(true)}>Dismiss</button>
      {msg && <span className="note">{msg}</span>}
    </div>
  );
}
```

- [ ] **Step 2: Render it in `App.tsx`** — add `<UpdateBanner />` just inside `.app`, above the `<nav className="tabs">`.

- [ ] **Step 3: "Check for updates on startup" toggle in `SettingsTab.tsx`**

In the Appearance/Updates area, add a checkbox bound to `settings.checkUpdatesOnStartup`, saving via `api.saveSettings`:
```tsx
<label>
  <input type="checkbox" checked={settings.checkUpdatesOnStartup}
    onChange={(e) => { const next = { ...settings, checkUpdatesOnStartup: e.target.checked }; setSettings(next); api.saveSettings(next); }} />
  Check for noalbs updates on startup
</label>
```

- [ ] **Step 4: Banner styles** — append to `styles.css`:
```css
.update-banner {
  display: flex; align-items: center; gap: .5rem; flex-wrap: wrap;
  background: var(--banner-bg); border: 1px solid var(--border);
  border-radius: 6px; padding: .5rem .75rem; margin-bottom: .75rem;
}
```

- [ ] **Step 5: Verify + commit**
```bash
cd /Users/leev/repo/noalbsgui
npx tsc --noEmit && npm run build
git add src/components/UpdateBanner.tsx src/App.tsx src/components/SettingsTab.tsx src/styles.css
git commit -m "feat: startup update check with one-click update"
```

---

## Task 4: Manual end-to-end verification

**Files:** none.

- [ ] **Step 1:** `cd src-tauri && SDKROOT=$(xcrun --sdk macosx --show-sdk-path) cargo test` all pass (run twice). `npx tsc --noEmit` + `npm run build` clean.
- [ ] **Step 2:** `npm run tauri dev`. **Theme:** Settings → Appearance → switch Light/Dark/Follow-system; UI recolours immediately; restart the app and confirm the choice persisted. With "Follow system", flip the OS appearance and confirm the app follows live.
- [ ] **Step 3:** **Update check:** with a binary already downloaded and "Check on startup" on, simulate an update by editing the stored `installedVersion` to an older value (e.g. via the Advanced settings or by re-downloading then hand-editing `settings.json`), relaunch → the banner appears. Click **Update now** → it re-downloads, offers restart if running, banner clears. Toggle the startup checkbox off → relaunch → no banner/check.
- [ ] **Step 4:** No binary installed → no banner (first-run is handled by the Settings download button, not the update banner).
- [ ] **Step 5:** Author hygiene: `git log --format='%an <%ae>%n%b' main..HEAD | grep -iE 'tomtom|claude|co-authored'` → empty.

---

## Self-review notes (against scope)
- **Startup update check + one-click update** → Task 3 (reuses `check_update`/`download_binary`/`restart`; guarded so it only prompts when a version is installed and the setting is on; wires the previously-dead `checkUpdatesOnStartup` flag).
- **Themes (light/dark/system)** → Tasks 1–2 (`Theme` setting + CSS variables + live system following + persisted selector).
- **No backend logic added for updates** — only the `theme` field; the update commands already existed.
- **Dropped:** release signing/notarization (needs paid certs the maintainer opted out of); WebSocket (low value).
- **Known limitations:** the CodeMirror JSON editor doesn't follow dark mode yet (cosmetic); the "simulate an update" verification needs a manual version downgrade since we can't force the real latest to be newer.
