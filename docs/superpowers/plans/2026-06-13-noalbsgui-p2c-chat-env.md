# NOALBSGUI P2c (Chat form + .env editor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Complete the config editor: (1) a form for the `config.json` `chat` section (platform, username, admins/ignoreUsers lists, language, prefix, toggles, per-command settings), and (2) a secret-aware editor for noalbs's `.env` (Twitch bot credentials, API_PORT, LOG_DIR) with a "get token" link to https://irlhosting.com/tmi/. After P2c the whole config + credentials are editable in the GUI.

**Architecture:** The `chat` model and `ts-rs` types already exist (P2a) — the chat form is pure frontend over `config.chat: Chat | null`, saved via the existing `save_config` path. The `.env` editor needs a new Rust `env_file.rs` (parse/edit preserving unknown lines, atomic write) + `get_env`/`save_env` commands, and a frontend section with masked secret fields. `.env` lives next to `config.json` (working dir or binary parent) and is saved independently of config.json (different file, its own Save button).

**Tech Stack:** Tauri v2 · Rust (serde, ts-rs) · React + TS · `@tauri-apps/plugin-opener` (already a dependency) to open the token URL in the system browser.

**Reference:** Builds on merged P2a/P2b. From noalbs v2 source:
- `Chat` (ts-rs `Chat.ts`): `{ platform: ChatPlatform, username, admins: string[], ignoreUsers: string[], language: string, prefix, enablePublicCommands, enableModCommands, enableAutoStopStreamOnHostOrRaid, announceRaidOnAutoStop, commands: Record<string, CommandInfo> | null }`. `ChatPlatform` = `"Twitch"` | `{ Kick: KickConfig }` where `KickConfig = { channelId: number|null, chatroomId: number|null, useIrlproxy: boolean|null }`. `CommandInfo = { permission: string|null, userPermissions: string[]|null, alias: string[]|null }`.
- `ChatLanguage` values (15): `DE, DK, EN, ES, FR, IT, NB, NL, PL, PTBR, RU, SV, TR, ZHTW, UK`.
- `Permission` values (4): `Admin, Mod, Public, Vip` (null = default/Administrators).
- `Command` names (27, PascalCase keys of the commands map): `Alias, Autostop, Bitrate, Fix, Mod, Noalbs, Notify, ServerInfo, Otrigger, Ortrigger, Public, Rec, Refresh, Rtrigger, Source, Sourceinfo, Start, Stop, StreamServer, Collection, Switch, Trigger, Version, LiveScene, StartingScene, EndingScene, PrivacyScene`.
- `.env` keys NOALBS reads (main.rs): `TWITCH_BOT_USERNAME`, `TWITCH_BOT_OAUTH`, `API_PORT`, `LOG_DIR`, `LOG_FILE_NAME`, `CONFIG_DIR`. The official template ships only `TWITCH_BOT_USERNAME` + `TWITCH_BOT_OAUTH`. The GUI manages: `TWITCH_BOT_USERNAME`, `TWITCH_BOT_OAUTH` (secret), `API_PORT`, `LOG_DIR`; all other lines are preserved untouched.

---

## Repo conventions (MUST follow)
- **Commit as `weisunglee`. NEVER run `git config`. NEVER add `Co-Authored-By`/Claude/AI lines.** Plain `git commit -m`.
- **PR workflow** — branch `p2c-chat-env`, never push `main`.
- **Rust builds: `SDKROOT=$(xcrun --sdk macosx --show-sdk-path) cargo test|build`.** **Node 22** for npm/tsc.
- ts-rs `export_to = "../../src/bindings/"` (verified correct from `src-tauri/src/*.rs`).

---

## File structure
```
src-tauri/src/
  env_file.rs        # NEW: parse/edit .env preserving unknown lines + comments; atomic write; ts-rs EnvValues
  commands.rs        # MODIFY: get_env / save_env (+ env_path helper)
  lib.rs             # MODIFY: declare env_file module; register commands; ensure opener plugin initialized
src/
  config/
    api.ts (../api.ts)      # MODIFY: getEnv/saveEnv wrappers
    StringListEditor.tsx    # NEW: reusable add/remove string-list control
    sections/
      ChatSection.tsx       # NEW: config.json chat form
      EnvSection.tsx        # NEW: .env secret editor + token link
    chatMeta.ts             # NEW: LANGUAGES, PERMISSIONS, COMMAND_NAMES constants
    ConfigTab.tsx           # MODIFY: render ChatSection + EnvSection; drop the JSON-only note
```

