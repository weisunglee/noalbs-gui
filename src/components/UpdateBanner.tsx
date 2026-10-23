import { useI18n } from "../i18n";
import { useEffect, useState } from "react";
import { api } from "../api";
import { ErrorNotice } from "./ErrorNotice";

export function UpdateBanner() {
  const { t } = useI18n();
  const [tag, setTag] = useState<string | null>(null);   // newer version tag, if any
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ key: string; values: Record<string, string> } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await api.getSettings();
        // Only auto-check when enabled AND a version is actually installed
        // (otherwise check_update reports the latest tag as an "update").
        if (!s.checkUpdatesOnStartup || !s.installedVersion) return;
        const newer = await api.checkUpdate();
        if (newer) setTag(newer);
      } catch {
        /* offline / no network — silently skip the startup check */
      }
    })();
  }, []);

  if (!tag || dismissed) return null;

  const update = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api.downloadBinary();
      setMsg({ key: "Updated to {version}.", values: { version: tag ?? "" } });
      setTag(null);
    } catch (e) {
      setMsg({ key: "Update failed: {error}", values: { error: String(e) } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="update-banner">
      <span>{t("A new noalbs version is available:")} <strong>{tag}</strong></span>
      <button disabled={busy} onClick={update}>{busy ? t("Updating…") : t("Update now")}</button>
      <button disabled={busy} onClick={() => setDismissed(true)}>{t("Dismiss")}</button>
      {msg && (msg.values.error ? <ErrorNotice error={msg.values.error} /> : <span role="status" className="note">{t(msg.key, msg.values)}</span>)}
    </div>
  );
}
