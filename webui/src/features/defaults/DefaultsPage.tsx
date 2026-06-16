import { LoadingState } from "../../components/LoadingState";
import { useI18n } from "../../i18n/I18nProvider";
import type { MessageKey } from "../../i18n/messages";
import type { ConfigResource } from "../../rpc/types";
import { modelDisplayNamesById } from "../configGraph/modelProviderIcons";
import { ResourceEditorCard } from "../configGraph/ResourceEditorCard";
import { useConfigGraph } from "../configGraph/useConfigGraph";
import { PageHeader, QueryErrorState } from "../shared";

const defaultResourceOrder = ["defaults", "trace", "log"] as const;
const defaultResourceTitleKeys: Record<(typeof defaultResourceOrder)[number], MessageKey> = {
  defaults: "resource.kind.defaults",
  trace: "resource.kind.trace",
  log: "resource.kind.log"
};

export function DefaultsPage() {
  const { t } = useI18n();
  const graph = useConfigGraph();

  if (graph.error) {
    return <QueryErrorState error={graph.error} />;
  }
  if (graph.isLoading || !graph.data) {
    return <LoadingState label={t("common.loading")} />;
  }

  const resources = defaultResourceOrder
    .map((kind) => graph.data.resources.find((resource) => resource.kind === kind))
    .filter((resource): resource is ConfigResource => Boolean(resource));
  const modelDisplayNames = modelDisplayNamesById(graph.data.resources);

  return (
    <section className="page-stack" aria-labelledby="defaults-title">
      <PageHeader eyebrow={t("pageEyebrow.config")} title={t("nav.defaults")}>
        {t("config.description")}
      </PageHeader>

      {resources.map((resource) => (
        <DefaultResourceSection
          key={resource.kind}
          modelDisplayNames={modelDisplayNames}
          resource={resource}
          revision={graph.data.revision}
        />
      ))}
    </section>
  );
}

function DefaultResourceSection({
  resource,
  revision,
  modelDisplayNames
}: {
  modelDisplayNames: Record<string, string>;
  resource: ConfigResource;
  revision: string;
}) {
  const { t } = useI18n();
  const titleKey = defaultResourceTitleKeys[resource.kind as (typeof defaultResourceOrder)[number]];
  const title = titleKey ? t(titleKey) : resource.label;
  return (
    <section className="resource-section" aria-label={title}>
      <h2>{title}</h2>
      <ResourceEditorCard
        ariaLabel={t("resource.cardLabel", { title, id: resource.id })}
        modelDisplayNames={modelDisplayNames}
        resource={resource}
        revision={revision}
        title={title}
      />
    </section>
  );
}