---

## Task 1: `.env` file model (Rust) — parse/edit/preserve

**Files:** Create `src-tauri/src/env_file.rs`; modify `src-tauri/src/lib.rs` (`pub mod env_file;`).

- [ ] **Step 1: Write the model + tests**

```rust
use std::path::Path;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::error::AppError;

/// The .env values the GUI manages. Other lines in the file are preserved.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct EnvValues {
    pub twitch_bot_username: Option<String>,
    pub twitch_bot_oauth: Option<String>,
    pub api_port: Option<String>,
    pub log_dir: Option<String>,
}

const MANAGED: [(&str, fn(&EnvValues) -> Option<String>); 4] = [
    ("TWITCH_BOT_USERNAME", |v| v.twitch_bot_username.clone()),
    ("TWITCH_BOT_OAUTH", |v| v.twitch_bot_oauth.clone()),
    ("API_PORT", |v| v.api_port.clone()),
    ("LOG_DIR", |v| v.log_dir.clone()),
];

/// Split a non-comment line into (KEY, VALUE). Returns None for blanks/comments.
fn parse_kv(line: &str) -> Option<(&str, &str)> {
    let trimmed = line.trim_start();
    if trimmed.is_empty() || trimmed.starts_with('#') {
        return None;
    }
    let (k, v) = line.split_once('=')?;
    Some((k.trim(), v))
}

pub fn read_values(path: &Path) -> Result<EnvValues, AppError> {
    let content = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(EnvValues::default()),
        Err(e) => return Err(e.into()),
    };
    let mut v = EnvValues::default();
    for line in content.lines() {
        if let Some((k, val)) = parse_kv(line) {
            match k {
                "TWITCH_BOT_USERNAME" => v.twitch_bot_username = Some(val.to_string()),
                "TWITCH_BOT_OAUTH" => v.twitch_bot_oauth = Some(val.to_string()),
                "API_PORT" => v.api_port = Some(val.to_string()),
                "LOG_DIR" => v.log_dir = Some(val.to_string()),
                _ => {}
            }
        }
    }
    Ok(v)
}

/// Update the managed keys in `path`, preserving all other lines, comments, and
/// ordering. Managed keys present in the file are updated in place; managed keys
/// with a Some value not yet in the file are appended; managed keys set to None
/// are left as-is if absent, or removed if present. Atomic write.
pub fn write_values(path: &Path, values: &EnvValues) -> Result<(), AppError> {
    let existing = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(e) => return Err(e.into()),
    };

    let mut out: Vec<String> = Vec::new();
    let mut seen: Vec<&str> = Vec::new();

    for line in existing.lines() {
        match parse_kv(line) {
            Some((k, _)) if MANAGED.iter().any(|(mk, _)| *mk == k) => {
                seen.push(MANAGED.iter().find(|(mk, _)| *mk == k).unwrap().0);
                let getter = MANAGED.iter().find(|(mk, _)| *mk == k).unwrap().1;
                match getter(values) {
                    Some(val) => out.push(format!("{k}={val}")),
                    None => {} // managed key cleared -> drop the line
                }
            }
            _ => out.push(line.to_string()),
        }
    }
    // Append managed keys that have a value but weren't already present.
    for (k, getter) in MANAGED.iter() {
        if !seen.contains(k) {
            if let Some(val) = getter(values) {
                out.push(format!("{k}={val}"));
            }
        }
    }

    let mut content = out.join("\n");
    if !content.is_empty() {
        content.push('\n');
    }

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let tmp = path.with_extension("env.tmp");
    std::fs::write(&tmp, content)?;
    std::fs::rename(&tmp, path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_missing_returns_default() {
        let dir = tempfile::tempdir().unwrap();
        let v = read_values(&dir.path().join(".env")).unwrap();
        assert_eq!(v, EnvValues::default());
    }

    #[test]
    fn reads_known_keys() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join(".env");
        std::fs::write(&p, "# comment\nTWITCH_BOT_USERNAME=bob\nTWITCH_BOT_OAUTH=oauth:abc\nCUSTOM=1\n").unwrap();
        let v = read_values(&p).unwrap();
        assert_eq!(v.twitch_bot_username.as_deref(), Some("bob"));
        assert_eq!(v.twitch_bot_oauth.as_deref(), Some("oauth:abc"));
        assert_eq!(v.api_port, None);
    }

    #[test]
    fn write_preserves_unknown_lines_and_updates_in_place() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join(".env");
        std::fs::write(&p, "# my notes\nTWITCH_BOT_USERNAME=old\nCUSTOM=keep\n").unwrap();
        let v = EnvValues {
            twitch_bot_username: Some("new".into()),
            twitch_bot_oauth: Some("oauth:x".into()),
            api_port: Some("8080".into()),
            log_dir: None,
        };
        write_values(&p, &v).unwrap();
        let content = std::fs::read_to_string(&p).unwrap();
        assert!(content.contains("# my notes"));
        assert!(content.contains("CUSTOM=keep"));
        assert!(content.contains("TWITCH_BOT_USERNAME=new"));
        assert!(!content.contains("TWITCH_BOT_USERNAME=old"));
        assert!(content.contains("TWITCH_BOT_OAUTH=oauth:x")); // appended
        assert!(content.contains("API_PORT=8080"));            // appended
        // round-trips
        let reread = read_values(&p).unwrap();
        assert_eq!(reread, v);
    }

    #[test]
    fn clearing_a_value_removes_the_line() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join(".env");
        std::fs::write(&p, "API_PORT=8080\nTWITCH_BOT_USERNAME=bob\n").unwrap();
        let v = EnvValues { twitch_bot_username: Some("bob".into()), api_port: None, ..Default::default() };
        write_values(&p, &v).unwrap();
        let content = std::fs::read_to_string(&p).unwrap();
        assert!(!content.contains("API_PORT"));
        assert!(content.contains("TWITCH_BOT_USERNAME=bob"));
    }
}
```

