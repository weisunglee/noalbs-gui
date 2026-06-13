import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";

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
  return <CodeMirror value={value} height="60vh" theme={mode} extensions={[json()]} onChange={onChange} />;
}
