import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { Config } from "../bindings/Config";

export type ConfigState = {
  config: Config | null;
  loaded: boolean;
  missing: boolean; // no config.json yet
  error: string | null;
  setConfig: (c: Config) => void;
  reload: () => Promise<void>;
  save: () => Promise<{ running: boolean }>;
};

export function useConfig(): ConfigState {
  const [config, setConfigState] = useState<Config | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const c = await api.getConfig();
      setMissing(c === null);
      setConfigState(c);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const save = useCallback(async () => {
    if (!config) throw new Error("no config to save");
    const res = await api.saveConfig(JSON.stringify(config, (_, v) =>
      typeof v === "bigint" ? Number(v) : v
    , 2));
    setConfigState(res.config);
    setMissing(false);
    return { running: res.running };
  }, [config]);

  return {
    config,
    loaded,
    missing,
    error,
    setConfig: setConfigState,
    reload,
    save,
  };
}