- [ ] **Step 2: Run tests + bindings**

`cd src-tauri && SDKROOT=$(xcrun --sdk macosx --show-sdk-path) cargo test env_file::` → 4 pass. Full `cargo test` → `EnvValues.ts` generated in `src/bindings/`.

- [ ] **Step 3: Commit**
```bash
git add src-tauri/src/env_file.rs src-tauri/src/lib.rs src/bindings
git commit -m "feat: add .env file model (preserve unknown lines, atomic write)"
```

---

## Task 2: `get_env` / `save_env` commands

**Files:** Modify `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs`.

- [ ] **Step 1: Add commands** (mirror the `config_path` pattern; `.env` sits next to `config.json`)

```rust
use crate::env_file::{self, EnvValues};

fn env_path(s: &crate::settings::Settings) -> AppResult<PathBuf> {
    let dir = s.working_dir.clone().or_else(|| {
        s.binary_path.as_ref().and_then(|b| b.parent().map(|p| p.to_path_buf()))
    });
    dir.map(|d| d.join(".env")).ok_or(AppError::Other(
        "no working directory or binary path set".into(),
    ))
}

#[tauri::command]
pub async fn get_env(state: State<'_, AppState>) -> AppResult<EnvValues> {
    let s = state.settings.lock().await.clone();
    env_file::read_values(&env_path(&s)?)
}

#[tauri::command]
pub async fn save_env(state: State<'_, AppState>, values: EnvValues) -> AppResult<()> {
    let s = state.settings.lock().await.clone();
    env_file::write_values(&env_path(&s)?, &values)
}
```

Register `get_env`, `save_env` in `lib.rs`'s `generate_handler!`.

- [ ] **Step 2: Build + test**
`cd src-tauri && SDKROOT=$(xcrun --sdk macosx --show-sdk-path) cargo build && cargo test` — compiles, all pass.

