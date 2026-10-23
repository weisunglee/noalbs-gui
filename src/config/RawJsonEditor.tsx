import { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror, { EditorState, EditorView } from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { useI18n } from "../i18n";
import { messages } from "../i18n/catalog";
import { closeSearchPanel, getSearchQuery, openSearchPanel, search, searchPanelOpen, setSearchQuery } from "@codemirror/search";

function useThemeMode(): "dark" | "light" {
  const read = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  const [mode, setMode] = useState<"dark" | "light">(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setMode(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return mode;
}

export function RawJsonEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const mode = useThemeMode();
  const { locale, t } = useI18n();
  const viewRef = useRef<EditorView | null>(null);
  const extensions = useMemo(() => [json(), search(), EditorState.phrases.of(messages[locale]),
    EditorView.contentAttributes.of({ "aria-label": messages[locale]["JSON editor"] })], [locale]);
  useEffect(() => {
    // CodeMirror builds search labels when the panel opens, not on reconfiguration.
    // Refresh only the panel, preserving the document, search query and undo history.
    // Wait until react-codemirror has applied its extension reconfiguration.
    const frame = requestAnimationFrame(() => {
      const view = viewRef.current;
      if (view && searchPanelOpen(view.state)) {
        const focused = document.activeElement;
        const query = getSearchQuery(view.state);
        closeSearchPanel(view);
        openSearchPanel(view);
        view.dispatch({ effects: setSearchQuery.of(query) });
        if (focused instanceof HTMLElement && focused.isConnected) focused.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [locale]);
  return <CodeMirror aria-label={t("JSON editor")} value={value} height="60vh" theme={mode} extensions={extensions} onCreateEditor={view => { viewRef.current = view; }} onChange={onChange} />;
}
