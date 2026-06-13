import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";

export function RawJsonEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <CodeMirror value={value} height="60vh" extensions={[json()]} onChange={onChange} />
  );
}
