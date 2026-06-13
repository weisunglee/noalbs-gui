# NOALBSGUI P2a (Config Model + Core Editor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Model NOALBS's entire `config.json` as Rust types (round-trip-faithful to noalbs v2), expose load/save Tauri commands with a save-then-restart prompt, and build the config editor's core: a form for the fixed sections (switcher, triggers, switching scenes, OBS connection, optional scenes/options) plus an "Advanced" raw-JSON tab that syncs with the form on tab switch.

**Architecture:** The Rust `config.rs` defines plain serde structs/enums that mirror noalbs's JSON wire format exactly (we mirror the data, not noalbs's trait-object machinery). TypeScript types are generated via `ts-rs`. A new Config tab in React edits the form; the backend is the validation source of truth (save = deserialize + write atomically). streamServers and chat are carried faithfully by the model and editable via the raw-JSON tab in P2a; friendly editors for them come in P2b/P2c.

**Tech Stack:** Tauri v2 · Rust (serde, ts-rs) · React + TypeScript · CodeMirror (raw-JSON editor).

**Reference:** Spec `docs/superpowers/specs/2026-06-13-noalbsgui-design.md`. NOALBS v2 source of truth for the schema: `src/config.rs`, `src/switcher.rs`, and `src/stream_servers/*.rs` on the `v2` branch of NOALBS/nginx-obs-automatic-low-bitrate-switching. P1 already built `settings.rs` (with `working_dir`), `process.rs` (ProcessManager), and `commands.rs` (AppState).

---

## Repo conventions (MUST follow)
- **Commit as `weisunglee`. NEVER run `git config`. NEVER add a `Co-Authored-By`/Claude/AI line.** Just `git commit -m "..."` — the per-repo identity is already correct. (Subagents previously broke this by resetting git config; do not touch it.)
- **Integrate via PR, never push to `main`.** Work on branch `p2a-config-model`; the PR is opened/merged separately.
- **Rust builds need SDKROOT:** always `SDKROOT=$(xcrun --sdk macosx --show-sdk-path) cargo test|build`.
- **Node 22** is required (`.nvmrc`); use it for `npm`/`tsc`.
- ts-rs `#[ts(export, export_to = "../../src/bindings/")]` resolves relative to the source file dir and correctly lands in `noalbsgui/src/bindings/` (verified in P1).

---

## File structure
```
src-tauri/src/
  config.rs        # NEW: full Config schema (serde + ts-rs), load/save, atomic write
  commands.rs      # MODIFY: add get_config / save_config / config_path commands
src/
  bindings/        # NEW generated: Config.ts, Switcher.ts, Triggers.ts, SwitchingScenes.ts,
                   #   StreamServerEntry.ts, StreamServerKind.ts, SoftwareConnection.ts,
                   #   Chat.ts, ChatPlatform.ts, OptionalScenes.ts, OptionalOptions.ts, User.ts, ...
  api.ts           # MODIFY: add getConfig/saveConfig wrappers
  config/          # NEW frontend module
    ConfigTab.tsx        # tab container: Form | Advanced(JSON) sub-tabs + Save bar
    useConfig.ts         # load/dirty/save state hook
    sections/
      SwitcherSection.tsx
      ScenesSection.tsx        # switchingScenes + optionalScenes
      ObsSection.tsx           # software (OBS connection)
      OptionsSection.tsx       # optionalOptions
    RawJsonEditor.tsx          # CodeMirror JSON editor
  App.tsx          # MODIFY: add "Config" tab
```

---

## Task 1: Config model — fixed sections (Rust + ts-rs)

**Files:** Create `src-tauri/src/config.rs`; modify `src-tauri/src/lib.rs`.

This task models everything EXCEPT the stream-server variants and chat (those are Task 2). Use `serde_json::Value` placeholders for `stream_servers` and `chat` here so the model round-trips real configs from day one; Task 2 replaces the placeholders with typed models.

- [ ] **Step 1: Write the failing test + the model**

Create `src-tauri/src/config.rs`:

