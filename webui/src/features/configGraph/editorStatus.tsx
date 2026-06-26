import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { AutosaveFieldStatus } from "./useAutosaveField";

export type FieldStatusReporter = (id: string, status: AutosaveFieldStatus) => void;

const EditorStatusContext = createContext<FieldStatusReporter | null>(null);

export function EditorStatusProvider({
  report,
  children
}: {
  report: FieldStatusReporter;
  children: ReactNode;
}) {
  return <EditorStatusContext.Provider value={report}>{children}</EditorStatusContext.Provider>;
}

/**
 * Reports a single field's live autosave status up to the nearest editor card so
 * the card can show one consolidated indicator instead of one per field.
 */
export function useReportFieldStatus(id: string, status: AutosaveFieldStatus) {
  const report = useContext(EditorStatusContext);
  useEffect(() => {
    report?.(id, status);
  }, [report, id, status]);
  useEffect(() => {
    return () => {
      report?.(id, "idle");
    };
  }, [report, id]);
}