- [ ] **Step 3: Commit**
```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "feat: add get_env/save_env commands"
```

---

## Task 3: Ensure opener plugin (for the token link)

**Files:** check/modify `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`, verify JS dep.

- [ ] **Step 1: Verify/enable the opener plugin**

The scaffold added `@tauri-apps/plugin-opener` (JS) and likely `tauri-plugin-opener` (Rust). Confirm:
- `src-tauri/Cargo.toml` has `tauri-plugin-opener`. If missing, add `tauri-plugin-opener = "2"`.
- `lib.rs` builder has `.plugin(tauri_plugin_opener::init())`. If missing, add it.
- `src-tauri/capabilities/default.json` permissions include `"opener:default"` (or `opener:allow-open-url`). Add if missing.
- `package.json` has `@tauri-apps/plugin-opener` (scaffold included it; if not, `npm install @tauri-apps/plugin-opener`).

- [ ] **Step 2: Build**
`cd src-tauri && SDKROOT=$(xcrun --sdk macosx --show-sdk-path) cargo build` — compiles.

- [ ] **Step 3: Commit** (only if changes were needed)
```bash
git add -A
git commit -m "chore: ensure opener plugin enabled for external links"
```
(If nothing changed, skip this commit.)

---

## Task 4: Frontend — API wrappers, constants, reusable list editor

**Files:** modify `src/api.ts`; create `src/config/chatMeta.ts`, `src/config/StringListEditor.tsx`.

- [ ] **Step 1: api.ts** — add:
```ts
import type { EnvValues } from "./bindings/EnvValues";
// ...
  getEnv: () => invoke<EnvValues>("get_env"),
  saveEnv: (values: EnvValues) => invoke<void>("save_env", { values }),
```

- [ ] **Step 2: chatMeta.ts**
```ts
export const LANGUAGES = ["DE","DK","EN","ES","FR","IT","NB","NL","PL","PTBR","RU","SV","TR","ZHTW","UK"] as const;
export const PERMISSIONS = ["Admin","Mod","Public","Vip"] as const; // null = default
export const COMMAND_NAMES = [
  "Alias","Autostop","Bitrate","Fix","Mod","Noalbs","Notify","ServerInfo","Otrigger","Ortrigger",
  "Public","Rec","Refresh","Rtrigger","Source","Sourceinfo","Start","Stop","StreamServer",
  "Collection","Switch","Trigger","Version","LiveScene","StartingScene","EndingScene","PrivacyScene",
] as const;
```

- [ ] **Step 3: StringListEditor.tsx** (reused for admins, ignoreUsers, userPermissions, alias)
```tsx
export function StringListEditor({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="subfield">
      <span>{label}:</span>
      {items.map((item, i) => (
        <span key={i} className="row">
          <input value={item} onChange={(e) => onChange(items.map((x, idx) => (idx === i ? e.target.value : x)))} />
          <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>x</button>
        </span>
      ))}
      <button type="button" onClick={() => onChange([...items, ""])}>+ add</button>
    </div>
  );
}
```

- [ ] **Step 4: tsc (api/constants/list editor must be clean) + commit**
```bash
git add src/api.ts src/config/chatMeta.ts src/config/StringListEditor.tsx
git commit -m "feat: add env API, chat constants, string-list editor"
```

---

## Task 5: ChatSection (config.json chat form)

**Files:** create `src/config/sections/ChatSection.tsx`.

Edits `config.chat: Chat | null`. If null, show an "Enable chat" button that sets a default `Chat`. When set, render the full form.

