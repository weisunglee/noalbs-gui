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
