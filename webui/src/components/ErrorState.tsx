import { useI18n } from "../i18n/I18nProvider";

export function ErrorState({ title, message }: { title?: string; message: string }) {
  const { t } = useI18n();
  return (
    <section className="state-panel" role="alert">
      <p className="eyebrow">{t("common.error")}</p>
      <h2>{title ?? t("error.requestFailed")}</h2>
      <p>{message}</p>
    </section>
  );
}
