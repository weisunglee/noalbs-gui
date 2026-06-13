# NOALBSGUI P2b (streamServers Editor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A friendly, type-aware editor for `switcher.streamServers` in the Config tab's Form view: list all configured servers, add (pick from the 10 NOALBS server types), remove, set priority, toggle enabled, edit per-type fields, optional auth, optional `overrideScenes`, and optional `dependsOn`.

**Architecture:** Pure frontend — the Rust `StreamServerKind` model and `ts-rs` types already exist (P2a). A data-driven descriptor (`serverTypes.ts`) defines each type's fields + a default value, so the editor renders fields generically and type changes produce valid variants. Components plug into the existing `ConfigTab` Form view; everything flows through the existing `useConfig`/`save_config` path (no backend changes).

**Tech Stack:** React + TypeScript (no new deps). Verification: `tsc --noEmit` + `npm run build` + manual E2E (consistent with P1/P2a — no frontend unit-test harness exists).

**Reference:** Plan builds on merged P2a. Generated types in `src/bindings/`: `StreamServerEntry` = `{ streamServer: StreamServerKind, name: string, priority: number | null, overrideScenes: SwitchingScenes | null, dependsOn: DependsOn | null, enabled: boolean }`. `StreamServerKind` = discriminated union `{ "type": "Nginx" } & NginxConfig | ... | { "type": "OpenIRL" } & OpenIrlConfig | { "type": "Irlhosting" } & IrlhostingConfig`. `DependsOn` = `{ name: string, backupScenes: SwitchingScenes }`. `ServerAuth` = `{ username: string, password: string }`.

### Exact per-type fields (from the generated bindings — source of truth)
| type tag | fields (all `string` unless noted) |
|---|---|
| `Nginx` | statsUrl, application, key |
| `NodeMediaServer` | statsUrl, application, key, auth: `ServerAuth \| null` |
| `Nimble` | statsUrl, id, application, key |
| `SrtLiveServer` | statsUrl, publisher, apiKey: `string \| null` |
| `Belabox` | statsUrl, publisher |
| `Mediamtx` | statsUrl, auth: `ServerAuth \| null` |
| `Rist` | statsUrl |
| `Xiu` | statsUrl, application, key |
| `OpenIRL` | statsUrl |
| `Irlhosting` | statsUrl, application: `string \| null`, key: `string \| null`, publisher: `string \| null` |

---

## Repo conventions (MUST follow)
- **Commit as `weisunglee`. NEVER run `git config`. NEVER add `Co-Authored-By`/Claude/AI lines.** Plain `git commit -m`.
- **PR workflow** — work on branch `p2b-streamservers`, never push `main`.
- **Node 22** for `npm`/`tsc`. (No Rust changes expected; if any, build with `SDKROOT=$(xcrun --sdk macosx --show-sdk-path)`.)

---

## File structure
```
src/config/
  serverTypes.ts                 # NEW: descriptor (per-type fields + defaults + labels)
  sections/
    StreamServersSection.tsx     # NEW: list + add/remove/priority
    ServerEntryEditor.tsx        # NEW: single-entry editor (type, fields, auth, overrideScenes, dependsOn)
  ConfigTab.tsx                  # MODIFY: render StreamServersSection in the Form view; update the note
```

---

## Task 1: Server-type descriptor (`serverTypes.ts`)

**Files:** Create `src/config/serverTypes.ts`.

This is the data model that drives the UI. It lists each server type's editable fields and provides a default `StreamServerKind` for "add" / type-switch.

- [ ] **Step 1: Write it**

