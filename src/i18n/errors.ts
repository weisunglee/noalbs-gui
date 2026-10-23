/** Presentation-only classification of the existing Tauri string error contract. */
export function errorMessageKey(error: string): string {
  const known: Record<string, string> = {
    "no working directory or binary path set": "error.workingDirectory",
    "noalbs binary not found; download it or set a manual path": "error.binaryMissing",
    "noalbs is not running": "error.notRunning",
    "already running": "error.alreadyRunning",
    "no backup found": "error.backupMissing",
    "no release asset found for this OS/architecture": "error.noAsset",
  };
  if (Object.prototype.hasOwnProperty.call(known, error)) return known[error];
  if (error.startsWith("io error:")) return "error.io";
  if (error.startsWith("http error:")) return "error.http";
  if (error.startsWith("json error:")) return "error.json";
  if (error.startsWith("zip error:") || error.startsWith("extraction task failed:")) return "error.archive";
  return "error.unknown";
}
