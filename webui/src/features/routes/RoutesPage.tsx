import { useState } from "react";
import { LoadingState } from "../../components/LoadingState";
import { useI18n } from "../../i18n/I18nProvider";
import { CreateResourcePanel } from "../configGraph/CreateResourcePanel";
import { ResourceEditorDialog } from "../configGraph/ResourceEditorDialog";
import { ResourceEditorCard } from "../configGraph/ResourceEditorCard";
import { useConfigGraph } from "../configGraph/useConfigGraph";
import { modelDisplayNamesById } from "../configGraph/modelProviderIcons";
import { PageHeader, QueryErrorState } from "../shared";

export function RoutesPage() {
  const { t } = useI18n();
  const graph = useConfigGraph();
  const [editingId, setEditingId] = useState<string | null>(null);

  if (graph.error) {
    return <QueryErrorState error={graph.error} />;
  }
  if (graph.isLoading || !graph.data) {
    return <LoadingState label={t("loading.routes")} />;
  }

  const routes = graph.data.resources.filter((resource) => resource.kind === "route");
  const routeTitle = t("routes.resourceTitle");
  const modelDisplayNames = modelDisplayNamesById(graph.data.resources);
  const editing = editingId ? routes.find((route) => route.id === editingId) : undefined;

  return (
    <section className="page-stack" aria-labelledby="routes-title">
      <PageHeader eyebrow={t("pageEyebrow.aliases")} title={t("nav.routes")}>
        {t("routes.description")}
      </PageHeader>

      <section className="resource-section" aria-labelledby="routes-list-heading">
        <div className="section-heading">
          <h2 id="routes-list-heading">{t("routes.listTitle", { count: routes.length })}</h2>
          <CreateResourcePanel graph={graph.data} kind="route" />
        </div>
        <div className="resource-card-list resource-card-list--summary">
          {routes.map((route) => (
            <ResourceEditorCard
              ariaLabel={t("resource.cardLabel", { title: routeTitle, id: route.id })}
              key={route.id}
              modelDisplayNames={modelDisplayNames}
              onOpenEditor={() => setEditingId(route.id)}
              resource={route}
              revision={graph.data!.revision}
              title={routeTitle}
              variant="summary"
            />
          ))}
        </div>
      </section>

      {editing ? (
        <ResourceEditorDialog
          open
          onClose={() => setEditingId(null)}
          modelDisplayNames={modelDisplayNames}
          resource={editing}
          revision={graph.data!.revision}
          title={routeTitle}
        />
      ) : null}
    </section>
  );
}
