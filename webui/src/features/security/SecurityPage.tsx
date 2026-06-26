import { LoadingState } from "../../components/LoadingState";
import { useI18n } from "../../i18n/I18nProvider";
import type { ConfigResource } from "../../rpc/types";
import { ResourceEditorCard } from "../configGraph/ResourceEditorCard";
import { useConfigGraph } from "../configGraph/useConfigGraph";
import { PageHeader, QueryErrorState } from "../shared";

export function SecurityPage() {
  const { t } = useI18n();
  const graph = useConfigGraph();

  if (graph.error) {
    return <QueryErrorState error={graph.error} />;
  }
  if (graph.isLoading || !graph.data) {
    return <LoadingState label={t("common.loading")} />;
  }

  const server = graph.data.resources.find((resource) => resource.kind === "server");

  return (
    <section className="page-stack" aria-labelledby="security-title">
      <PageHeader eyebrow={t("pageEyebrow.config")} title={t("nav.security")}>
        {t("security.description")}
      </PageHeader>

      {server ? <ServerSection resource={server} revision={graph.data.revision} /> : null}
    </section>
  );
}

function ServerSection({
  resource,
  revision
}: {
  resource: ConfigResource;
  revision: string;
}) {
  const { t } = useI18n();
  const title = t("security.server");
  return (
    <section className="resource-section" aria-label={title}>
      <h2>{title}</h2>
      <ResourceEditorCard
        ariaLabel={t("resource.cardLabel", { title, id: resource.id })}
        resource={resource}
        revision={revision}
        title={title}
      />
    </section>
  );
}
