import { useState } from "react";
import { DashboardTab } from "./components/DashboardTab";
import { LogsTab } from "./components/LogsTab";
import { SettingsTab } from "./components/SettingsTab";
import { ConfigTab } from "./config/ConfigTab";
import "./styles.css";

type Tab = "dashboard" | "logs" | "settings" | "config";

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  return (
    <div className="app">
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
        {tab === "dashboard" ? <DashboardTab /> : tab === "settings" ? <SettingsTab /> : tab === "config" ? <ConfigTab /> : <LogsTab />}
      </main>
    </div>
  );
}
