import { useI18n } from "../i18n/I18nProvider";

export function PlaceholderPage({ title }: { title: string }) {
  const { t } = useI18n();

  return (
    <section className="placeholder-panel" aria-labelledby="page-title">
      <div>
        <p className="eyebrow">{t("placeholder.eyebrow")}</p>
        <h1 id="page-title">{title}</h1>
        <p>{t("placeholder.description")}</p>
      </div>
    </section>
  );
}
