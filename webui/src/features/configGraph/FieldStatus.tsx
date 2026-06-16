import { useI18n } from "../../i18n/I18nProvider";
import type { MessageKey } from "../../i18n/messages";
import type { AutosaveFieldStatus } from "./useAutosaveField";

const statusLabelKeys: Record<AutosaveFieldStatus, MessageKey> = {
  idle: "saveStatus.idle",
  dirty: "saveStatus.dirty",
  saving: "saveStatus.saving",
  saved: "saveStatus.saved",
  error: "saveStatus.error"
};

export function FieldStatus({
  status,
  message
}: {
  status: AutosaveFieldStatus;
  message?: string;
}) {
  const { t } = useI18n();
  const label = status === "error" && message ? message : t(statusLabelKeys[status]);
  return (
    <span
      aria-live="polite"
      className={`field-status field-status--${status}`}
      data-status={status}
      role={status === "error" ? "alert" : "status"}
    >
      <span className="field-status__dot" aria-hidden="true" />
      {label}
    </span>
  );
}
