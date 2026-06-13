import { useState } from "react";
import { LogsTab } from "./components/LogsTab";
import { SettingsTab } from "./components/SettingsTab";
import "./styles.css";

type Tab = "logs" | "settings";

export default function App() {
  const [tab, setTab] = useState<Tab>("settings");
  return (
    <div className="app">
      <nav className="tabs">
        <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>
          Settings
        </button>
        <button className={tab === "logs" ? "active" : ""} onClick={() => setTab("logs")}>
          Logs
        </button>
      </nav>
      <main>{tab === "settings" ? <SettingsTab /> : <LogsTab />}</main>
    </div>
  );
}
