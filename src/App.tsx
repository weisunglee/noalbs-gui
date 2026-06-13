import { useEffect, useRef, useState } from "react";
import { DashboardTab } from "./components/DashboardTab";
import { LogsTab } from "./components/LogsTab";
import { SettingsTab } from "./components/SettingsTab";
import { ConfigTab } from "./config/ConfigTab";
import { UpdateBanner } from "./components/UpdateBanner";
import { api } from "./api";
import { applyTheme, watchSystemTheme } from "./theme";
import type { Theme } from "./bindings/Theme";
import "./styles.css";

type Tab = "dashboard" | "logs" | "settings" | "config";

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const themeRef = useRef<Theme>("system");

  useEffect(() => {
    api.getSettings().then((s) => { themeRef.current = s.theme; applyTheme(s.theme); }).catch(() => {});
    const unwatch = watchSystemTheme(() => themeRef.current);
    const onThemeChange = (e: Event) => { themeRef.current = (e as CustomEvent<Theme>).detail; };
    window.addEventListener("themechange", onThemeChange as EventListener);
    return () => {
      unwatch();
      window.removeEventListener("themechange", onThemeChange as EventListener);
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const s = await api.getSettings();
        if (!s.autoStart || !s.binaryPath) return;
        const running = await api.getStatus();
        if (!running) await api.start();
      } catch {
        /* ignore — user can start manually from Settings */
      }
    })();
  }, []);

  return (
    <div className="app">
      <UpdateBanner />
      <nav className="tabs">
        <button className={tab === "dashboard" ? "active" : ""} onClick={() => setTab("dashboard")}>
          Dashboard
        </button>
        <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>
          Settings
        </button>
        <button className={tab === "config" ? "active" : ""} onClick={() => setTab("config")}>
          Config
        </button>
        <button className={tab === "logs" ? "active" : ""} onClick={() => setTab("logs")}>
          Logs
        </button>
      </nav>
      <main>
        {tab === "dashboard" ? <DashboardTab onNavigate={setTab} /> : tab === "settings" ? <SettingsTab /> : tab === "config" ? <ConfigTab /> : <LogsTab />}
      </main>
    </div>
  );
}
