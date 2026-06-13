import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api, onStatus } from "../api";
import type { DashboardSnapshot } from "../bindings/DashboardSnapshot";
import { requestFocusEnv } from "../config/focusEnv";

function fmtUptime(secs: bigint | null): string {
  if (secs === null) return "—";
  const n = Number(secs);
  const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), s = n % 60;
  return (h > 0 ? `${h}h ` : "") + `${m}m ${s}s`;
}

export function DashboardTab({ onNavigate }: { onNavigate?: (tab: "config") => void }) {
  const [d, setD] = useState<DashboardSnapshot | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const refresh = () => api.getDashboard().then(setD).catch(() => {});
    refresh();
    const id = setInterval(refresh, 1000); // ticks uptime + running
    onStatus(() => refresh()).then((u) => (unlisten = u));
    return () => { clearInterval(id); unlisten?.(); };
  }, []);

  if (!d) return <p>Loading…</p>;
  const st = d.status;

  return (
    <section className="dashboard">
      <div className="cards">
        <div className={`card ${d.running ? "ok" : "off"}`}>
          <h3>noalbs</h3>
          <p>{d.running ? "running" : "stopped"}</p>
          <small>uptime {fmtUptime(d.uptimeSecs)}{d.version ? ` · v${d.version}` : ""}</small>
        </div>
        <div className={`card ${st.obs === "connected" ? "ok" : st.obs === "connecting" ? "warn" : "off"}`}>
          <h3>OBS</h3>
          <p>{st.obs}</p>
        </div>
        {(() => {
          const tw = st.twitch;
          const cls = tw === "connected" ? "ok" : tw === "authFailed" ? "off" : tw === "notConfigured" ? "warn" : "";
          const label = tw === "connected" ? "connected" : tw === "authFailed" ? "auth failed" : tw === "notConfigured" ? "not configured" : "—";
          return (
            <div className={`card ${cls}`}>
              <h3>Twitch</h3>
              <p>{label}</p>
              {tw === "authFailed" && (
                <button
                  onClick={() => {
                    openUrl("https://irlhosting.com/tmi/").catch(() => {});
                    requestFocusEnv();
                    onNavigate?.("config");
                  }}
                >
                  Fix — get a token
                </button>
              )}
            </div>
          );
        })()}
        <div className="card">
          <h3>Scene</h3>
          <p>{st.currentScene ?? "—"}</p>
          <small>{st.lastSwitchType ? `last switch: ${st.lastSwitchType}` : ""}</small>
        </div>
        <div className="card">
          <h3>Switcher</h3>
          <p>{st.switcherState ?? "—"}</p>
          <small>{st.user ? `user: ${st.user}` : ""}</small>
        </div>
      </div>
      {!d.running && <p className="note">Start noalbs from the Settings tab to see live status.</p>}
    </section>
  );
}
