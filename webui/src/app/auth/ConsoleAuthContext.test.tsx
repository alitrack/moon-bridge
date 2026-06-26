import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { apiFetch, clearStoredToken, TOKEN_STORAGE_KEY } from "../../rpc/http";
import { CONSOLE_LOCALE_STORAGE_KEY, I18nProvider } from "../../i18n/I18nProvider";
import { ThemeProvider } from "../../theme/ThemeProvider";
import { ConsoleAuthProvider, useConsoleAuth } from "./ConsoleAuthContext";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init
  });
}

// Returns 200 for `Authorization: Bearer good`, otherwise a 401 — mirroring the server.
function authFetchMock() {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const headers = new Headers(init?.headers);
    if (headers.get("Authorization") === "Bearer good") {
      return Promise.resolve(jsonResponse({ ok: true }));
    }
    return Promise.resolve(
      jsonResponse(
        { error: { code: "invalid_auth", message: "missing or invalid token" } },
        { status: 401 }
      )
    );
  });
}

function Consumer() {
  const auth = useConsoleAuth();
  useQuery({
    queryKey: ["status"],
    queryFn: () => apiFetch<{ ok: boolean }>("/status")
  });
  return (
    <>
      <span data-testid="required">{String(auth.required)}</span>
      <span data-testid="pending">{String(auth.pending)}</span>
      <span data-testid="error">{auth.error?.message ?? ""}</span>
      <button onClick={() => void auth.authenticate("good", false)}>auth-good</button>
      <button onClick={() => void auth.authenticate("bad", false)}>auth-bad</button>
      <button onClick={() => auth.signOut()}>sign-out</button>
    </>
  );
}

function renderHarness() {
  localStorage.setItem(CONSOLE_LOCALE_STORAGE_KEY, "en-US");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <ThemeProvider>
          <ConsoleAuthProvider>
            <Consumer />
          </ConsoleAuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

const requiredEl = () => screen.getByTestId("required");
const pendingEl = () => screen.getByTestId("pending");
const errorEl = () => screen.getByTestId("error");

describe("ConsoleAuthProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearStoredToken();
    sessionStorage.clear();
    localStorage.clear();
  });

  test("locks the console and surfaces the message when a query returns 401", async () => {
    authFetchMock();
    renderHarness();

    await waitFor(() => expect(requiredEl()).toHaveTextContent("true"));
    expect(errorEl()).toHaveTextContent("missing or invalid token");
  });

  test("authenticate opens the gate after verifying a valid token", async () => {
    const fetchMock = authFetchMock();
    renderHarness();

    await waitFor(() => expect(requiredEl()).toHaveTextContent("true"));

    fireEvent.click(screen.getByText("auth-good"));

    await waitFor(() => expect(requiredEl()).toHaveTextContent("false"));
    expect(pendingEl()).toHaveTextContent("false");

    const sentGood = fetchMock.mock.calls.some(([, init]) => {
      const headers = new Headers(init?.headers);
      return headers.get("Authorization") === "Bearer good";
    });
    expect(sentGood).toBe(true);
  });

  test("authenticate keeps the gate locked and updates the message for a wrong token", async () => {
    authFetchMock();
    renderHarness();

    await waitFor(() => expect(requiredEl()).toHaveTextContent("true"));

    fireEvent.click(screen.getByText("auth-bad"));

    await waitFor(() => expect(pendingEl()).toHaveTextContent("false"));
    expect(requiredEl()).toHaveTextContent("true");
    expect(errorEl()).toHaveTextContent("missing or invalid token");
  });

  test("signOut clears the stored token and locks the console", async () => {
    authFetchMock();
    renderHarness();

    await waitFor(() => expect(requiredEl()).toHaveTextContent("true"));
    fireEvent.click(screen.getByText("auth-good"));
    await waitFor(() => expect(requiredEl()).toHaveTextContent("false"));
    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBe("good");

    fireEvent.click(screen.getByText("sign-out"));

    await waitFor(() => expect(requiredEl()).toHaveTextContent("true"));
    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(errorEl()).toHaveTextContent("Signed out");
  });

  test("useConsoleAuth throws when used outside the provider", () => {
    // Silence the expected error from React/error logging.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    function Orphan() {
      useConsoleAuth();
      return null;
    }
    expect(() => render(<Orphan />)).toThrow(/ConsoleAuthProvider/);
    spy.mockRestore();
  });
});
