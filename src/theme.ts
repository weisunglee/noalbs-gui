import type { Theme } from "./bindings/Theme";

function resolve(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme; // "light" | "dark"
}

/** Apply a theme to the document root (sets data-theme to a concrete light/dark). */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = resolve(theme);
}

/** Re-apply when the OS theme changes, but only while the setting is "system".
 * Returns an unsubscribe fn. `getTheme` is read live so it always sees the latest. */
export function watchSystemTheme(getTheme: () => Theme): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    if (getTheme() === "system") applyTheme("system");
  };
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}
