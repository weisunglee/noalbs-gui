import type { Config } from "../../bindings/Config";
import { ServerEntryEditor } from "./ServerEntryEditor";
import { makeDefaultEntry } from "../serverTypes";

export function StreamServersSection({ config, onChange }: { config: Config; onChange: (c: Config) => void }) {
  const servers = config.switcher.streamServers;
  const setServers = (next: typeof servers) =>
    onChange({ ...config, switcher: { ...config.switcher, streamServers: next } });

  const update = (i: number, e: (typeof servers)[number]) =>
    setServers(servers.map((s, idx) => (idx === i ? e : s)));
  const remove = (i: number) => setServers(servers.filter((_, idx) => idx !== i));
  const add = () => setServers([...servers, makeDefaultEntry()]);

  return (
    <fieldset>
      <legend>Stream servers ({servers.length})</legend>
      {servers.length === 0 && <p className="note">No stream servers. Add one below.</p>}
      {servers.map((s, i) => (
        <ServerEntryEditor key={i} entry={s} onChange={(e) => update(i, e)} onRemove={() => remove(i)} />
      ))}
      <button type="button" onClick={add}>+ Add stream server</button>
    </fieldset>
  );
}
