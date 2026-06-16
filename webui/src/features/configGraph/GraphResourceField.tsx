import { useCallback } from "react";
import type { ConfigResource, FieldSchema } from "../../rpc/types";
import { useI18n } from "../../i18n/I18nProvider";
import { SchemaField, type SchemaFieldProps } from "./SchemaField";
import { configDocPathForResource } from "./configDocPath";
import { useAutosaveField, type SaveFieldRequest } from "./useAutosaveField";
import { useReportFieldStatus } from "./editorStatus";
import { useConfigGraph, useGraphFieldSaver } from "./useConfigGraph";
import { modelSelectOptions, providerSelectOptions, resourceFieldModelIcon } from "./modelProviderIcons";

export function GraphResourceField({
  resource,
  field,
  objectDisplay,
  revision,
  modelDisplayNames = {}
}: {
  modelDisplayNames?: Record<string, string>;
  resource: ConfigResource;
  field: FieldSchema;
  objectDisplay?: "collapsible" | "expandedFixed";
  revision: string;
}) {
  const { t } = useI18n();
  const graph = useConfigGraph();
  const saveGraphField = useGraphFieldSaver<unknown>();
  const save = useCallback(
    (request: SaveFieldRequest<unknown>) => saveGraphField(request),
    [saveGraphField]
  );
  const autosave = useAutosaveField({
    resourceKind: resource.kind,
    resourceId: resource.id,
    field: field.path,
    committedValue: resource.value[field.path],
    revision,
    save,
    configUpdateFailedMessage: (result) => t("field.configUpdateFailed", { result }),
    requestFailedMessage: t("error.requestFailed")
  });
  useReportFieldStatus(`${resource.kind}:${resource.id}:${field.path}`, autosave.status);
  const draftResource = {
    ...resource,
    value: {
      ...resource.value,
      [field.path]: autosave.value
    }
  };

  const routeSelect = resource.kind === "route" && (field.path === "model" || field.path === "provider")
    ? routeSelectProps(field.path, autosave.value, graph.data?.resources ?? [], t)
    : undefined;

  return (
    <SchemaField
      error={autosave.error?.message}
      field={field}
      idPrefix={`${resource.kind}-${resource.id}`}
      leadingIconNode={resourceFieldModelIcon(draftResource, field, modelDisplayNames)}
      docPath={configDocPathForResource(resource, field)}
      objectDisplay={objectDisplay}
      options={routeSelect?.options}
      warning={routeSelect?.warning}
      onChange={autosave.setValue}
      onCommit={autosave.commit}
      onCommitValue={autosave.commitValue}
      clearSecretDraft={autosave.status === "saved"}
      value={autosave.value}
    />
  );
}

/** Build select options + an invalid/missing warning for a route's model or provider field. */
function routeSelectProps(
  path: "model" | "provider",
  value: unknown,
  resources: ConfigResource[],
  t: ReturnType<typeof useI18n>["t"]
): Pick<SchemaFieldProps, "options" | "warning"> {
  const options = path === "model" ? modelSelectOptions(resources) : providerSelectOptions(resources);
  const text = typeof value === "string" ? value.trim() : "";
  const known = options.some((option) => option.value === text);
  let warning: string | undefined;
  if (!text) {
    warning = path === "model" ? t("route.warning.modelMissing") : t("route.warning.providerMissing");
  } else if (!known) {
    warning = path === "model"
      ? t("route.warning.modelUnknown", { value: text })
      : t("route.warning.providerUnknown", { value: text });
  }
  return { options, warning };
}
