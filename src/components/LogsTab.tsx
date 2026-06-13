import { useEffect, useRef, useState } from "react";
import { api, onLog } from "../api";
import type { LogLine } from "../bindings/LogLine";

export function LogsTab() {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [filter, setFilter] = useState("");
  const [autoscroll, setAutoscroll] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      setLines(await api.getLogBuffer());
      unlisten = await onLog((line) => setLines((prev) => [...prev, line].slice(-5000)));
    })();
    return () => unlisten?.();
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
        <input placeholder="filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <label>
          <input type="checkbox" checked={autoscroll} onChange={(e) => setAutoscroll(e.target.checked)} />
          autoscroll
        </label>
        <button onClick={() => setLines([])}>clear view</button>
      </div>
      <div className="logs-list">
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
