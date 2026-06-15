import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api } from "../../api";
import type { EnvValues } from "../../bindings/EnvValues";

const TOKEN_URL = "https://irlhosting.com/tmi/";

export function EnvSection() {
  const [env, setEnv] = useState<EnvValues | null>(null);
  const [showOauth, setShowOauth] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => { api.getEnv().then(setEnv).catch((e) => setStatus(String(e))); }, []);
  if (!env) return <fieldset id="bot-credentials"><legend>Bot credentials (.env)</legend><p>Loading…</p></fieldset>;

  const set = (patch: Partial<EnvValues>) => setEnv({ ...env, ...patch });
  const orNull = (v: string): string | null => (v.trim() === "" ? null : v);

  const save = async () => {
    setStatus(null);
    try {
      const running = await api.saveEnv(env);
      if (running) {
        if (confirm(".env saved. Restart noalbs to apply the changes now?")) {
          await api.restart();
          setStatus("Saved and restarted noalbs.");
        } else {
          setStatus("Saved. Restart noalbs to apply.");
        }
      } else {
        setStatus("Saved .env");
      }
    } catch (e) { setStatus(`Error: ${String(e)}`); }
  };

  return (
    <fieldset id="bot-credentials">
      <legend>Bot credentials (.env)</legend>
      <p className="note">Stored in <code>.env</code> next to config.json. Sensitive values are hidden by default and never logged.</p>
      <label>Twitch bot username <input value={env.twitchBotUsername ?? ""} onChange={(e) => set({ twitchBotUsername: orNull(e.target.value) })} /></label>
      <label>Twitch bot OAuth
        <input type={showOauth ? "text" : "password"} value={env.twitchBotOauth ?? ""} onChange={(e) => set({ twitchBotOauth: orNull(e.target.value) })} placeholder="oauth:..." />
        <button type="button" onClick={() => setShowOauth((s) => !s)}>{showOauth ? "hide" : "show"}</button>
        <button type="button" onClick={() => openUrl(TOKEN_URL)}>Get token</button>
      </label>
      <label>API port (enables the local WebSocket API) <input type="number" value={env.apiPort ?? ""} onChange={(e) => set({ apiPort: orNull(e.target.value) })} /></label>
      <label>Log dir (optional) <input value={env.logDir ?? ""} onChange={(e) => set({ logDir: orNull(e.target.value) })} /></label>
      <div className="row"><button type="button" onClick={save}>Save .env</button></div>
      {status && <p className={status.startsWith("Error") ? "error" : "update"}>{status}</p>}
    </fieldset>
  );
}
