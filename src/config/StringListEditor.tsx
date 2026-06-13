export function StringListEditor({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="subfield">
      <span>{label}:</span>
      {items.map((item, i) => (
        <span key={i} className="row">
          <input value={item} onChange={(e) => onChange(items.map((x, idx) => (idx === i ? e.target.value : x)))} />
          <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>x</button>
        </span>
      ))}
      <button type="button" onClick={() => onChange([...items, ""])}>+ add</button>
    </div>
  );
}
