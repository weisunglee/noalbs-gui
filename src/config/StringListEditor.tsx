import { useI18n } from "../i18n";
export function StringListEditor({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  const { t } = useI18n();
  return (
    <div className="subfield">
      <span>{label}:</span>
      {items.map((item, i) => (
        <span key={i} className="row">
          <input aria-label={`${label} ${i + 1}`} value={item} onChange={(e) => onChange(items.map((x, idx) => (idx === i ? e.target.value : x)))} />
          <button type="button" aria-label={`${t("remove")} ${label} ${i + 1}`} onClick={() => onChange(items.filter((_, idx) => idx !== i))}>×</button>
        </span>
      ))}
      <button type="button" onClick={() => onChange([...items, ""])}>{t("+ add")}</button>
    </div>
  );
}
