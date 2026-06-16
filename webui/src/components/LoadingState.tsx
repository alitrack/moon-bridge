import { useI18n } from "../i18n/I18nProvider";

export function LoadingState({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <section className="state-panel" aria-busy="true">
      <p className="eyebrow">{t("common.loading")}</p>
      <h2>{label ?? t("common.loading")}</h2>
    </section>
  );
}
