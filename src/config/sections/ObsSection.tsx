import { useI18n } from "../../i18n";
import { useState } from "react";
import type { Config } from "../../bindings/Config";
import type { SoftwareConnection } from "../../bindings/SoftwareConnection";

export function ObsSection({ config, onChange }: { config: Config; onChange: (c: Config) => void }) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  // SoftwareConnection is { type: "Obs" } & ObsConfig — fields are directly accessible
  const obs = config.software;
  const set = (patch: Partial<{ host: string; password: string | null; port: number }>) =>
    onChange({ ...config, software: { ...obs, ...patch } as SoftwareConnection });
  return (
    <fieldset>
      <legend>{t("OBS connection")}</legend>
      <label>{t("Host")}<input value={obs.host} onChange={(e) => set({ host: e.target.value })} /></label>
      <label>{t("Port")}<input type="number" value={obs.port} onChange={(e) => set({ port: Number(e.target.value) })} /></label>
      <label>{t("Password")}<input type={show ? "text" : "password"} value={obs.password ?? ""}
          onChange={(e) => set({ password: e.target.value === "" ? null : e.target.value })} />
        <button type="button" onClick={() => setShow((s) => !s)}>{show ? t("hide") : t("show")}</button>
      </label>
    </fieldset>
  );
}
