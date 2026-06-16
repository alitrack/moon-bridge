import { PageHeader } from "../shared";
import { useI18n } from "../../i18n/I18nProvider";
import { LogPanel } from "./LogPanel";

export function LogsPage() {
  const { t } = useI18n();
  return (
    <section className="page-stack" aria-labelledby="logs-title">
      <PageHeader eyebrow={t("pageEyebrow.runtime")} title={t("nav.logs")}>
        {t("logs.description")}
      </PageHeader>
      <LogPanel />
    </section>
  );
}
