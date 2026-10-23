import { useI18n } from "../../i18n";
import type { Config } from "../../bindings/Config";

export function OptionsSection({ config, onChange }: { config: Config; onChange: (c: Config) => void }) {
  const { t } = useI18n();
  const oo = config.optionalOptions;
  const set = (patch: Partial<typeof oo>) => onChange({ ...config, optionalOptions: { ...oo, ...patch } });
  const numOrNull = (v: string): number | null => (v.trim() === "" ? null : Number(v));

  return (
    <fieldset>
      <legend>{t("Optional options")}</legend>
      <label>
        <input type="checkbox" checked={oo.twitchTranscodingCheck}
          onChange={(e) => set({ twitchTranscodingCheck: e.target.checked })} />
        {" "}{t("Twitch transcoding check")}</label>
      <label>
        {t("Twitch transcoding retries")}{" "}
        <input type="number" min={0} value={String(oo.twitchTranscodingRetries)}
          onChange={(e) => set({ twitchTranscodingRetries: BigInt(e.target.value || 0) })} />
      </label>
      <label>
        {t("Twitch transcoding delay (seconds)")}{" "}
        <input type="number" min={0} value={String(oo.twitchTranscodingDelaySeconds)}
          onChange={(e) => set({ twitchTranscodingDelaySeconds: BigInt(e.target.value || 0) })} />
      </label>
      <label>
        {t("Offline timeout (seconds)")}{" "}
        <input type="number" value={oo.offlineTimeout ?? ""}
          onChange={(e) => set({ offlineTimeout: numOrNull(e.target.value) })} />
      </label>
      <label>
        <input type="checkbox" checked={oo.recordWhileStreaming}
          onChange={(e) => set({ recordWhileStreaming: e.target.checked })} />
        {" "}{t("Record while streaming")}</label>
      <label>
        <input type="checkbox" checked={oo.switchToStartingSceneOnStreamStart}
          onChange={(e) => set({ switchToStartingSceneOnStreamStart: e.target.checked })} />
        {" "}{t("Switch to starting scene on stream start")}</label>
      <label>
        <input type="checkbox" checked={oo.switchFromStartingSceneToLiveScene}
          onChange={(e) => set({ switchFromStartingSceneToLiveScene: e.target.checked })} />
        {" "}{t("Switch from starting scene to live scene")}</label>
    </fieldset>
  );
}