- [ ] **Step 1: Write it**
```tsx
import type { Config } from "../../bindings/Config";
import type { Chat } from "../../bindings/Chat";
import type { ChatPlatform } from "../../bindings/ChatPlatform";
import type { CommandInfo } from "../../bindings/CommandInfo";
import { LANGUAGES, PERMISSIONS, COMMAND_NAMES } from "../chatMeta";
import { StringListEditor } from "../StringListEditor";

const DEFAULT_CHAT: Chat = {
  platform: "Twitch",
  username: "",
  admins: [],
  ignoreUsers: [],
  language: "EN",
  prefix: "!",
  enablePublicCommands: false,
  enableModCommands: true,
  enableAutoStopStreamOnHostOrRaid: true,
  announceRaidOnAutoStop: true,
  commands: null,
};

export function ChatSection({ config, onChange }: { config: Config; onChange: (c: Config) => void }) {
  const chat = config.chat;
  const setChat = (c: Chat | null) => onChange({ ...config, chat: c });

  if (!chat) {
    return (
      <fieldset>
        <legend>Chat</legend>
        <p className="note">Chat is not configured.</p>
        <button type="button" onClick={() => setChat({ ...DEFAULT_CHAT })}>Enable chat</button>
      </fieldset>
    );
  }
  const set = (patch: Partial<Chat>) => setChat({ ...chat, ...patch });

  const isKick = typeof chat.platform === "object" && "Kick" in chat.platform;
  const setPlatform = (kind: "Twitch" | "Kick") => {
    if (kind === "Twitch") set({ platform: "Twitch" as ChatPlatform });
    else set({ platform: { Kick: { channelId: null, chatroomId: null, useIrlproxy: null } } as ChatPlatform });
  };
  const kick = isKick ? (chat.platform as { Kick: { channelId: number | null; chatroomId: number | null; useIrlproxy: boolean | null } }).Kick : null;
  const setKick = (patch: Partial<NonNullable<typeof kick>>) =>
    set({ platform: { Kick: { ...(kick as object), ...patch } } as ChatPlatform });

  const commands = chat.commands ?? {};
  const setCommands = (next: Record<string, CommandInfo>) => set({ commands: next });
  const addCommand = (name: string) =>
    setCommands({ ...commands, [name]: { permission: null, userPermissions: null, alias: null } });
  const updateCommand = (name: string, info: CommandInfo) => setCommands({ ...commands, [name]: info });
  const removeCommand = (name: string) => {
    const next = { ...commands };
    delete next[name];
    setCommands(next);
  };
  const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

  return (
    <fieldset>
      <legend>Chat</legend>
      <label>Platform
        <select value={isKick ? "Kick" : "Twitch"} onChange={(e) => setPlatform(e.target.value as "Twitch" | "Kick")}>
          <option value="Twitch">Twitch</option>
          <option value="Kick">Kick</option>
        </select>
      </label>
      {isKick && kick && (
        <div className="subfield">
          <label>Channel ID <input type="number" value={kick.channelId ?? ""} onChange={(e) => setKick({ channelId: numOrNull(e.target.value) })} /></label>
          <label>Chatroom ID <input type="number" value={kick.chatroomId ?? ""} onChange={(e) => setKick({ chatroomId: numOrNull(e.target.value) })} /></label>
          <label><input type="checkbox" checked={kick.useIrlproxy ?? false} onChange={(e) => setKick({ useIrlproxy: e.target.checked })} /> Use IRL proxy</label>
        </div>
      )}

      <label>Username <input value={chat.username} onChange={(e) => set({ username: e.target.value })} /></label>
      <label>Language
        <select value={chat.language} onChange={(e) => set({ language: e.target.value })}>
          {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </label>
      <label>Prefix <input value={chat.prefix} onChange={(e) => set({ prefix: e.target.value })} /></label>

      <StringListEditor label="Admins" items={chat.admins} onChange={(v) => set({ admins: v })} />
      <StringListEditor label="Ignore users" items={chat.ignoreUsers} onChange={(v) => set({ ignoreUsers: v })} />

      <label><input type="checkbox" checked={chat.enablePublicCommands} onChange={(e) => set({ enablePublicCommands: e.target.checked })} /> Enable public commands</label>
      <label><input type="checkbox" checked={chat.enableModCommands} onChange={(e) => set({ enableModCommands: e.target.checked })} /> Enable mod commands</label>
      <label><input type="checkbox" checked={chat.enableAutoStopStreamOnHostOrRaid} onChange={(e) => set({ enableAutoStopStreamOnHostOrRaid: e.target.checked })} /> Auto-stop on host/raid</label>
      <label><input type="checkbox" checked={chat.announceRaidOnAutoStop} onChange={(e) => set({ announceRaidOnAutoStop: e.target.checked })} /> Announce raid on auto-stop</label>

      <fieldset>
        <legend>Command overrides</legend>
        {Object.entries(commands).map(([name, info]) => (
          <div key={name} className="server-entry">
            <div className="row">
              <strong>{name}</strong>
              <label>Permission
                <select value={info.permission ?? ""} onChange={(e) => updateCommand(name, { ...info, permission: e.target.value === "" ? null : e.target.value })}>
                  <option value="">(default)</option>
                  {PERMISSIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => removeCommand(name)}>remove</button>
            </div>
            <StringListEditor label="User permissions" items={info.userPermissions ?? []} onChange={(v) => updateCommand(name, { ...info, userPermissions: v.length ? v : null })} />
            <StringListEditor label="Aliases" items={info.alias ?? []} onChange={(v) => updateCommand(name, { ...info, alias: v.length ? v : null })} />
          </div>
        ))}
        <AddCommand existing={Object.keys(commands)} onAdd={addCommand} />
      </fieldset>
    </fieldset>
  );
}

function AddCommand({ existing, onAdd }: { existing: string[]; onAdd: (name: string) => void }) {
  const available = COMMAND_NAMES.filter((c) => !existing.includes(c));
  if (available.length === 0) return null;
  return (
    <div className="row">
      <select defaultValue="" onChange={(e) => { if (e.target.value) { onAdd(e.target.value); e.target.value = ""; } }}>
        <option value="">+ add command override…</option>
        {available.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}
```

