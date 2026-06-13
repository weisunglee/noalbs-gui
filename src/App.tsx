import { useState } from "react";
import { LogsTab } from "./components/LogsTab";
import { SettingsTab } from "./components/SettingsTab";
import { ConfigTab } from "./config/ConfigTab";
import "./styles.css";

type Tab = "logs" | "settings" | "config";

export default function App() {
  const [tab, setTab] = useState<Tab>("settings");
  return (
    <div className="app">
      <nav className="tabs">
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
        {tab === "settings" ? <SettingsTab /> : tab === "config" ? <ConfigTab /> : <LogsTab />}
      </main>
    </div>
  );
}