```rust
use std::collections::HashMap;
use std::path::Path;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::error::AppError;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub user: User,
    pub switcher: Switcher,
    pub software: SoftwareConnection,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chat: Option<serde_json::Value>, // typed in Task 2 (P2c)
    #[serde(default)]
    pub optional_scenes: OptionalScenes,
    #[serde(default)]
    pub optional_options: OptionalOptions,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: Option<i64>,
    pub name: String,
    pub password_hash: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct Switcher {
    pub bitrate_switcher_enabled: bool,
    pub only_switch_when_streaming: bool,
    pub instantly_switch_on_recover: bool,
    pub auto_switch_notification: bool,
    pub retry_attempts: u8,
    pub triggers: Triggers,
    pub switching_scenes: SwitchingScenes,
    /// Typed in Task 2 (P2b). Carried verbatim for now so configs round-trip.
    #[serde(default)]
    pub stream_servers: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct Triggers {
    pub low: Option<u32>,
    pub rtt: Option<u32>,
    pub offline: Option<u32>,
    pub rtt_offline: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct SwitchingScenes {
    pub normal: String,
    pub low: String,
    pub offline: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(tag = "type")]
pub enum SoftwareConnection {
    Obs(ObsConfig),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct ObsConfig {
    pub host: String,
    pub password: Option<String>,
    pub port: u16,
    pub collections: Option<HashMap<String, CollectionPair>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct CollectionPair {
    pub profile: String,
    pub collection: String,
}

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct OptionalScenes {
    pub starting: Option<String>,
    pub ending: Option<String>,
    pub privacy: Option<String>,
    pub refresh: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct OptionalOptions {
    pub twitch_transcoding_check: bool,
    pub twitch_transcoding_retries: u64,
    pub twitch_transcoding_delay_seconds: u64,
    pub offline_timeout: Option<u32>,
    pub record_while_streaming: bool,
    pub switch_to_starting_scene_on_stream_start: bool,
    pub switch_from_starting_scene_to_live_scene: bool,
}

impl Default for OptionalOptions {
    fn default() -> Self {
        Self {
            twitch_transcoding_check: false,
            twitch_transcoding_retries: 5,
            twitch_transcoding_delay_seconds: 15,
            offline_timeout: None,
            record_while_streaming: false,
            switch_to_starting_scene_on_stream_start: false,
            switch_from_starting_scene_to_live_scene: false,
        }
    }
}

impl Config {
    pub fn load_from(path: &Path) -> Result<Self, AppError> {
        let s = std::fs::read_to_string(path)?;
        Ok(serde_json::from_str(&s)?)
    }

    /// Validate by deserializing the given JSON string into a Config, then write
    /// it atomically (temp file + rename) pretty-printed.
    pub fn save_str(path: &Path, json: &str) -> Result<Self, AppError> {
        let config: Config = serde_json::from_str(json)?;
        Self::write(path, &config)?;
        Ok(config)
    }

    pub fn write(path: &Path, config: &Config) -> Result<(), AppError> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let tmp = path.with_extension("json.tmp");
        std::fs::write(&tmp, serde_json::to_string_pretty(config)?)?;
        std::fs::rename(&tmp, path)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // The real example config.json from the NOALBS v2 README, trimmed to the
    // fields this task models (streamServers/chat kept as opaque JSON).
    const SAMPLE: &str = r#"{
      "user": { "id": null, "name": "example", "passwordHash": null },
      "switcher": {
        "bitrateSwitcherEnabled": true,
        "onlySwitchWhenStreaming": false,
        "instantlySwitchOnRecover": true,
        "autoSwitchNotification": true,
        "retryAttempts": 5,
        "triggers": { "low": 500, "rtt": 1000, "offline": 450 },
        "switchingScenes": { "normal": "Live", "low": "Low", "offline": "Disconnected" },
        "streamServers": [
          { "streamServer": { "type": "Belabox", "statsUrl": "http://x/stats", "publisher": "p" },
            "name": "BELABOX", "priority": 0, "overrideScenes": null, "dependsOn": null, "enabled": true }
        ]
      },
      "software": { "type": "Obs", "host": "localhost", "password": "pw", "port": 4455,
        "collections": { "twitch": { "profile": "p", "collection": "c" } } },
      "chat": { "platform": "Twitch", "username": "example", "admins": ["a"], "language": "EN", "prefix": "!" },
      "optionalScenes": { "starting": null, "ending": null, "privacy": "privacy", "refresh": null },
      "optionalOptions": { "twitchTranscodingCheck": false, "twitchTranscodingRetries": 5,
        "twitchTranscodingDelaySeconds": 15, "offlineTimeout": null, "recordWhileStreaming": false,
        "switchToStartingSceneOnStreamStart": false, "switchFromStartingSceneToLiveScene": false }
    }"#;

    #[test]
    fn parses_real_sample_config() {
        let c: Config = serde_json::from_str(SAMPLE).unwrap();
        assert_eq!(c.user.name, "example");
        assert_eq!(c.switcher.retry_attempts, 5);
        assert_eq!(c.switcher.switching_scenes.normal, "Live");
        assert_eq!(c.switcher.triggers.low, Some(500));
        assert_eq!(c.switcher.stream_servers.len(), 1); // carried as opaque JSON
        let SoftwareConnection::Obs(obs) = &c.software;
        assert_eq!(obs.port, 4455);
        assert_eq!(obs.password.as_deref(), Some("pw"));
        assert_eq!(c.optional_scenes.privacy.as_deref(), Some("privacy"));
    }

    #[test]
    fn save_str_validates_and_roundtrips() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.json");
        let saved = Config::save_str(&path, SAMPLE).unwrap();
        assert_eq!(saved.switcher.switching_scenes.low, "Low");
        // reload from disk equals what we saved
        let reloaded = Config::load_from(&path).unwrap();
        assert_eq!(reloaded, saved);
        // stream server JSON preserved verbatim through the round-trip
        assert_eq!(reloaded.switcher.stream_servers[0]["streamServer"]["type"], "Belabox");
    }

    #[test]
    fn save_str_rejects_invalid_json() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.json");
        let err = Config::save_str(&path, "{ not valid").unwrap_err();
        assert!(matches!(err, AppError::Json(_)));
        // the bad save must NOT have created the file
        assert!(!path.exists());
    }
}
```