> Note the `ChatPlatform` casts: the generated type is `"Twitch" | { Kick: KickConfig }`; the `isKick`/`setKick` logic and the localized `as ChatPlatform` casts handle the union. Verify against the generated `ChatPlatform.ts`/`KickConfig.ts` and adapt the shape access if ts-rs emitted it differently (e.g. `{ Kick: KickConfig }` exact key). Keep behavior identical.

- [ ] **Step 2: tsc (ChatSection internally clean) + commit**
```bash
git add src/config/sections/ChatSection.tsx
git commit -m "feat: add chat config form section"
```

---

## Task 6: EnvSection (.env secret editor + token link)

**Files:** create `src/config/sections/EnvSection.tsx`.

Independent of the config form: loads via `getEnv`, saves via `saveEnv` (its own Save button). Secret fields masked by default.

- [ ] **Step 1: Write it**
```tsx
import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api } from "../../api";
import type { EnvValues } from "../../bindings/EnvValues";

const TOKEN_URL = "https://irlhosting.com/tmi/";

export function EnvSection() {
  const [env, setEnv] = useState<EnvValues | null>(null);
  const [showOauth, setShowOauth] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => { api.getEnv().then(setEnv).catch((e) => setStatus(String(e))); }, []);
  if (!env) return <fieldset><legend>Bot credentials (.env)</legend><p>Loading…</p></fieldset>;

  const set = (patch: Partial<EnvValues>) => setEnv({ ...env, ...patch });
  const orNull = (v: string): string | null => (v.trim() === "" ? null : v);

  const save = async () => {
    setStatus(null);
    try { await api.saveEnv(env); setStatus("Saved .env"); }
    catch (e) { setStatus(`Error: ${String(e)}`); }
  };

  return (
    <fieldset>
      <legend>Bot credentials (.env)</legend>
      <p className="note">Stored in <code>.env</code> next to config.json. Sensitive values are hidden by default and never logged.</p>
      <label>Twitch bot username <input value={env.twitchBotUsername ?? ""} onChange={(e) => set({ twitchBotUsername: orNull(e.target.value) })} /></label>
      <label>Twitch bot OAuth
        <input type={showOauth ? "text" : "password"} value={env.twitchBotOauth ?? ""} onChange={(e) => set({ twitchBotOauth: orNull(e.target.value) })} placeholder="oauth:..." />
        <button type="button" onClick={() => setShowOauth((s) => !s)}>{showOauth ? "hide" : "show"}</button>
        <button type="button" onClick={() => openUrl(TOKEN_URL)}>Get token</button>
      </label>
      <label>API port (enables the local WebSocket API) <input type="number" value={env.apiPort ?? ""} onChange={(e) => set({ apiPort: orNull(e.target.value) })} /></label>
      <label>Log dir (optional) <input value={env.logDir ?? ""} onChange={(e) => set({ logDir: orNull(e.target.value) })} /></label>
      <div className="row"><button type="button" onClick={save}>Save .env</button></div>
      {status && <p className={status.startsWith("Error") ? "error" : "update"}>{status}</p>}
    </fieldset>
  );
}
```

