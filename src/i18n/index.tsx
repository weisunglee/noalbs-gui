import { useEffect, useSyncExternalStore } from "react";
import { locales, resolveLocale, translate, type Locale } from "./catalog";
export { localeNames, locales } from "./catalog";

const storageKey = "noalbs-gui.locale";
function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(storageKey);
    if (locales.includes(saved as Locale)) return saved as Locale;
  } catch { /* Storage may be unavailable; language selection still works. */ }
  return resolveLocale(navigator.languages);
}
let locale = initialLocale();
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function setLocale(next: Locale) {
  locale = next;
  try { localStorage.setItem(storageKey, next); } catch { /* Keep the in-memory choice. */ }
  document.documentElement.lang = next;
  listeners.forEach(listener => listener());
}
export function useI18n() {
  const current = useSyncExternalStore(subscribe, () => locale);
  useEffect(() => { document.documentElement.lang = current; }, [current]);
  return { locale: current, setLocale, t: (key: string, values?: Record<string, string | number>) => translate(current, key, values) };
}
