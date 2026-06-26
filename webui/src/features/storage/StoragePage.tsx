import { LoadingState } from "../../components/LoadingState";
import { useI18n } from "../../i18n/I18nProvider";
import type { ConfigResource, FieldError } from "../../rpc/types";
import { ResourceEditorCard } from "../configGraph/ResourceEditorCard";
import { useConfigGraph } from "../configGraph/useConfigGraph";
import { PageHeader, QueryErrorState } from "../shared";

const storageKinds = new Set(["cache", "persistence"]);

export function StoragePage() {
  const { t } = useI18n();
  const graph = useConfigGraph();

  if (graph.error) {
    return <QueryErrorState error={graph.error} />;
  }
  if (graph.isLoading || !graph.data) {
    return <LoadingState label={t("common.loading")} />;
  }

  const cache = graph.data.resources.find((resource) => resource.kind === "cache");
  const persistence = graph.data.resources.find((resource) => resource.kind === "persistence");
  const storageErrors = (graph.data.runtime.errors ?? []).filter((error) =>
    storageKinds.has(error.resourceKind)
  );

  return (
    <section className="page-stack" aria-labelledby="storage-title">
      <PageHeader eyebrow={t("pageEyebrow.config")} title={t("nav.storage")}>
        {t("storage.description")}
      </PageHeader>

      {storageErrors.length > 0 ? <ErrorList errors={storageErrors} /> : null}
      {cache ? (
        <ResourceSection
          resource={cache}
          revision={graph.data.revision}
          title={t("storage.cache")}
        />
      ) : null}
      {persistence ? (
        <ResourceSection
          resource={persistence}
          revision={graph.data.revision}
          title={t("storage.persistence")}
        />
      ) : null}
    </section>
  );
}

function ErrorList({ errors }: { errors: FieldError[] }) {
  const { t } = useI18n();
  return (
    <section className="content-panel" aria-label={t("storage.errors")}>
      <h2>{t("storage.status")}</h2>
      <ul className="compact-list">
        {errors.map((error) => (
          <li key={`${error.resourceKind}-${error.resourceId}-${error.field}-${error.code}`}>
            <strong>{error.resourceId || error.resourceKind}</strong>
            <span>{error.message}</span>
          </li>
        ))}
      </ul>
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
