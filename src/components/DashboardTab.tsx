import { useI18n } from "../i18n";
import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api, onStatus } from "../api";
import type { DashboardSnapshot } from "../bindings/DashboardSnapshot";
import { ErrorNotice } from "./ErrorNotice";

function fmtUptime(secs: bigint | null, t: ReturnType<typeof useI18n>["t"]): string {
  if (secs === null) return "—";
  const n = Number(secs);
  const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), s = n % 60;
  return t(h > 0 ? "{hours}h {minutes}m {seconds}s" : "{minutes}m {seconds}s", { hours: h, minutes: m, seconds: s });
}

export function DashboardTab({ onNavigate }: { onNavigate?: (tab: "credentials") => void }) {
  const { t } = useI18n();
  const [d, setD] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const refresh = () => api.getDashboard().then(snapshot => { setD(snapshot); setLoadError(null); }).catch(e => setLoadError(String(e)));
    refresh();
    const id = setInterval(refresh, 1000); // ticks uptime + running
    let active = true;
    onStatus(() => refresh()).then(u => { if (active) unlisten = u; else u(); }).catch(e => { if (active) setError(String(e)); });
    return () => { active = false; clearInterval(id); unlisten?.(); };
  }, []);

  if (!d) return loadError || error ? <ErrorNotice error={(loadError || error)!} /> : <p>{t("Loading…")}</p>;
  const st = d.status;

  return (
    <section className="dashboard">
      {error && <ErrorNotice error={error} />}
      {loadError && <ErrorNotice error={loadError} />}
      <div className="cards">
        <div className={`card ${d.running ? "ok" : "off"}`}>
          <h3>noalbs</h3>
          <p>{d.running ? t("running") : t("stopped")}</p>
          <small>{t("uptime")} {fmtUptime(d.uptimeSecs, t)}{d.version ? ` · v${d.version}` : ""}</small>
        </div>
        <div className={`card ${st.obs === "connected" ? "ok" : st.obs === "connecting" ? "warn" : "off"}`}>
          <h3>OBS</h3>
          <p>{t(st.obs)}</p>
        </div>
        {(() => {
          const tw = st.twitch;
          const cls = tw === "connected" ? "ok" : tw === "authFailed" ? "off" : tw === "notConfigured" ? "warn" : "";
          const label = tw === "connected" ? t("connected") : tw === "authFailed" ? t("auth failed") : tw === "notConfigured" ? t("not configured") : "—";
          return (
            <div className={`card ${cls}`}>
              <h3>Twitch</h3>
              <p>{label}</p>
              {tw === "authFailed" && (
                <button
                  onClick={() => {
                    openUrl("https://irlhosting.com/tmi/").catch(e => setError(String(e)));
                    onNavigate?.("credentials");
                  }}
                >
                  {t("Fix — get a token")}</button>
              )}
            </div>
          );
        })()}
        <div className="card">
          <h3>{t("Scene")}</h3>
          <p>{st.currentScene ?? "—"}</p>
          <small>{st.lastSwitchType ? t("last switch: {type}", { type: t(st.lastSwitchType) }) : ""}</small>
        </div>
        <div className="card">
          <h3>{t("Switcher")}</h3>
          <p>{st.switcherState ? t(st.switcherState) : "—"}</p>
          <small>{st.user ? t("user: {user}", { user: st.user }) : ""}</small>
        </div>
      </div>
      {!d.running && <p className="note">{t("Start noalbs from the Settings tab to see live status.")}</p>}
    </section>
  );
}
