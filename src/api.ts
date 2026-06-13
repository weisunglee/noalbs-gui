import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Settings } from "./bindings/Settings";
import type { LogLine } from "./bindings/LogLine";
import type { Config } from "./bindings/Config";
import type { SaveConfigResult } from "./bindings/SaveConfigResult";
import type { EnvValues } from "./bindings/EnvValues";
import type { DashboardSnapshot } from "./bindings/DashboardSnapshot";
import type { NoalbsStatus } from "./bindings/NoalbsStatus";

export const api = {
  getSettings: () => invoke<Settings>("get_settings"),
  getConfig: () => invoke<Config | null>("get_config"),
  saveConfig: (json: string) => invoke<SaveConfigResult>("save_config", { json }),
  saveSettings: (settings: Settings) => invoke<void>("save_settings", { settings }),
  setManualBinaryPath: (path: string) =>
    invoke<Settings>("set_manual_binary_path", { path }),
  checkUpdate: () => invoke<string | null>("check_update"),
  downloadBinary: () => invoke<Settings>("download_binary"),
  getLogBuffer: () => invoke<LogLine[]>("get_log_buffer"),
  clearLogs: () => invoke<void>("clear_logs"),
  getStatus: () => invoke<boolean>("get_status"),
  start: () => invoke<void>("start_noalbs"),
  stop: () => invoke<void>("stop_noalbs"),
  restart: () => invoke<void>("restart_noalbs"),
  getEnv: () => invoke<EnvValues>("get_env"),
  saveEnv: (values: EnvValues) => invoke<void>("save_env", { values }),
  getDashboard: () => invoke<DashboardSnapshot>("get_dashboard"),
};

export function onLog(cb: (line: LogLine) => void): Promise<UnlistenFn> {
  return listen<LogLine>("noalbs-log", (e) => cb(e.payload));
}
export function onExit(cb: (code: number | null) => void): Promise<UnlistenFn> {
  return listen<number | null>("noalbs-exit", (e) => cb(e.payload));
}
export function onStatus(cb: (s: NoalbsStatus) => void): Promise<UnlistenFn> {
  return listen<NoalbsStatus>("noalbs-status", (e) => cb(e.payload));
}