In `src-tauri/src/lib.rs` add `pub mod config;` alongside the other module declarations.

- [ ] **Step 2: Run tests**

Run: `cd /Users/leev/repo/noalbsgui/src-tauri && SDKROOT=$(xcrun --sdk macosx --show-sdk-path) cargo test config::`
Expected: 3 tests pass. Then `SDKROOT=... cargo test` (full) to emit bindings; confirm `src/bindings/Config.ts`, `Switcher.ts`, `Triggers.ts`, `SwitchingScenes.ts`, `SoftwareConnection.ts`, `ObsConfig.ts`, `CollectionPair.ts`, `OptionalScenes.ts`, `OptionalOptions.ts`, `User.ts` exist and no stray `/Users/leev/repo/src/bindings`.

> Note on `serde_json::Value` + ts-rs: it maps to `JsonValue`/`any`. If the `Config`/`Switcher` `#[derive(TS)]` fails to compile because of the `serde_json::Value` fields, add `#[ts(type = "any")]` on `pub chat` and on `pub stream_servers` (as `#[ts(type = "any[]")]`). Make it compile; the types get replaced in Task 2.

- [ ] **Step 3: Commit**

```bash
cd /Users/leev/repo/noalbsgui
git add src-tauri/src/config.rs src-tauri/src/lib.rs src/bindings
git commit -m "feat: model NOALBS config (fixed sections) with ts-rs export"
```

---

## Task 2: Config model — stream servers + chat (typed)

**Files:** Modify `src-tauri/src/config.rs`.

Replace the two `serde_json::Value` placeholders with typed models ported faithfully from NOALBS v2. **You MUST verify exact field names against the noalbs source** — read each `src/stream_servers/<name>.rs` (raw URL base `https://raw.githubusercontent.com/NOALBS/nginx-obs-automatic-low-bitrate-switching/v2/`) for the per-type fields, and `src/chat/mod.rs` for `ChatLanguage`, `Command`, and `Permission` enums. Do not guess field names.

- [ ] **Step 1: Add the typed StreamServer model**

Add to `config.rs` (and update `Switcher.stream_servers` to `Vec<StreamServerEntry>`):

```rust
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct StreamServerEntry {
    pub stream_server: StreamServerKind,
    pub name: String,
    pub priority: Option<i32>,
    pub override_scenes: Option<SwitchingScenes>,
    pub depends_on: Option<DependsOn>,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

fn default_true() -> bool { true }

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct DependsOn {
    pub name: String,
    pub backup_scenes: SwitchingScenes,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct ServerAuth {
    pub username: String,
    pub password: String,
}

/// Mirrors noalbs's typetag-tagged stream server. JSON: {"type":"Nginx", ...}.
/// VERIFY each variant's fields against src/stream_servers/<name>.rs.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum StreamServerKind {
    Nginx { stats_url: String, application: String, key: String },
    NodeMediaServer { stats_url: String, application: String, key: String, auth: Option<ServerAuth> },
    Nimble { stats_url: String, id: String, application: String, key: String },
    SrtLiveServer { stats_url: String, publisher: String, api_key: Option<String> },
    Belabox { stats_url: String, publisher: String },
    Mediamtx { stats_url: String, auth: Option<ServerAuth> },
    Rist { stats_url: String },
    Xiu { stats_url: String, application: String, key: String },
    #[serde(rename = "OpenIRL")]
    OpenIrl { stats_url: String },
    Irlhosting { stats_url: String, application: Option<String>, key: Option<String>, publisher: Option<String> },
}
```

Update `Switcher`: change `pub stream_servers: Vec<serde_json::Value>` to `pub stream_servers: Vec<StreamServerEntry>` (keep `#[serde(default)]`).

