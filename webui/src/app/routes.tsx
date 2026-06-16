import { Navigate, Outlet, createBrowserRouter } from "react-router-dom";
import { App } from "./App";
import type { MessageKey } from "../i18n/messages";
import { useI18n } from "../i18n/I18nProvider";
import { DefaultsPage } from "../features/defaults/DefaultsPage";
import { ModelsProvidersPage } from "../features/modelProviders/ModelsProvidersPage";
import { OverviewPage } from "../features/overview/OverviewPage";
import { RoutesPage } from "../features/routes/RoutesPage";
import { SearchToolsPage } from "../features/searchTools/SearchToolsPage";
import { SecurityPage } from "../features/security/SecurityPage";
import { StoragePage } from "../features/storage/StoragePage";

export function RouteOutlet() {
  return <Outlet />;
}

export const routes = [
  { index: true, element: <Navigate to="/overview" replace /> },
  { path: "overview", element: <OverviewPage /> },
  { path: "models-providers", element: <ModelsProvidersPage /> },
  { path: "routes", element: <RoutesPage /> },
  { path: "defaults", element: <DefaultsPage /> },
  { path: "search-tools", element: <SearchToolsPage /> },
  { path: "storage", element: <StoragePage /> },
  { path: "security", element: <SecurityPage /> },
  { path: "logs", element: <Navigate to="/overview#logs" replace /> }
];

export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <App />,
      children: routes
    }
  ],
  { basename: "/console" }
);
