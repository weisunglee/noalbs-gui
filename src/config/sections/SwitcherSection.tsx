import { useI18n } from "../../i18n";
import type { Config } from "../../bindings/Config";

export function SwitcherSection({ config, onChange }: { config: Config; onChange: (c: Config) => void }) {
  const { t } = useI18n();
  const sw = config.switcher;
  const set = (patch: Partial<typeof sw>) => onChange({ ...config, switcher: { ...sw, ...patch } });
  const setTrig = (patch: Partial<typeof sw.triggers>) =>
    onChange({ ...config, switcher: { ...sw, triggers: { ...sw.triggers, ...patch } } });
  const setScene = (patch: Partial<typeof sw.switchingScenes>) =>
    onChange({ ...config, switcher: { ...sw, switchingScenes: { ...sw.switchingScenes, ...patch } } });

  const numOrNull = (v: string): number | null => (v.trim() === "" ? null : Number(v));

  return (
    <fieldset>
      <legend>{t("Switcher")}</legend>
      <label><input type="checkbox" checked={sw.bitrateSwitcherEnabled}
        onChange={(e) => set({ bitrateSwitcherEnabled: e.target.checked })} /> {t("Bitrate switcher enabled")}</label>
      <label><input type="checkbox" checked={sw.onlySwitchWhenStreaming}
        onChange={(e) => set({ onlySwitchWhenStreaming: e.target.checked })} /> {t("Only switch when streaming")}</label>
      <label><input type="checkbox" checked={sw.instantlySwitchOnRecover}
        onChange={(e) => set({ instantlySwitchOnRecover: e.target.checked })} /> {t("Instantly switch on recover")}</label>
      <label><input type="checkbox" checked={sw.autoSwitchNotification}
        onChange={(e) => set({ autoSwitchNotification: e.target.checked })} /> {t("Auto switch notification")}</label>
      <label>{t("Retry attempts")}<input type="number" min={0} max={255} value={sw.retryAttempts}
        onChange={(e) => set({ retryAttempts: Number(e.target.value) })} /></label>

      <h4>{t("Triggers (kbps / ms)")}</h4>
      <label>{t("Low")}<input type="number" value={sw.triggers.low ?? ""} onChange={(e) => setTrig({ low: numOrNull(e.target.value) })} /></label>
      <label>RTT <input type="number" value={sw.triggers.rtt ?? ""} onChange={(e) => setTrig({ rtt: numOrNull(e.target.value) })} /></label>
      <label>{t("Offline")}<input type="number" value={sw.triggers.offline ?? ""} onChange={(e) => setTrig({ offline: numOrNull(e.target.value) })} /></label>
      <label>{t("RTT offline")}<input type="number" value={sw.triggers.rttOffline ?? ""} onChange={(e) => setTrig({ rttOffline: numOrNull(e.target.value) })} /></label>

      <h4>{t("Switching scenes")}</h4>
      <label>{t("Normal")}<input value={sw.switchingScenes.normal} onChange={(e) => setScene({ normal: e.target.value })} /></label>
      <label>{t("Low")}<input value={sw.switchingScenes.low} onChange={(e) => setScene({ low: e.target.value })} /></label>
      <label>{t("Offline")}<input value={sw.switchingScenes.offline} onChange={(e) => setScene({ offline: e.target.value })} /></label>
    </fieldset>
  );
}
