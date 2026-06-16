import { type ReactNode } from "react";
import { MaterialDialog } from "../../components/MaterialDialog";
import { useI18n } from "../../i18n/I18nProvider";
import type { ConfigResource } from "../../rpc/types";
import { ResourceEditorCard } from "./ResourceEditorCard";

/**
 * Modal editor for a single config resource. Wraps the full (embedded)
 * ResourceEditorCard inside an official md-dialog so a long list of models,
 * providers or routes stays scannable: the page shows compact summary rows and
 * the full field surface only mounts when one entry is opened.
 */
export function ResourceEditorDialog({
  onClose,
  open,
  resource,
  revision,
  modelDisplayNames,
  title,
  children
}: {
  onClose: () => void;
  open: boolean;
  resource: ConfigResource;
  revision: string;
  modelDisplayNames?: Record<string, string>;
  title?: string;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const resourceTitle = title ?? resource.label;

  return (
    <MaterialDialog
      open={open}
      onClose={onClose}
      ariaLabel={t("resource.editorAriaLabel", { title: resourceTitle, id: resource.id })}
      headline={t("resource.editorHeading", { title: resourceTitle })}
      className="resource-editor-dialog"
    >
      <ResourceEditorCard
        embedded
        resource={resource}
        revision={revision}
        modelDisplayNames={modelDisplayNames}
        title={title}
      >
        {children}
      </ResourceEditorCard>
    </MaterialDialog>
  );
}
