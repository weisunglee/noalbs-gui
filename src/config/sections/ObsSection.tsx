import { useState } from "react";
import type { Config } from "../../bindings/Config";
import type { SoftwareConnection } from "../../bindings/SoftwareConnection";

export function ObsSection({ config, onChange }: { config: Config; onChange: (c: Config) => void }) {
  const [show, setShow] = useState(false);
  // SoftwareConnection is { type: "Obs" } & ObsConfig — fields are directly accessible
  const obs = config.software;
  const set = (patch: Partial<{ host: string; password: string | null; port: number }>) =>
    onChange({ ...config, software: { ...obs, ...patch } as SoftwareConnection });
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