> The fields above are derived from the README and the v1→v2 conversion code. CONFIRM each against the actual struct in `src/stream_servers/<name>.rs` — in particular field optionality and any `#[serde(rename)]`. The `OpenIRL` variant's JSON `type` is the string `"OpenIRL"` (hence the explicit rename). Note noalbs's per-server structs hold a `client: reqwest::Client` field marked `#[serde(skip)]`/default — we do NOT model that (it's runtime-only, not in the JSON).

- [ ] **Step 2: Add the typed Chat model**

Add (and change `Config.chat` to `Option<Chat>`):

```rust
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct Chat {
    pub platform: ChatPlatform,
    pub username: String,
    pub admins: Vec<String>,
    #[serde(default)]
    pub ignore_users: Vec<String>,
    pub language: String, // ChatLanguage enum value, e.g. "EN" (see note)
    pub prefix: String,
    pub enable_public_commands: bool,
    pub enable_mod_commands: bool,
    pub enable_auto_stop_stream_on_host_or_raid: bool,
    pub announce_raid_on_auto_stop: bool,
    pub commands: Option<HashMap<String, CommandInfo>>,
}

/// noalbs serializes this externally-tagged: "Twitch" | {"Kick": {...}}.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
pub enum ChatPlatform {
    Twitch,
    Kick(KickConfig),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct KickConfig {
    pub channel_id: Option<usize>,
    pub chatroom_id: Option<usize>,
    pub use_irlproxy: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct CommandInfo {
    pub permission: Option<String>,        // Permission enum value (e.g. "Mod")
    pub user_permissions: Option<Vec<String>>,
    pub alias: Option<Vec<String>>,
}
```

> `language` and `permission` are modeled as `String` here (not the noalbs enums) to keep P2a's model independent of noalbs's `chat` module; the friendly dropdowns with the fixed value set come in P2c. They round-trip identically because the JSON is the same string.

- [ ] **Step 3: Strengthen the round-trip test with real data**

Replace the opaque-JSON assertions in the existing tests and add a comprehensive round-trip test using the FULL example config.json from the NOALBS v2 README (paste the complete example as a `const FULL_SAMPLE: &str`). Assert: it deserializes, the first stream server is `StreamServerKind::Belabox { .. }`, `chat` is `Some` with `platform == ChatPlatform::Twitch`, and `serde_json::to_value(&config)` re-serializes to a structurally-equal value (parse both into `serde_json::Value` and `assert_eq!`). This proves byte-level wire compatibility with noalbs.

```rust
    #[test]
    fn full_config_roundtrips_structurally() {
        let original: serde_json::Value = serde_json::from_str(FULL_SAMPLE).unwrap();
        let config: Config = serde_json::from_value(original.clone()).unwrap();
        let reserialized = serde_json::to_value(&config).unwrap();
        assert_eq!(original, reserialized, "config did not round-trip identically");
    }
```

> If `assert_eq!` fails, the diff tells you which field name/shape is wrong — fix the model to match noalbs exactly. This test is the acceptance gate for schema fidelity. Watch for: optional fields that noalbs omits vs emits as `null` (use `#[serde(skip_serializing_if = "Option::is_none")]` where noalbs omits them, but the README example shows `null`s, so prefer emitting nulls to match — verify against the example), and `priority`/`overrideScenes`/`dependsOn` being present-as-null.

- [ ] **Step 4: Run tests + regenerate bindings**

Run: `cd /Users/leev/repo/noalbsgui/src-tauri && SDKROOT=$(xcrun --sdk macosx --show-sdk-path) cargo test config::`
Expected: all config tests pass, including `full_config_roundtrips_structurally`. Run full `cargo test` to regenerate bindings (`StreamServerEntry.ts`, `StreamServerKind.ts`, `Chat.ts`, `ChatPlatform.ts`, `KickConfig.ts`, `DependsOn.ts`, `ServerAuth.ts`, `CommandInfo.ts`).

- [ ] **Step 5: Commit**

```bash
cd /Users/leev/repo/noalbsgui
git add src-tauri/src/config.rs src/bindings
git commit -m "feat: type stream servers and chat in config model"
```

---

## Task 3: Tauri commands — get/save config + restart signal

**Files:** Modify `src-tauri/src/commands.rs`.

- [ ] **Step 1: Add commands**

The config lives at `<working_dir>/config.json`. `working_dir` is in `Settings`; if unset, fall back to the binary's parent dir (same rule `start_noalbs` uses). Add a helper and three commands:

```rust
use crate::config::Config;

fn config_path(s: &crate::settings::Settings) -> AppResult<PathBuf> {
    let dir = s.working_dir.clone().or_else(|| {
        s.binary_path.as_ref().and_then(|b| b.parent().map(|p| p.to_path_buf()))
    });
    dir.map(|d| d.join("config.json")).ok_or(AppError::Other(
        "no working directory or binary path set".into(),
    ))
}

/// Returns the parsed config, or None if no config.json exists yet.
#[tauri::command]
pub async fn get_config(state: State<'_, AppState>) -> AppResult<Option<Config>> {
    let s = state.settings.lock().await.clone();
    let path = config_path(&s)?;
    if !path.exists() {
        return Ok(None);
    }
    Ok(Some(Config::load_from(&path)?))
}

/// Validate + save the given JSON string as config.json. Returns the parsed
/// Config and whether noalbs is currently running (so the UI can prompt to restart).
#[derive(serde::Serialize, ts_rs::TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct SaveConfigResult {
    pub config: Config,
    pub running: bool,
}

#[tauri::command]
pub async fn save_config(state: State<'_, AppState>, json: String) -> AppResult<SaveConfigResult> {
    let s = state.settings.lock().await.clone();
    let path = config_path(&s)?;
    let config = Config::save_str(&path, &json)?;
    let running = state.process.lock().await.is_running();
    Ok(SaveConfigResult { config, running })
}
```

Register `get_config` and `save_config` in `lib.rs`'s `generate_handler!`.

> `restart_noalbs` already exists from P1 — the frontend calls it when the user accepts the restart prompt. No new restart command needed.

- [ ] **Step 2: Build + regression test**

Run: `cd /Users/leev/repo/noalbsgui/src-tauri && SDKROOT=$(xcrun --sdk macosx --show-sdk-path) cargo build && SDKROOT=$(xcrun --sdk macosx --show-sdk-path) cargo test`
Expected: builds; all existing tests still pass. (These commands are integration glue; they're exercised in Task 8's manual run.)

- [ ] **Step 3: Commit**

```bash
cd /Users/leev/repo/noalbsgui
git add src-tauri/src/commands.rs src-tauri/src/lib.rs src/bindings
git commit -m "feat: add get_config/save_config commands"
```

---

## Task 4: Frontend API + config state hook

**Files:** Modify `src/api.ts`; create `src/config/useConfig.ts`.

- [ ] **Step 1: Extend api.ts**

Add to the `api` object in `src/api.ts`:

```ts
import type { Config } from "./bindings/Config";
import type { SaveConfigResult } from "./bindings/SaveConfigResult";
// ...existing...
  getConfig: () => invoke<Config | null>("get_config"),
  saveConfig: (json: string) => invoke<SaveConfigResult>("save_config", { json }),
```

- [ ] **Step 2: Create the config state hook**

Create `src/config/useConfig.ts`:

```ts
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { Config } from "../bindings/Config";

export type ConfigState = {
  config: Config | null;
  loaded: boolean;
  missing: boolean; // no config.json yet
  error: string | null;
  setConfig: (c: Config) => void;
  reload: () => Promise<void>;
  save: () => Promise<{ running: boolean }>;
};

export function useConfig(): ConfigState {
  const [config, setConfigState] = useState<Config | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const c = await api.getConfig();
      setMissing(c === null);
      setConfigState(c);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const save = useCallback(async () => {
    if (!config) throw new Error("no config to save");
    const res = await api.saveConfig(JSON.stringify(config, null, 2));
    setConfigState(res.config);
    setMissing(false);
    return { running: res.running };
  }, [config]);

  return {
    config,
    loaded,
    missing,
    error,
    setConfig: setConfigState,
    reload,
    save,
  };
}
```

- [ ] **Step 3: Type-check + commit**

Run: `cd /Users/leev/repo/noalbsgui && npx tsc --noEmit` — expect failures only for the not-yet-created components imported elsewhere; `api.ts` and `useConfig.ts` themselves must type-check. (If `tsc` errors only reference Task 5+ files, that's expected at this step.)

```bash
git add src/api.ts src/config/useConfig.ts
git commit -m "feat: add config API wrappers and useConfig hook"
```

---

## Task 5: Fixed-section form components

**Files:** Create `src/config/sections/{SwitcherSection,ScenesSection,ObsSection,OptionsSection}.tsx`.

Each component receives `{ config, onChange }` where `onChange(next: Config)` replaces the config. Use controlled inputs bound to the typed fields. Below is `SwitcherSection`; the others follow the same pattern over their fields.

- [ ] **Step 1: SwitcherSection**

Create `src/config/sections/SwitcherSection.tsx`:

```tsx
import type { Config } from "../../bindings/Config";

export function SwitcherSection({ config, onChange }: { config: Config; onChange: (c: Config) => void }) {
  const sw = config.switcher;
  const set = (patch: Partial<typeof sw>) => onChange({ ...config, switcher: { ...sw, ...patch } });
  const setTrig = (patch: Partial<typeof sw.triggers>) =>
    onChange({ ...config, switcher: { ...sw, triggers: { ...sw.triggers, ...patch } } });
  const setScene = (patch: Partial<typeof sw.switchingScenes>) =>
    onChange({ ...config, switcher: { ...sw, switchingScenes: { ...sw.switchingScenes, ...patch } } });

  const numOrNull = (v: string): number | null => (v.trim() === "" ? null : Number(v));

  return (
    <fieldset>
      <legend>Switcher</legend>
      <label><input type="checkbox" checked={sw.bitrateSwitcherEnabled}
        onChange={(e) => set({ bitrateSwitcherEnabled: e.target.checked })} /> Bitrate switcher enabled</label>
      <label><input type="checkbox" checked={sw.onlySwitchWhenStreaming}
        onChange={(e) => set({ onlySwitchWhenStreaming: e.target.checked })} /> Only switch when streaming</label>
      <label><input type="checkbox" checked={sw.instantlySwitchOnRecover}
        onChange={(e) => set({ instantlySwitchOnRecover: e.target.checked })} /> Instantly switch on recover</label>
      <label><input type="checkbox" checked={sw.autoSwitchNotification}
        onChange={(e) => set({ autoSwitchNotification: e.target.checked })} /> Auto switch notification</label>
      <label>Retry attempts <input type="number" min={0} max={255} value={sw.retryAttempts}
        onChange={(e) => set({ retryAttempts: Number(e.target.value) })} /></label>

      <h4>Triggers (kbps / ms)</h4>
      <label>Low <input type="number" value={sw.triggers.low ?? ""} onChange={(e) => setTrig({ low: numOrNull(e.target.value) })} /></label>
      <label>RTT <input type="number" value={sw.triggers.rtt ?? ""} onChange={(e) => setTrig({ rtt: numOrNull(e.target.value) })} /></label>
      <label>Offline <input type="number" value={sw.triggers.offline ?? ""} onChange={(e) => setTrig({ offline: numOrNull(e.target.value) })} /></label>
      <label>RTT offline <input type="number" value={sw.triggers.rttOffline ?? ""} onChange={(e) => setTrig({ rttOffline: numOrNull(e.target.value) })} /></label>

      <h4>Switching scenes</h4>
      <label>Normal <input value={sw.switchingScenes.normal} onChange={(e) => setScene({ normal: e.target.value })} /></label>
      <label>Low <input value={sw.switchingScenes.low} onChange={(e) => setScene({ low: e.target.value })} /></label>
      <label>Offline <input value={sw.switchingScenes.offline} onChange={(e) => setScene({ offline: e.target.value })} /></label>
    </fieldset>
  );
}
```

- [ ] **Step 2: ScenesSection** (optionalScenes — four optional text fields starting/ending/privacy/refresh)

Create `src/config/sections/ScenesSection.tsx`:

```tsx
import type { Config } from "../../bindings/Config";

export function ScenesSection({ config, onChange }: { config: Config; onChange: (c: Config) => void }) {
  const os = config.optionalScenes;
  const set = (patch: Partial<typeof os>) => onChange({ ...config, optionalScenes: { ...os, ...patch } });
  const orNull = (v: string): string | null => (v.trim() === "" ? null : v);
  return (
    <fieldset>
      <legend>Optional scenes</legend>
      <label>Starting <input value={os.starting ?? ""} onChange={(e) => set({ starting: orNull(e.target.value) })} /></label>
      <label>Ending <input value={os.ending ?? ""} onChange={(e) => set({ ending: orNull(e.target.value) })} /></label>
      <label>Privacy <input value={os.privacy ?? ""} onChange={(e) => set({ privacy: orNull(e.target.value) })} /></label>
      <label>Refresh <input value={os.refresh ?? ""} onChange={(e) => set({ refresh: orNull(e.target.value) })} /></label>
    </fieldset>
  );
}
```

- [ ] **Step 3: ObsSection** (software → OBS connection: host, port, password (secret-style), collections left to raw JSON for now)

Create `src/config/sections/ObsSection.tsx`:

```tsx
import { useState } from "react";
import type { Config } from "../../bindings/Config";

export function ObsSection({ config, onChange }: { config: Config; onChange: (c: Config) => void }) {
  const [show, setShow] = useState(false);
  // SoftwareConnection is { type: "Obs", host, password, port, collections }
  const obs = config.software;
  const set = (patch: Partial<typeof obs>) => onChange({ ...config, software: { ...obs, ...patch } });
  return (
    <fieldset>
      <legend>OBS connection</legend>
      <label>Host <input value={obs.host} onChange={(e) => set({ host: e.target.value })} /></label>
      <label>Port <input type="number" value={obs.port} onChange={(e) => set({ port: Number(e.target.value) })} /></label>
      <label>Password
        <input type={show ? "text" : "password"} value={obs.password ?? ""}
          onChange={(e) => set({ password: e.target.value === "" ? null : e.target.value })} />
        <button type="button" onClick={() => setShow((s) => !s)}>{show ? "hide" : "show"}</button>
      </label>
    </fieldset>
  );
}
```

> Note: `config.software` is the tagged enum serialized as `{type:"Obs", host, password, port, collections}`. In the generated TS, `SoftwareConnection` is `{ type: "Obs" } & ObsConfig`-shaped; access `config.software.host` etc. directly. Verify against the generated `SoftwareConnection.ts` and adapt field access if ts-rs nests it (e.g. if it generates `{ type: "Obs" } & { ... }` vs a wrapper). Keep the spread working with the actual shape.

- [ ] **Step 4: OptionsSection** (optionalOptions — the 4 booleans + transcoding numbers + offlineTimeout optional number)

Create `src/config/sections/OptionsSection.tsx` following the same controlled-input pattern over `config.optionalOptions` fields: `twitchTranscodingCheck` (checkbox), `twitchTranscodingRetries`/`twitchTranscodingDelaySeconds` (number, note these are `bigint` in bindings since u64 — bind with `value={String(v)}` and write `BigInt(e.target.value)`), `offlineTimeout` (optional number, u32 → number), `recordWhileStreaming`, `switchToStartingSceneOnStreamStart`, `switchFromStartingSceneToLiveScene` (checkboxes).

> Important: u64 fields (`twitchTranscodingRetries`, `twitchTranscodingDelaySeconds`) are `bigint` in the generated types. Use `value={String(oo.twitchTranscodingRetries)}` and `onChange={e => set({ twitchTranscodingRetries: BigInt(e.target.value || 0) })}`. u32/u8/u16 fields (`offlineTimeout`, `retryAttempts`, `port`, triggers) are `number`. Check each generated `.ts` to use the right JS type.

- [ ] **Step 5: tsc + commit**

`npx tsc --noEmit` will still fail on the not-yet-created ConfigTab; the four section files must be internally type-correct. Commit:
```bash
git add src/config/sections
git commit -m "feat: add fixed-section config form components"
```

---

## Task 6: Raw-JSON editor (Advanced tab)

**Files:** Create `src/config/RawJsonEditor.tsx`; install CodeMirror.

- [ ] **Step 1: Install CodeMirror**

Run: `cd /Users/leev/repo/noalbsgui && npm install @uiw/react-codemirror @codemirror/lang-json`

- [ ] **Step 2: Component**

Create `src/config/RawJsonEditor.tsx`:

```tsx
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";

export function RawJsonEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <CodeMirror value={value} height="60vh" extensions={[json()]} onChange={onChange} />
  );
}
```

- [ ] **Step 3: tsc + commit**

```bash
npx tsc --noEmit   # still expected to fail only on ConfigTab until Task 7
git add src/config/RawJsonEditor.tsx package.json package-lock.json
git commit -m "feat: add raw JSON editor component"
```

---

## Task 7: ConfigTab — form/JSON sub-tabs, tab-switch sync, save + restart prompt

**Files:** Create `src/config/ConfigTab.tsx`; modify `src/App.tsx` (+ tiny styles).

This wires everything: a Form sub-tab (the section components) and an Advanced sub-tab (RawJsonEditor). **Sync happens on sub-tab switch** (the chosen model): leaving Form regenerates the JSON text from the live config object; leaving Advanced parses the JSON text back into the config object (showing a parse error and blocking the switch if invalid). Save validates via the backend and, if noalbs is running, prompts to restart.

- [ ] **Step 1: ConfigTab**

Create `src/config/ConfigTab.tsx`:

```tsx
import { useState } from "react";
import { api } from "../api";
import type { Config } from "../bindings/Config";
import { useConfig } from "./useConfig";
import { SwitcherSection } from "./sections/SwitcherSection";
import { ScenesSection } from "./sections/ScenesSection";
import { ObsSection } from "./sections/ObsSection";
import { OptionsSection } from "./sections/OptionsSection";
import { RawJsonEditor } from "./RawJsonEditor";

type Sub = "form" | "advanced";

export function ConfigTab() {
  const cfg = useConfig();
  const [sub, setSub] = useState<Sub>("form");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  if (!cfg.loaded) return <p>Loading…</p>;
  if (cfg.error) return <p className="error">{cfg.error}</p>;
  if (cfg.missing || !cfg.config) {
    return (
      <section>
        <p>No <code>config.json</code> found in the working directory.</p>
        <p>Set a working directory (or download/select the binary) and create a config — full template support comes later. For now, create a config.json next to the binary, then reload.</p>
        <button onClick={() => cfg.reload()}>Reload</button>
      </section>
    );
  }
  const config = cfg.config;

  const switchTo = (next: Sub) => {
    if (next === sub) return;
    if (sub === "form" && next === "advanced") {
      setJsonText(JSON.stringify(config, null, 2));
      setJsonError(null);
      setSub("advanced");
    } else {
      // leaving advanced -> parse back into the form
      try {
        const parsed = JSON.parse(jsonText) as Config;
        cfg.setConfig(parsed);
        setJsonError(null);
        setSub("form");
      } catch (e) {
        setJsonError(`Invalid JSON: ${String(e)}`);
      }
    }
  };

  const onChange = (c: Config) => cfg.setConfig(c);

  const doSave = async () => {
    setStatus(null);
    try {
      // ensure latest edits from whichever sub-tab are in cfg.config
      if (sub === "advanced") {
        cfg.setConfig(JSON.parse(jsonText) as Config);
      }
      const { running } = await cfg.save();
      if (running) {
        if (confirm("Config saved. Restart noalbs to apply the changes now?")) {
          await api.restart();
          setStatus("Saved and restarted noalbs.");
        } else {
          setStatus("Saved. Restart noalbs to apply.");
        }
      } else {
        setStatus("Saved.");
      }
    } catch (e) {
      setStatus(`Error: ${String(e)}`);
    }
  };

  return (
    <section>
      <div className="row">
        <button className={sub === "form" ? "active" : ""} onClick={() => switchTo("form")}>Form</button>
        <button className={sub === "advanced" ? "active" : ""} onClick={() => switchTo("advanced")}>Advanced (JSON)</button>
        <span style={{ flex: 1 }} />
        <button onClick={doSave}>Save</button>
      </div>
      {jsonError && <p className="error">{jsonError}</p>}
      {status && <p className={status.startsWith("Error") ? "error" : "update"}>{status}</p>}

      {sub === "form" ? (
        <div className="config-form">
          <SwitcherSection config={config} onChange={onChange} />
          <ObsSection config={config} onChange={onChange} />
          <ScenesSection config={config} onChange={onChange} />
          <OptionsSection config={config} onChange={onChange} />
          <p className="note">streamServers and chat are edited via the Advanced (JSON) tab in this version.</p>
        </div>
      ) : (
        <RawJsonEditor value={jsonText} onChange={setJsonText} />
      )}
    </section>
  );
}
```

- [ ] **Step 2: Add the Config tab to App.tsx**

Modify `src/App.tsx` to add a third tab `"config"` between Settings and Logs, importing `ConfigTab`. Extend the `Tab` union and the nav + main switch accordingly.

- [ ] **Step 3: tsc + build**

Run: `cd /Users/leev/repo/noalbsgui && npx tsc --noEmit && npm run build`
Expected: both clean. Fix any binding-shape mismatches (especially `SoftwareConnection` access and bigint fields).

- [ ] **Step 4: Commit**

```bash
git add src/config/ConfigTab.tsx src/App.tsx src/styles.css
git commit -m "feat: add Config tab with form/JSON sync and save+restart prompt"
```

---

## Task 8: Manual end-to-end verification

**Files:** none.

- [ ] **Step 1:** Full backend suite: `cd src-tauri && SDKROOT=$(xcrun --sdk macosx --show-sdk-path) cargo test` — all pass (run twice). `npx tsc --noEmit` clean; `npm run build` clean.
- [ ] **Step 2:** `npm run tauri dev`. Download/select a binary, set a working dir containing a real noalbs `config.json` (use the README example). Open the **Config** tab.
- [ ] **Step 3:** Verify the Form shows the real values (switcher toggles, triggers, scenes, OBS host/port, options). Edit a trigger and a scene name.
- [ ] **Step 4:** Switch to **Advanced** → JSON reflects the edit. Edit the JSON (e.g. a streamServer field), switch back to **Form** (parses without error). Introduce a JSON syntax error and confirm switching back is blocked with a clear message.
- [ ] **Step 5:** **Save** → if noalbs is running, the restart prompt appears; accept and confirm it restarts (Logs show a fresh banner). Confirm `config.json` on disk has your edits and is still valid noalbs JSON (diff against the original; only your changed fields differ — no reordering/whitespace surprises beyond pretty-print).
- [ ] **Step 6:** Commit author hygiene: `git log --format='%an <%ae>%n%b' main..HEAD | grep -iE 'tomtom|claude|co-authored'` → must be empty.

---

## Self-review notes (against spec + P2a scope)
- **Full config schema modeled, round-trips noalbs JSON** → Tasks 1–2 (`full_config_roundtrips_structurally` is the fidelity gate).
- **Form-based editing of fixed sections** → Task 5 (switcher/triggers/scenes/OBS/options).
- **Advanced raw-JSON tab, sync on tab switch** → Tasks 6–7.
- **Save validated by backend, atomic write** → Tasks 1, 3 (`save_str` deserializes before writing; bad JSON never touches the file).
- **Save-then-restart prompt** → Task 7 (`confirm()` → `api.restart()` from P1).
- **Secrets**: OBS password uses a show/hide field (Task 3). The broader `.env` secret editor + token helper is **P2c**, not here.
- **Deferred to P2b/P2c:** friendly streamServers per-type editor (P2b); chat section form + `.env` editor + token helper (P2c). Both are fully editable via the Advanced JSON tab in the meantime.
- **Known limitation:** if `config.json` doesn't exist, P2a shows a "create one" message rather than scaffolding a template — template generation is deferred (noted in the UI, not a silent gap).
