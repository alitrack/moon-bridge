import { useQuery } from "@tanstack/react-query";
import { LoadingState } from "../../components/LoadingState";
import { useI18n } from "../../i18n/I18nProvider";
import { listExtensions } from "../../rpc/management";
import { queryKeys } from "../../rpc/queryKeys";
import type { ConfigResource } from "../../rpc/types";
import { CreateResourcePanel } from "../configGraph/CreateResourcePanel";
import { ResourceEditorCard } from "../configGraph/ResourceEditorCard";
import { useConfigGraph } from "../configGraph/useConfigGraph";
import { PageHeader, QueryErrorState } from "../shared";

export function SearchToolsPage() {
  const { t } = useI18n();
  const graph = useConfigGraph();
  const registeredExtensions = useQuery({
    queryKey: queryKeys.extensions,
    queryFn: listExtensions
  });

  if (graph.error) {
    return <QueryErrorState error={graph.error} />;
  }
  if (graph.isLoading || !graph.data) {
    return <LoadingState label={t("common.loading")} />;
  }

  const webSearch = graph.data.resources.find((resource) => resource.kind === "web_search");
  const extensions = graph.data.resources.filter((resource) => resource.kind === "extension");
  const proxy = graph.data.resources.find((resource) => resource.kind === "proxy");
  const existingExtensionIds = new Set(extensions.map((extension) => extension.id));
  const availableExtensionIds = (registeredExtensions.data ?? [])
    .filter((extensionId) => !existingExtensionIds.has(extensionId));

  return (
    <section className="page-stack" aria-labelledby="search-tools-title">
      <PageHeader eyebrow={t("pageEyebrow.config")} title={t("nav.searchTools")}>
        {t("searchTools.description")}
      </PageHeader>

      {webSearch ? (
        <ResourceSection
          resource={webSearch}
          revision={graph.data.revision}
          title={t("searchTools.webSearch")}
        />
      ) : null}

      <section className="resource-section" aria-labelledby="extensions-heading">
        <div className="section-heading">
          <h2 id="extensions-heading">{t("searchTools.extensions")}</h2>
          {registeredExtensions.isLoading ? (
            <span className="status-pill status-pill--muted">{t("common.loading")}</span>
          ) : registeredExtensions.error ? (
            <span className="field-error" role="alert">
              {registeredExtensions.error instanceof Error
                ? registeredExtensions.error.message
                : t("error.unknownRequest")}
            </span>
          ) : (
            <CreateResourcePanel
              availableExtensionIds={availableExtensionIds}
              graph={graph.data}
              kind="extension"
            />
          )}
        </div>
        <div className="resource-card-list">
          {extensions.map((extension) => (
            <ResourceEditorCard
              ariaLabel={t("resource.cardLabel", { title: t("searchTools.extension"), id: extension.id })}
              key={extension.id}
              resource={extension}
              revision={graph.data.revision}
              title={t("searchTools.extension")}
            />
          ))}
        </div>
      </section>

      {proxy ? (
        <ResourceSection
          resource={proxy}
          revision={graph.data.revision}
          title={t("searchTools.proxy")}
        />
      ) : null}
    </section>
  );
}

function ResourceSection({
  resource,
  revision,
  title
}: {
  resource: ConfigResource;
  revision: string;
  title: string;
}) {
  const { t } = useI18n();
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
