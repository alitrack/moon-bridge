import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import type { Locale } from "../i18n/messages";
import { I18nProvider, CONSOLE_LOCALE_STORAGE_KEY } from "../i18n/I18nProvider";
import { ThemeProvider } from "../theme/ThemeProvider";
import { ConsoleAuthProvider } from "../app/auth/ConsoleAuthContext";
import { shellStyles } from "../app/styles/shellStyles";

export function renderWithConsoleProviders(
  ui: ReactElement,
  options: { locale?: Locale } = {}
) {
  localStorage.setItem(CONSOLE_LOCALE_STORAGE_KEY, options.locale ?? "en-US");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <ThemeProvider>
          <style>{shellStyles}</style>
          <ConsoleAuthProvider>{ui}</ConsoleAuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
