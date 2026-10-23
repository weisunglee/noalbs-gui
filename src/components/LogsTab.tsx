import { useI18n } from "../i18n";
import { useEffect, useRef, useState } from "react";
import { api, onLog } from "../api";
import type { LogLine } from "../bindings/LogLine";
import { ErrorNotice } from "./ErrorNotice";

export function LogsTab() {
  const { t } = useI18n();
  const [lines, setLines] = useState<LogLine[]>([]);
  const [filter, setFilter] = useState("");
  const [autoscroll, setAutoscroll] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let active = true;
    (async () => {
      const buffer = await api.getLogBuffer();
      if (!active) return;
      setLines(buffer);
      const stop = await onLog((line) => setLines((prev) => [...prev, line].slice(-5000)));
      if (active) unlisten = stop; else stop();
    })().catch(e => { if (active) setError(String(e)); });
    return () => { active = false; unlisten?.(); };
  }, []);

  useEffect(() => {
    if (autoscroll) endRef.current?.scrollIntoView({ behavior: "auto" });
  }, [lines, autoscroll]);

  const shown = filter
    ? lines.filter((l) => l.text.toLowerCase().includes(filter.toLowerCase()))
    : lines;

  return (
    <section className="logs">
      <div className="row">
        <input aria-label={t("filter…")} placeholder={t("filter…")} value={filter} onChange={(e) => setFilter(e.target.value)} />
        <label>
          <input type="checkbox" checked={autoscroll} onChange={(e) => setAutoscroll(e.target.checked)} />
          {t("autoscroll")}</label>
        <button onClick={() => { setError(null); api.clearLogs().then(() => setLines([])).catch(e => setError(String(e))); }}>{t("Clear")}</button>
      </div>
      {error && <ErrorNotice error={error} />}
      <div className="logs-list">
        {shown.length === 0 && <p>{t(filter ? "No matching log entries." : "No log entries.")}</p>}
        {shown.map((l) => (
          <div key={String(l.seq)} className={l.stream === "stderr" ? "stderr" : "stdout"}>
            {l.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </section>
  );
}
