import { useI18n } from "../../i18n";
import { useLocalizedConfirm } from "../../i18n/dialogs";
import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api } from "../../api";
import { ErrorNotice } from "../../components/ErrorNotice";
import type { EnvValues } from "../../bindings/EnvValues";

const TOKEN_URL = "https://irlhosting.com/tmi/";

export function EnvSection() {
  const { t } = useI18n();
  const confirm = useLocalizedConfirm();
  const [env, setEnv] = useState<EnvValues | null>(null);
  const [showOauth, setShowOauth] = useState(false);
  const [status, setStatus] = useState<{ key: string; values?: Record<string, string | number> } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => { api.getEnv().then(setEnv).catch((e) => { setFailed(true); setStatus({ key: "Error: {error}", values: { error: String(e) } }); }); }, []);
  if (!env) return <fieldset id="bot-credentials"><legend>{t("Bot credentials (.env)")}</legend>{failed ? <ErrorNotice error={String(status?.values?.error ?? "")} /> : <p>{t("Loading…")}</p>}</fieldset>;

  const set = (patch: Partial<EnvValues>) => setEnv({ ...env, ...patch });
  const orNull = (v: string): string | null => (v.trim() === "" ? null : v);

  const save = async () => {
    setStatus(null);
    setFailed(false);
    try {
      const running = await api.saveEnv(env);
      if (running) {
        if (await confirm(t(".env saved. Restart noalbs to apply the changes now?"))) {
          await api.restart();
          setStatus({ key: "Saved and restarted noalbs." });
        } else {
          setStatus({ key: "Saved. Restart noalbs to apply." });
        }
      } else {
        setStatus({ key: "Saved .env" });
      }
    } catch (e) { setFailed(true); setStatus({ key: "Error: {error}", values: { error: String(e) } }); }
  };

  return (
    <fieldset id="bot-credentials">
      <legend>{t("Bot credentials (.env)")}</legend>
      <p className="note">{t("Stored in .env next to config.json. Sensitive values are hidden by default and never logged.")}</p>
      <label>{t("Twitch bot username")}<input value={env.twitchBotUsername ?? ""} onChange={(e) => set({ twitchBotUsername: orNull(e.target.value) })} /></label>
      <label>{t("Twitch bot OAuth")}<input type={showOauth ? "text" : "password"} value={env.twitchBotOauth ?? ""} onChange={(e) => set({ twitchBotOauth: orNull(e.target.value) })} placeholder="oauth:..." />
        <button type="button" onClick={() => setShowOauth((s) => !s)}>{showOauth ? t("hide") : t("show")}</button>
        <button type="button" onClick={() => openUrl(TOKEN_URL).catch(e => { setFailed(true); setStatus({ key: "Error: {error}", values: { error: String(e) } }); })}>{t("Get token")}</button>
      </label>
      <label>{t("API port (enables the local WebSocket API)")}<input type="number" value={env.apiPort ?? ""} onChange={(e) => set({ apiPort: orNull(e.target.value) })} /></label>
      <label>{t("Log dir (optional)")}<input value={env.logDir ?? ""} onChange={(e) => set({ logDir: orNull(e.target.value) })} /></label>
      <div className="row"><button className="primary" type="button" onClick={save}>{t("Save .env")}</button></div>
      {status && (failed ? <ErrorNotice error={String(status.values?.error ?? "")} /> : <p role="status" className="update">{t(status.key, status.values)}</p>)}
    </fieldset>
  );
}