```ts
import type { StreamServerKind } from "../bindings/StreamServerKind";

export type FieldKind = "text" | "auth";

export type FieldDef = {
  key: string;       // property name on the variant (e.g. "statsUrl")
  label: string;
  kind: FieldKind;   // "text" = string|null input; "auth" = optional ServerAuth sub-form
  optional: boolean; // optional fields may be null
};

export type ServerTypeDef = {
  type: StreamServerKind["type"]; // the discriminant tag
  label: string;
  fields: FieldDef[];
  /** A fresh variant value with empty/required fields, used on add or type-switch. */
  makeDefault: () => StreamServerKind;
};

const t = (key: string, label: string, optional = false): FieldDef => ({ key, label, kind: "text", optional });
const auth = (): FieldDef => ({ key: "auth", label: "Auth", kind: "auth", optional: true });

export const SERVER_TYPES: ServerTypeDef[] = [
  { type: "Nginx", label: "NGINX",
    fields: [t("statsUrl", "Stats URL"), t("application", "Application"), t("key", "Key")],
    makeDefault: () => ({ type: "Nginx", statsUrl: "", application: "publish", key: "live" }) },
  { type: "NodeMediaServer", label: "Node Media Server",
    fields: [t("statsUrl", "Stats URL"), t("application", "Application"), t("key", "Key"), auth()],
    makeDefault: () => ({ type: "NodeMediaServer", statsUrl: "", application: "publish", key: "live", auth: null }) },
  { type: "Nimble", label: "Nimble",
    fields: [t("statsUrl", "Stats URL"), t("id", "Listener ID (IP:Port)"), t("application", "Application"), t("key", "Key")],
    makeDefault: () => ({ type: "Nimble", statsUrl: "", id: "", application: "live", key: "srt" }) },
  { type: "SrtLiveServer", label: "SRT Live Server (SLS)",
    fields: [t("statsUrl", "Stats URL"), t("publisher", "Publisher / StreamID"), t("apiKey", "API key", true)],
    makeDefault: () => ({ type: "SrtLiveServer", statsUrl: "", publisher: "", apiKey: null }) },
  { type: "Belabox", label: "BELABOX cloud",
    fields: [t("statsUrl", "Stats URL"), t("publisher", "Publisher")],
    makeDefault: () => ({ type: "Belabox", statsUrl: "", publisher: "" }) },
  { type: "Mediamtx", label: "MediaMTX",
    fields: [t("statsUrl", "Stats URL"), auth()],
    makeDefault: () => ({ type: "Mediamtx", statsUrl: "", auth: null }) },
  { type: "Rist", label: "RIST",
    fields: [t("statsUrl", "Stats URL")],
    makeDefault: () => ({ type: "Rist", statsUrl: "" }) },
  { type: "Xiu", label: "Xiu",
    fields: [t("statsUrl", "Stats URL"), t("application", "Application"), t("key", "Key")],
    makeDefault: () => ({ type: "Xiu", statsUrl: "", application: "live", key: "source" }) },
  { type: "OpenIRL", label: "OpenIRL",
    fields: [t("statsUrl", "Stats URL")],
    makeDefault: () => ({ type: "OpenIRL", statsUrl: "" }) },
  { type: "Irlhosting", label: "IRLHosting",
    fields: [t("statsUrl", "Stats URL"), t("application", "Application", true), t("key", "Key", true), t("publisher", "Publisher", true)],
    makeDefault: () => ({ type: "Irlhosting", statsUrl: "", application: null, key: null, publisher: null }) },
];

export function serverTypeDef(type: StreamServerKind["type"]): ServerTypeDef {
  const def = SERVER_TYPES.find((s) => s.type === type);
  if (!def) throw new Error(`unknown server type: ${type}`);
  return def;
}

/** A fresh entry for the "Add server" action. */
export function makeDefaultEntry(): import("../bindings/StreamServerEntry").StreamServerEntry {
  return {
    streamServer: SERVER_TYPES[0].makeDefault(),
    name: "new server",
    priority: 0,
    overrideScenes: null,
    dependsOn: null,
    enabled: true,
  };
}
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/leev/repo/noalbsgui && npx tsc --noEmit`. The `makeDefault` return values MUST satisfy `StreamServerKind` — if `tsc` complains, a field name/shape is wrong vs the bindings; fix it. (This is the compile-time correctness gate for the descriptor.) Other files (the not-yet-created components) referenced elsewhere may still error — but `serverTypes.ts` itself must be clean.

