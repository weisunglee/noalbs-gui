import { useI18n } from "../i18n";
import { errorMessageKey } from "../i18n/errors";

export function ErrorNotice({ error }: { error: string }) {
  const { t } = useI18n();
  return <div className="error" role="alert">
    <p>{t(errorMessageKey(error))}</p>
    <details><summary>{t("Error details")}</summary><pre>{error}</pre></details>
  </div>;
}
