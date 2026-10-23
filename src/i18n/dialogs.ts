import { confirm } from "@tauri-apps/plugin-dialog";
import { useI18n } from "./index";

/** Translate app-owned buttons; native filesystem dialog chrome follows the OS. */
export function useLocalizedConfirm() {
  const { t } = useI18n();
  return (message: string) => confirm(message, {
    title: "NOALBS", kind: "warning", okLabel: t("Confirm"), cancelLabel: t("Cancel"),
  });
}
