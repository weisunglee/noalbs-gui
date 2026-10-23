import { useI18n } from "../i18n";
import { useLocalizedConfirm } from "../i18n/dialogs";
import { lazy, Suspense, useState } from "react";
import { api } from "../api";
import { ErrorNotice } from "../components/ErrorNotice";
import type { Config } from "../bindings/Config";
import { useConfig } from "./useConfig";
import { SwitcherSection } from "./sections/SwitcherSection";
import { ScenesSection } from "./sections/ScenesSection";
import { ObsSection } from "./sections/ObsSection";
import { OptionsSection } from "./sections/OptionsSection";
import { StreamServersSection } from "./sections/StreamServersSection";
import { ChatSection } from "./sections/ChatSection";
const RawJsonEditor = lazy(() => import("./RawJsonEditor").then(module => ({ default: module.RawJsonEditor })));

type Sub = "form" | "advanced";

export function ConfigTab() {
  const { t, locale } = useI18n();
  const confirm = useLocalizedConfirm();
  const cfg = useConfig();
  const [sub, setSub] = useState<Sub>("form");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ key: string; values?: Record<string, string | number> } | null>(null);
  const [failed, setFailed] = useState(false);

  if (!cfg.loaded) return <p>{t("Loading…")}</p>;
  if (cfg.error) return <ErrorNotice error={cfg.error} />;
  if (cfg.missing || !cfg.config) {
    return (
      <section>
        <p>{t("No config.json found in the working directory.")}</p>
        <p>{t("Set a working directory (or download/select the binary) and create a config — full template support comes later. For now, create a config.json next to the binary, then reload.")}</p>
        <button onClick={() => cfg.reload()}>{t("Reload")}</button>
      </section>
    );
  }
  const config = cfg.config;

  const switchTo = (next: Sub) => {
    if (next === sub) return;
    if (sub === "form" && next === "advanced") {
      setJsonText(JSON.stringify(config, (_, v) =>
        typeof v === "bigint" ? Number(v) : v
      , 2));
      setJsonError(null);
      setSub("advanced");
    } else {
      // leaving advanced -> parse back into the form
      try {
        const parsed = JSON.parse(jsonText) as Config;
        cfg.setConfig(parsed);
        setJsonError(null);
        setSub("form");
      } catch (e) {
        setJsonError(String(e));
      }
    }
  };

  const onChange = (c: Config) => cfg.setConfig(c);

  const doRestore = async () => {
    setStatus(null);
    setFailed(false);
    try {
      const info = await api.getBackupInfo();
      if (!info.exists) { setStatus({ key: "No backup available yet." }); return; }
      const when = info.modifiedMs ? new Date(info.modifiedMs).toLocaleString(locale) : t("an unknown time");
      if (!await confirm(t("Restore backup from {when}? This overwrites your current config.", { when }))) return;
      const { config: restored, running } = await api.restoreConfigBackup();
      cfg.setConfig(restored);
      setSub("form");
      if (running) {
        if (await confirm(t("Restored. Restart noalbs to apply now?"))) { await api.restart(); setStatus({ key: "Restored and restarted noalbs." }); }
        else setStatus({ key: "Restored. Restart noalbs to apply." });
      } else {
        setStatus({ key: "Restored from backup." });
      }
    } catch (e) {
      setFailed(true);
      setStatus({ key: "Error: {error}", values: { error: String(e) } });
    }
  };

  const doSave = async () => {
    setStatus(null);
    setFailed(false);
    try {
      // On the Advanced tab, save the raw JSON text verbatim (the in-state
      // config may lag the editor). The backend validates it before writing.
      const { running } = await cfg.save(sub === "advanced" ? jsonText : undefined);
      if (running) {
        if (await confirm(t("Config saved. Restart noalbs to apply the changes now?"))) {
          await api.restart();
          setStatus({ key: "Saved and restarted noalbs." });
        } else {
          setStatus({ key: "Saved. Restart noalbs to apply." });
        }
      } else {
        setStatus({ key: "Saved." });
      }
    } catch (e) {
      setFailed(true);
      setStatus({ key: "Error: {error}", values: { error: String(e) } });
    }
  };

  return (
    <section>
      <div className="row config-toolbar">
        <button className={sub === "form" ? "active" : ""} onClick={() => switchTo("form")}>{t("Form")}</button>
        <button className={sub === "advanced" ? "active" : ""} onClick={() => switchTo("advanced")}>{t("Advanced (JSON)")}</button>
        <span style={{ flex: 1 }} />
        <button onClick={doRestore}>{t("Restore backup")}</button>
        <button className="primary" onClick={doSave}>{t("Save")}</button>
      </div>
      {jsonError && <ErrorNotice error={`json error: ${jsonError}`} />}
      {status && (failed ? <ErrorNotice error={String(status.values?.error ?? "")} /> : <p role="status" className="update">{t(status.key, status.values)}</p>)}

      {sub === "form" ? (
        <div className="config-form">
          <SwitcherSection config={config} onChange={onChange} />
          <ObsSection config={config} onChange={onChange} />
          <ScenesSection config={config} onChange={onChange} />
          <OptionsSection config={config} onChange={onChange} />
          <StreamServersSection config={config} onChange={onChange} />
          <ChatSection config={config} onChange={onChange} />
        </div>
      ) : (
        <Suspense fallback={<p>{t("Loading…")}</p>}><RawJsonEditor value={jsonText} onChange={setJsonText} /></Suspense>
      )}
    </section>
  );
}