> If `@tauri-apps/plugin-opener` exports a different function name in the installed version (e.g. `open` instead of `openUrl`), use whatever it exports to open an external URL; verify by reading `node_modules/@tauri-apps/plugin-opener`'s types. The capability must allow it (Task 3).

- [ ] **Step 2: tsc + commit**
```bash
git add src/config/sections/EnvSection.tsx
git commit -m "feat: add .env secret editor with token helper"
```

---

## Task 7: Integrate into ConfigTab

**Files:** modify `src/config/ConfigTab.tsx`.

- [ ] **Step 1:** Import `ChatSection` and `EnvSection`. In the Form view, render `<ChatSection config={config} onChange={onChange} />` after `StreamServersSection`, and `<EnvSection />` after that. **Remove** the leftover note about editing via the Advanced JSON tab (everything now has a form; the Advanced tab remains available for power users).

- [ ] **Step 2: Verify**
```bash
cd /Users/leev/repo/noalbsgui
npx tsc --noEmit     # clean
npm run build        # clean
```

- [ ] **Step 3: Commit**
```bash
git add src/config/ConfigTab.tsx
git commit -m "feat: render chat and .env sections in config form"
```

---

## Task 8: Manual end-to-end verification

**Files:** none.

- [ ] **Step 1:** `cd src-tauri && SDKROOT=$(xcrun --sdk macosx --show-sdk-path) cargo test` all pass; `npx tsc --noEmit` + `npm run build` clean.
- [ ] **Step 2:** `npm run tauri dev`. Config → Form → **Chat**: shows the loaded chat values. Toggle platform Twitch↔Kick (Kick reveals channel/chatroom ids). Edit username/prefix/language; add/remove admins + ignoreUsers; add a command override (e.g. Switch → Mod, alias `ss`), remove one.
- [ ] **Step 3:** Switch to **Advanced (JSON)** → `chat` reflects edits with correct shape (`platform: "Twitch"` or `{"Kick":{...}}`, `commands` map). Switch back to Form. **Save** → config.json on disk correct.
- [ ] **Step 4:** **Bot credentials (.env)** section: fields load from `.env`. OAuth is masked; "show" reveals; **Get token** opens https://irlhosting.com/tmi/ in the system browser. Edit username/oauth/apiPort, click **Save .env** → inspect `.env` on disk: managed keys updated, any pre-existing unrelated lines/comments preserved.
- [ ] **Step 5:** Author hygiene: `git log --format='%an <%ae>%n%b' main..HEAD | grep -iE 'tomtom|claude|co-authored'` → empty.

---

## Self-review notes (against scope)
- **config.json chat form** → Task 5 (platform incl. Kick, username, admins/ignoreUsers lists, language dropdown of 15, prefix, 4 toggles, per-command permission/userPermissions/alias).
- **.env secret editor** → Tasks 1–2, 6 (managed keys with unknown-line preservation + atomic write; masked secrets; independent save).
- **Token helper** → Task 6 (`Get token` → opener → https://irlhosting.com/tmi/), plugin ensured in Task 3.
- **Both in one place** → Task 7 (ChatSection + EnvSection in the Config Form view).
- **Secrets**: OAuth masked/hidden by default, never logged; `.env` preserves unrelated lines.
- **No new scope creep**: command map keyed by the 27 known command names; languages/permissions from the enums. Drag-reorder, WS password management (config `user.passwordHash`), and CONFIG_DIR multi-user remain out of scope.
- **Known limitation:** `.env` save is separate from config save (different file) — two Save buttons in one tab; this is intentional and labeled.