- [ ] **Step 3: Commit**

```bash
cd /Users/leev/repo/noalbsgui
git add src/config/serverTypes.ts
git commit -m "feat: add stream-server type descriptor"
```

---

## Task 2: Single-entry editor (`ServerEntryEditor.tsx`)

**Files:** Create `src/config/sections/ServerEntryEditor.tsx`.

Edits one `StreamServerEntry`: type dropdown (switching type replaces `streamServer` with that type's default), name, priority, enabled, the type-specific fields, optional auth sub-form, optional `overrideScenes`, optional `dependsOn`.

- [ ] **Step 1: Write it**

```tsx
import type { StreamServerEntry } from "../../bindings/StreamServerEntry";
import type { StreamServerKind } from "../../bindings/StreamServerKind";
import type { ServerAuth } from "../../bindings/ServerAuth";
import type { SwitchingScenes } from "../../bindings/SwitchingScenes";
import { SERVER_TYPES, serverTypeDef } from "../serverTypes";

const EMPTY_SCENES: SwitchingScenes = { normal: "", low: "", offline: "" };

export function ServerEntryEditor({
  entry,
  onChange,
  onRemove,
}: {
  entry: StreamServerEntry;
  onChange: (e: StreamServerEntry) => void;
  onRemove: () => void;
}) {
  const set = (patch: Partial<StreamServerEntry>) => onChange({ ...entry, ...patch });
  const def = serverTypeDef(entry.streamServer.type);

  // Update a field on the streamServer variant. Cast is safe: we only set keys
  // that belong to the current variant (driven by the descriptor's field list).
  const setField = (key: string, value: string | null) =>
    set({ streamServer: { ...entry.streamServer, [key]: value } as StreamServerKind });

  const changeType = (type: StreamServerKind["type"]) =>
    set({ streamServer: serverTypeDef(type).makeDefault() });

  const ss = entry.streamServer as unknown as Record<string, unknown>;

  return (
    <div className="server-entry">
      <div className="row">
        <label>Type
          <select value={entry.streamServer.type} onChange={(e) => changeType(e.target.value as StreamServerKind["type"])}>
            {SERVER_TYPES.map((s) => <option key={s.type} value={s.type}>{s.label}</option>)}
          </select>
        </label>
        <label>Name <input value={entry.name} onChange={(e) => set({ name: e.target.value })} /></label>
        <label>Priority <input type="number" value={entry.priority ?? 0}
          onChange={(e) => set({ priority: e.target.value === "" ? null : Number(e.target.value) })} /></label>
        <label><input type="checkbox" checked={entry.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> enabled</label>
        <button type="button" onClick={onRemove}>remove</button>
      </div>

      {def.fields.map((f) =>
        f.kind === "auth" ? (
          <AuthField key={f.key} value={(ss[f.key] as ServerAuth | null) ?? null}
            onChange={(v) => setField(f.key, v as unknown as string | null)} />
        ) : (
          <label key={f.key}>{f.label}{f.optional ? " (optional)" : ""}
            <input value={(ss[f.key] as string | null) ?? ""}
              onChange={(e) => setField(f.key, f.optional && e.target.value === "" ? null : e.target.value)} />
          </label>
        )
      )}

      <OptionalScenesField label="Override scenes" value={entry.overrideScenes}
        onChange={(v) => set({ overrideScenes: v })} />

      <DependsOnField value={entry.dependsOn} onChange={(v) => set({ dependsOn: v })} />
    </div>
  );
}

function AuthField({ value, onChange }: { value: ServerAuth | null; onChange: (v: ServerAuth | null) => void }) {
  return (
    <div className="subfield">
      <label><input type="checkbox" checked={value !== null}
        onChange={(e) => onChange(e.target.checked ? { username: "", password: "" } : null)} /> Use auth</label>
      {value && (
        <>
          <label>Username <input value={value.username} onChange={(e) => onChange({ ...value, username: e.target.value })} /></label>
          <label>Password <input type="password" value={value.password} onChange={(e) => onChange({ ...value, password: e.target.value })} /></label>
        </>
      )}
    </div>
  );
}

function OptionalScenesField({ label, value, onChange }: { label: string; value: SwitchingScenes | null; onChange: (v: SwitchingScenes | null) => void }) {
  return (
    <div className="subfield">
      <label><input type="checkbox" checked={value !== null}
        onChange={(e) => onChange(e.target.checked ? { ...EMPTY_SCENES } : null)} /> {label}</label>
      {value && (
        <div className="row">
          <label>Normal <input value={value.normal} onChange={(e) => onChange({ ...value, normal: e.target.value })} /></label>
          <label>Low <input value={value.low} onChange={(e) => onChange({ ...value, low: e.target.value })} /></label>
          <label>Offline <input value={value.offline} onChange={(e) => onChange({ ...value, offline: e.target.value })} /></label>
        </div>
      )}
    </div>
  );
}

function DependsOnField({ value, onChange }: { value: import("../../bindings/DependsOn").DependsOn | null; onChange: (v: import("../../bindings/DependsOn").DependsOn | null) => void }) {
  return (
    <div className="subfield">
      <label><input type="checkbox" checked={value !== null}
        onChange={(e) => onChange(e.target.checked ? { name: "", backupScenes: { ...EMPTY_SCENES } } : null)} /> Depends on another server</label>
      {value && (
        <>
          <label>Depends on (name) <input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} /></label>
          <OptionalScenesInline label="Backup scenes" value={value.backupScenes}
            onChange={(bs) => onChange({ ...value, backupScenes: bs })} />
        </>
      )}
    </div>
  );
}

function OptionalScenesInline({ label, value, onChange }: { label: string; value: SwitchingScenes; onChange: (v: SwitchingScenes) => void }) {
  return (
    <div className="row">
      <span>{label}:</span>
      <label>Normal <input value={value.normal} onChange={(e) => onChange({ ...value, normal: e.target.value })} /></label>
      <label>Low <input value={value.low} onChange={(e) => onChange({ ...value, low: e.target.value })} /></label>
      <label>Offline <input value={value.offline} onChange={(e) => onChange({ ...value, offline: e.target.value })} /></label>
    </div>
  );
}
```

> Note the `setField` cast: because `StreamServerKind` is a discriminated union, TS can't prove an arbitrary string key is valid on the current variant. The descriptor guarantees we only render/set keys that exist on the active variant, so the `as StreamServerKind` cast is sound. Do not loosen the public types — keep the cast localized.

- [ ] **Step 2: Type-check + commit**

`npx tsc --noEmit` — `ServerEntryEditor.tsx` must be internally clean (ConfigTab/StreamServersSection not yet wired may still error). Commit:
```bash
git add src/config/sections/ServerEntryEditor.tsx
git commit -m "feat: add single stream-server entry editor"
```

---

## Task 3: List section + ConfigTab integration

**Files:** Create `src/config/sections/StreamServersSection.tsx`; modify `src/config/ConfigTab.tsx`; small CSS.

- [ ] **Step 1: StreamServersSection**

```tsx
import type { Config } from "../../bindings/Config";
import { ServerEntryEditor } from "./ServerEntryEditor";
import { makeDefaultEntry } from "../serverTypes";

export function StreamServersSection({ config, onChange }: { config: Config; onChange: (c: Config) => void }) {
  const servers = config.switcher.streamServers;
  const setServers = (next: typeof servers) =>
    onChange({ ...config, switcher: { ...config.switcher, streamServers: next } });

  const update = (i: number, e: (typeof servers)[number]) =>
    setServers(servers.map((s, idx) => (idx === i ? e : s)));
  const remove = (i: number) => setServers(servers.filter((_, idx) => idx !== i));
  const add = () => setServers([...servers, makeDefaultEntry()]);

  return (
    <fieldset>
      <legend>Stream servers ({servers.length})</legend>
      {servers.length === 0 && <p className="note">No stream servers. Add one below.</p>}
      {servers.map((s, i) => (
        <ServerEntryEditor key={i} entry={s} onChange={(e) => update(i, e)} onRemove={() => remove(i)} />
      ))}
      <button type="button" onClick={add}>+ Add stream server</button>
    </fieldset>
  );
}
```

> Servers are keyed by index. noalbs sorts by `priority` on load, so display order in the array is not authoritative — the user controls ordering via the numeric `priority` field. (Drag-reorder is out of scope; priority numbers are the faithful mechanism.)

- [ ] **Step 2: Wire into ConfigTab**

In `src/config/ConfigTab.tsx`:
- import `StreamServersSection`.
- render `<StreamServersSection config={config} onChange={onChange} />` inside the Form view (after `OptionsSection`).
- change the existing note from "streamServers and chat are edited via the Advanced (JSON) tab" to "chat is edited via the Advanced (JSON) tab in this version." (streamServers now has a form.)

- [ ] **Step 3: Styles**

Append to `src/styles.css`:
```css
.server-entry { border: 1px solid #ccc; border-radius: 6px; padding: .5rem; margin: .5rem 0; }
.subfield { margin: .25rem 0 .25rem 1rem; }
.config-form fieldset { margin-bottom: 1rem; }
```

- [ ] **Step 4: Verify + commit**

```bash
cd /Users/leev/repo/noalbsgui
npx tsc --noEmit          # clean
npm run build             # clean
git add src/config/sections/StreamServersSection.tsx src/config/ConfigTab.tsx src/styles.css
git commit -m "feat: add stream servers section to config form"
```

---

## Task 4: Manual end-to-end verification

**Files:** none.

- [ ] **Step 1:** `npx tsc --noEmit` clean; `npm run build` clean. (No Rust changes; if any were made, `cd src-tauri && SDKROOT=$(xcrun --sdk macosx --show-sdk-path) cargo test` passes.)
- [ ] **Step 2:** `npm run tauri dev`. Open Config → Form. The existing stream servers from the loaded config appear as entries with correct type + fields.
- [ ] **Step 3:** Add a server (try a few types — e.g. Belabox, Nginx, Mediamtx); confirm switching the type swaps the field set and seeds sensible defaults. Toggle auth on Mediamtx/NodeMediaServer; toggle overrideScenes; toggle dependsOn. Edit names/priority/enabled. Remove one.
- [ ] **Step 4:** Switch to **Advanced (JSON)** → the `streamServers` array reflects every edit with correct `{ "type": ... }` tags and field names (camelCase, e.g. `statsUrl`, `apiKey`). Switch back to **Form** (parses cleanly).
- [ ] **Step 5:** **Save** → backend accepts it (the model deserializes), prompt to restart if running. Inspect `config.json` on disk: stream servers match what noalbs expects (compare a Belabox/Nginx entry against the NOALBS README shape).
- [ ] **Step 6:** Author hygiene: `git log --format='%an <%ae>%n%b' main..HEAD | grep -iE 'tomtom|claude|co-authored'` → empty.

---

## Self-review notes (against scope)
- **All 10 server types, full forms** → `serverTypes.ts` descriptor covers every type with its exact fields; `tsc` enforces the defaults are valid `StreamServerKind` values (compile-time fidelity gate).
- **Add / remove / priority / enabled** → StreamServersSection + ServerEntryEditor.
- **Per-type fields, optional auth, overrideScenes, dependsOn** → ServerEntryEditor sub-forms.
- **Round-trips to correct noalbs JSON** → values are typed `StreamServerKind`/`StreamServerEntry`; serialization goes through the same `save_config` validated path; verified in E2E step 4–5.
- **No backend change needed** — the model and commands from P2a already handle stream servers.
- **Deferred:** chat section form + `.env` editor + token helper → **P2c**. Drag-to-reorder servers (priority numbers suffice).
- **Known limitation:** the `setField`/`ss` casts are required by the discriminated union; they're localized and guarded by the descriptor (we only touch keys valid for the active variant).
