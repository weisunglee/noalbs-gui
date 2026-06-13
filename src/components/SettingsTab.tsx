import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { api } from "../api";
import type { Settings } from "../bindings/Settings";
import { applyTheme } from "../theme";
import type { Theme } from "../bindings/Theme";

export function SettingsTab() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [updateTag, setUpdateTag] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = async () => {
    setSettings(await api.getSettings());
    setRunning(await api.getStatus());
  };
  useEffect(() => {
    refresh();
    // Poll status so a self-exit/crash of noalbs is reflected without the user
    // having to click anything. get_status also emits `noalbs-exit` on exit.
    const id = setInterval(() => {
      api.getStatus().then(setRunning).catch(() => {});
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const guard = async (label: string, fn: () => Promise<void>) => {
    setErr(null);
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  };

  if (!settings) return <p>Loading…</p>;

  return (
    <section className="settings">
      <h2>noalbs binary</h2>
      <p>
        Version: <strong>{settings.installedVersion ?? "—"}</strong>
        {"  "}({settings.binarySource})
      </p>
      <p className="path">{settings.binaryPath ?? "no binary selected"}</p>

      <div className="row">
        <button
          disabled={!!busy}
          onClick={() => guard("download", async () => setSettings(await api.downloadBinary()))}
        >
          {busy === "download" ? "Downloading…" : "Download latest"}
        </button>
        <button
          disabled={!!busy}
          onClick={() => guard("check", async () => setUpdateTag(await api.checkUpdate()))}
        >
          Check for updates
        </button>
        <button
          disabled={!!busy}
          onClick={() =>
            guard("pick", async () => {
              const path = await open({ multiple: false, directory: false });
              if (typeof path === "string") setSettings(await api.setManualBinaryPath(path));
            })
          }
        >
          Choose binary…
        </button>
      </div>
      {updateTag && <p className="update">Update available: {updateTag}</p>}

      <h2>Control</h2>
      <p>Status: {running ? "running" : "stopped"}</p>
      <div className="row">
        <button disabled={!!busy || running} onClick={() => guard("start", async () => { await api.start(); await refresh(); })}>
          Start
        </button>
        <button disabled={!!busy || !running} onClick={() => guard("stop", async () => { await api.stop(); await refresh(); })}>
          Stop
        </button>
        <button disabled={!!busy} onClick={() => guard("restart", async () => { await api.restart(); await refresh(); })}>
          Restart
        </button>
      </div>

      {err && <p className="error">{err}</p>}

      <section>
        <h2>Appearance</h2>
        <label>Theme
          <select value={settings.theme} onChange={(e) => {
            const theme = e.target.value as Theme;
            const next = { ...settings, theme };
            setSettings(next);
            api.saveSettings(next);
            applyTheme(theme);
            window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
          }}>
            <option value="system">Follow system</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </section>

      <section>
        <h2>Updates</h2>
        <label>
          <input type="checkbox" checked={settings.checkUpdatesOnStartup}
            onChange={(e) => { const next = { ...settings, checkUpdatesOnStartup: e.target.checked }; setSettings(next); api.saveSettings(next); }} />
          Check for noalbs updates on startup
        </label>
      </section>

      <section>
        <h2>Startup</h2>
        <label>
          <input type="checkbox" checked={settings.autoStart}
            onChange={(e) => { const next = { ...settings, autoStart: e.target.checked }; setSettings(next); api.saveSettings(next); }} />
          Start noalbs automatically on launch
        </label>
      </section>
    </section>
  );
}
