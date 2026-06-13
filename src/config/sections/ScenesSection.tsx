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
