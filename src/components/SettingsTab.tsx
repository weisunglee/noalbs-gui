import { useI18n } from "../i18n";
import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { api } from "../api";
import type { Settings } from "../bindings/Settings";
import { ThemePicker } from "./ThemePicker";
import { ErrorNotice } from "./ErrorNotice";
import type { Theme } from "../bindings/Theme";

export function SettingsTab() {
  const { t } = useI18n();
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
    const changed = (event: Event) => setSettings(previous => previous ? { ...previous, theme: (event as CustomEvent<Theme>).detail } : previous);
    window.addEventListener("themechange", changed);
    refresh().catch(e => setErr(String(e)));
    // Poll status so a self-exit/crash of noalbs is reflected without the user
    // having to click anything. get_status also emits `noalbs-exit` on exit.
    const id = setInterval(() => {
      api.getStatus().then(setRunning).catch(() => {});
    }, 2000);
    return () => { clearInterval(id); window.removeEventListener("themechange", changed); };
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

  if (!settings) return err ? <ErrorNotice error={err} /> : <p>{t("Loading…")}</p>;

  return (
    <section className="settings">
      <h2>{t("noalbs binary")}</h2>
      <p>
        {t("Version:")}<strong>{settings.installedVersion ?? "—"}</strong>
        {"  "}({t(settings.binarySource)})
      </p>
      <p className="path">{settings.binaryPath ?? t("no binary selected")}</p>

      <div className="row">
        <button
          disabled={!!busy}
          onClick={() => guard("download", async () => setSettings(await api.downloadBinary()))}
        >
          {busy === "download" ? t("Downloading…") : t("Download latest")}
        </button>
        <button
          disabled={!!busy}
          onClick={() => guard("check", async () => setUpdateTag(await api.checkUpdate()))}
        >
          {t("Check for updates")}</button>
        <button
          disabled={!!busy}
          onClick={() =>
            guard("pick", async () => {
              const path = await open({ multiple: false, directory: false, title: t("Choose binary…") });
              if (typeof path === "string") setSettings(await api.setManualBinaryPath(path));
            })
          }
        >
          {t("Choose binary…")}</button>
      </div>
      {updateTag && <p className="update">{t("Update available:")}{updateTag}</p>}

      <h2>{t("Control")}</h2>
      <p>{t("Status:")}{running ? t("running") : t("stopped")}</p>
      <div className="row">
        <button disabled={!!busy || running} onClick={() => guard("start", async () => { await api.start(); await refresh(); })}>
          {t("Start")}</button>
        <button disabled={!!busy || !running} onClick={() => guard("stop", async () => { await api.stop(); await refresh(); })}>
          {t("Stop")}</button>
        <button disabled={!!busy} onClick={() => guard("restart", async () => { await api.restart(); await refresh(); })}>
          {t("Restart")}</button>
      </div>

      {err && <ErrorNotice error={err} />}

      <section>
        <h2>{t("Appearance")}</h2>
        <ThemePicker />
      </section>

      <section>
        <h2>{t("Updates")}</h2>
        <label>
          <input type="checkbox" checked={settings.checkUpdatesOnStartup} disabled={!!busy}
            onChange={(e) => { const next = { ...settings, checkUpdatesOnStartup: e.target.checked }; void guard("save", async () => { await api.saveSettings(next); setSettings(next); }); }} />
          {t("Check for noalbs updates on startup")}</label>
      </section>

      <section>
        <h2>{t("Startup")}</h2>
        <label>
          <input type="checkbox" checked={settings.autoStart} disabled={!!busy}
            onChange={(e) => { const next = { ...settings, autoStart: e.target.checked }; void guard("save", async () => { await api.saveSettings(next); setSettings(next); }); }} />
          {t("Start noalbs automatically on launch")}</label>
      </section>
    </section>
  );
}
