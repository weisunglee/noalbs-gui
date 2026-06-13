import { useEffect, useState } from "react";
import { api } from "../api";

export function UpdateBanner() {
  const [tag, setTag] = useState<string | null>(null);   // newer version tag, if any
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
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
      const running = await api.getStatus();
      if (running && confirm("Updated. Restart noalbs now to run the new version?")) {
        await api.restart();
      }
      setMsg(`Updated to ${tag}.`);
      setTag(null);
    } catch (e) {
      setMsg(`Update failed: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="update-banner">
      <span>A new noalbs version is available: <strong>{tag}</strong>.</span>
      <button disabled={busy} onClick={update}>{busy ? "Updating…" : "Update now"}</button>
      <button disabled={busy} onClick={() => setDismissed(true)}>Dismiss</button>
      {msg && <span className="note">{msg}</span>}
    </div>
  );
}
