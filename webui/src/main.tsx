import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { MotionConfig } from "motion/react";
import { router } from "./app/routes";
import { queryClient } from "./app/queryClient";
import { ConsoleAuthProvider } from "./app/auth/ConsoleAuthContext";
import { I18nProvider } from "./i18n/I18nProvider";
import { ThemeProvider } from "./theme/ThemeProvider";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ThemeProvider>
          <MotionConfig reducedMotion="user">
            <ConsoleAuthProvider>
              <RouterProvider router={router} />
            </ConsoleAuthProvider>
          </MotionConfig>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>
);
