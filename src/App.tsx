import { useI18n, locales, localeNames } from "./i18n";
import { useEffect, useRef, useState } from "react";
import { DashboardTab } from "./components/DashboardTab";
import { LogsTab } from "./components/LogsTab";
import { SettingsTab } from "./components/SettingsTab";
import { ThemePicker } from "./components/ThemePicker";
import { ConfigTab } from "./config/ConfigTab";
import { UpdateBanner } from "./components/UpdateBanner";
import { EnvSection } from "./config/sections/EnvSection";
import { api } from "./api";
import { applyTheme, watchSystemTheme } from "./theme";
import type { Theme } from "./bindings/Theme";
import "./styles.css";

type Tab = "dashboard" | "logs" | "settings" | "config" | "credentials";
const pages: { id: Tab; title: string; description: string; icon: string }[] = [
  { id: "dashboard", title: "Dashboard", description: "Monitor your streaming connections and scene switching.", icon: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z" },
  { id: "config", title: "Config", description: "Configure switching rules, scenes, servers, and chat.", icon: "M4 7h16 M4 17h16 M8 4v6 M16 14v6" },
  { id: "credentials", title: "Connections & credentials", description: "Manage your bot credentials separately from stream configuration.", icon: "M14 4a6 6 0 1 1-4 10l-6 6H2v-4l6-6a6 6 0 0 1 6-6Z M16 8h.01" },
  { id: "logs", title: "Logs", description: "Inspect the original output from NOALBS.", icon: "m4 6 5 6-5 6 M12 18h8" },
  { id: "settings", title: "Settings", description: "Manage the application, appearance, and startup preferences.", icon: "M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0" },
];

export default function App() {
  const { t, locale, setLocale } = useI18n();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [binaryRevision, setBinaryRevision] = useState(0);
  useEffect(() => {
    // Drafts survive navigation, but belong to the selected binary's directory.
    const changed = () => setBinaryRevision(previous => previous + 1);
    window.addEventListener("binarychange", changed);
    return () => window.removeEventListener("binarychange", changed);
  }, []);
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set(["dashboard"]));
  const navigate = (next: Tab) => { setVisited(previous => new Set([...previous, next])); setTab(next); };
  const page = pages.find(item => item.id === tab)!;
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
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark" aria-hidden="true">N</span><div>NOALBS<small>{t("Stream control")}</small></div></div>
        <nav className="tabs" aria-label="NOALBS">
          {pages.map(item => <button key={item.id} aria-current={tab === item.id ? "page" : undefined} className={tab === item.id ? "active" : ""} onClick={() => navigate(item.id)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d={item.icon} /></svg>{t(item.title)}
          </button>)}
        </nav>
        <label className="language-picker">{t("Interface language")}
          <select value={locale} onChange={event => setLocale(event.target.value as typeof locale)}>
            {locales.map(value => <option key={value} value={value}>{localeNames[value]}</option>)}
          </select>
        </label>
        <ThemePicker />
      </aside>
      <main id="main-content">
        <header className="page-heading"><span className="eyebrow">NOALBS / {String(pages.indexOf(page) + 1).padStart(2, "0")}</span><h1>{t(page.title)}</h1><p>{t(page.description)}</p></header>
        <UpdateBanner />
        {visited.has("dashboard") && <div hidden={tab !== "dashboard"}><DashboardTab onNavigate={navigate} /></div>}
        {visited.has("settings") && <div hidden={tab !== "settings"}><SettingsTab /></div>}
        {visited.has("config") && <div hidden={tab !== "config"}><ConfigTab key={binaryRevision} /></div>}
        {visited.has("credentials") && <div hidden={tab !== "credentials"} className="credentials"><EnvSection key={binaryRevision} /></div>}
        {tab === "logs" && <LogsTab />}
      </main>
    </div>
  );
}
