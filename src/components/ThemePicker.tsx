import { useEffect, useState } from "react";
import { api } from "../api";
import type { Theme } from "../bindings/Theme";
import { applyTheme } from "../theme";
import { useI18n } from "../i18n";
import { ErrorNotice } from "./ErrorNotice";

export function ThemePicker() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    api.getSettings().then(settings => { if (active) setTheme(settings.theme); }).catch(e => { if (active) setError(String(e)); });
    const changed = (event: Event) => setTheme((event as CustomEvent<Theme>).detail);
    window.addEventListener("themechange", changed);
    return () => { active = false; window.removeEventListener("themechange", changed); };
  }, []);
  const change = async (next: Theme) => {
    setBusy(true);
    setError(null);
    try {
      const settings = await api.getSettings();
      await api.saveSettings({ ...settings, theme: next });
      applyTheme(next);
      window.dispatchEvent(new CustomEvent("themechange", { detail: next }));
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  };
  return <div className="theme-picker">
    <label>{t("Theme")}
      <select aria-label={t("Theme")} value={theme ?? ""} disabled={busy || theme === null} onChange={event => void change(event.target.value as Theme)}>
        {theme === null && <option value="">{t("Loading…")}</option>}
        <option value="system">{t("Follow system")}</option>
        <option value="light">{t("Light")}</option>
        <option value="dark">{t("Dark")}</option>
      </select>
    </label>
    {error && <ErrorNotice error={error} />}
  </div>;
}
