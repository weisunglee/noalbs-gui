import { useI18n } from "../../i18n";
import type { Config } from "../../bindings/Config";

export function ScenesSection({ config, onChange }: { config: Config; onChange: (c: Config) => void }) {
  const { t } = useI18n();
  const os = config.optionalScenes;
  const set = (patch: Partial<typeof os>) => onChange({ ...config, optionalScenes: { ...os, ...patch } });
  const orNull = (v: string): string | null => (v.trim() === "" ? null : v);
  return (
    <fieldset>
      <legend>{t("Optional scenes")}</legend>
      <label>{t("Starting")}<input value={os.starting ?? ""} onChange={(e) => set({ starting: orNull(e.target.value) })} /></label>
      <label>{t("Ending")}<input value={os.ending ?? ""} onChange={(e) => set({ ending: orNull(e.target.value) })} /></label>
      <label>{t("Privacy")}<input value={os.privacy ?? ""} onChange={(e) => set({ privacy: orNull(e.target.value) })} /></label>
      <label>{t("Refresh")}<input value={os.refresh ?? ""} onChange={(e) => set({ refresh: orNull(e.target.value) })} /></label>
    </fieldset>
  );
}
