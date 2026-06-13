import { useState } from "react";
import { api } from "../api";
import type { Config } from "../bindings/Config";
import { useConfig } from "./useConfig";
import { SwitcherSection } from "./sections/SwitcherSection";
import { ScenesSection } from "./sections/ScenesSection";
import { ObsSection } from "./sections/ObsSection";
import { OptionsSection } from "./sections/OptionsSection";
import { StreamServersSection } from "./sections/StreamServersSection";
import { ChatSection } from "./sections/ChatSection";
import { EnvSection } from "./sections/EnvSection";
import { RawJsonEditor } from "./RawJsonEditor";

type Sub = "form" | "advanced";

export function ConfigTab() {
  const cfg = useConfig();
  const [sub, setSub] = useState<Sub>("form");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  if (!cfg.loaded) return <p>Loading…</p>;
  if (cfg.error) return <p className="error">{cfg.error}</p>;
  if (cfg.missing || !cfg.config) {
    return (
      <section>
        <p>No <code>config.json</code> found in the working directory.</p>
        <p>Set a working directory (or download/select the binary) and create a config — full template support comes later. For now, create a config.json next to the binary, then reload.</p>
        <button onClick={() => cfg.reload()}>Reload</button>
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
        setJsonError(`Invalid JSON: ${String(e)}`);
      }
    }
  };

  const onChange = (c: Config) => cfg.setConfig(c);

  const doSave = async () => {
    setStatus(null);
    try {
      // On the Advanced tab, save the raw JSON text verbatim (the in-state
      // config may lag the editor). The backend validates it before writing.
      const { running } = await cfg.save(sub === "advanced" ? jsonText : undefined);
      if (running) {
        if (confirm("Config saved. Restart noalbs to apply the changes now?")) {
          await api.restart();
          setStatus("Saved and restarted noalbs.");
        } else {
          setStatus("Saved. Restart noalbs to apply.");
        }
      } else {
        setStatus("Saved.");
      }
    } catch (e) {
      setStatus(`Error: ${String(e)}`);
    }
  };

  return (
    <section>
      <div className="row">
        <button className={sub === "form" ? "active" : ""} onClick={() => switchTo("form")}>Form</button>
        <button className={sub === "advanced" ? "active" : ""} onClick={() => switchTo("advanced")}>Advanced (JSON)</button>
        <span style={{ flex: 1 }} />
        <button onClick={doSave}>Save</button>
      </div>
      {jsonError && <p className="error">{jsonError}</p>}
      {status && <p className={status.startsWith("Error") ? "error" : "update"}>{status}</p>}

      {sub === "form" ? (
        <div className="config-form">
          <SwitcherSection config={config} onChange={onChange} />
          <ObsSection config={config} onChange={onChange} />
          <ScenesSection config={config} onChange={onChange} />
          <OptionsSection config={config} onChange={onChange} />
          <StreamServersSection config={config} onChange={onChange} />
          <ChatSection config={config} onChange={onChange} />
          <EnvSection />
        </div>
      ) : (
        <RawJsonEditor value={jsonText} onChange={setJsonText} />
      )}
    </section>
  );
}
