import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  ApiError,
  apiFetch,
  clearStoredToken,
  isAuthError,
  saveToken
} from "../../rpc/http";
import { useI18n } from "../../i18n/I18nProvider";

type ConsoleAuthState = {
  /** True while the console is locked behind the login card. */
  required: boolean;
  /** Latest 401 error to surface as the card message, when locked. */
  error: ApiError | undefined;
  /** True while a submitted token is being verified via refetch. */
  pending: boolean;
  /** Persist a candidate token, verify it by refetching, and open the gate on success. */
  authenticate: (token: string, remember: boolean) => Promise<void>;
  /** Clear any stored token and lock the console again. */
  signOut: () => void;
};

const ConsoleAuthContext = createContext<ConsoleAuthState | null>(null);

export function ConsoleAuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [state, setState] = useState<{
    required: boolean;
    error: ApiError | undefined;
    pending: boolean;
  }>({ required: false, error: undefined, pending: false });

  // Any query that settles with a 401 locks the console. This also re-arms the
  // gate when the server's token is rotated while the console is in use.
  useEffect(() => {
    const cache = queryClient.getQueryCache();
    const unsubscribe = cache.subscribe((event) => {
      // Only react to actual query state changes. react-query also emits
      // observerOptionsUpdated/observerResultsUpdated on every useQuery render;
      // acting on those while a query sits in a 401 error state would re-render
      // in a loop (setState -> render -> setOptions -> notify -> setState ...).
      if (event.type !== "updated") {
        return;
      }
      const query = event.query;
      // Ignore mid-refetch notifies: react-query keeps the previous error
      // visible while fetching, and acting on that stale error would re-lock the
      // console the moment a valid token lets the app remount and refetch.
      if (query.state.fetchStatus === "fetching") {
        return;
      }
      const error = query.state.error;
      if (isAuthError(error)) {
        setState((prev) => ({ ...prev, required: true, error, pending: false }));
      }
    });
    return unsubscribe;
  }, [queryClient]);

  const authenticate = useCallback(
    async (token: string, remember: boolean) => {
      saveToken(token, remember);
      setState((prev) => ({ ...prev, pending: true }));
      try {
        // Verify the token directly against an authenticated endpoint. While the
        // console is locked the app shell is unmounted, so its queries are inactive
        // and we can't rely on refetching them — a direct probe is deterministic.
        await apiFetch("/status");
        // Success — open the gate; pages remount and refetch fresh data.
        setState((prev) => ({ ...prev, pending: false, required: false, error: undefined }));
        queryClient.invalidateQueries();
      } catch (error) {
        setState((prev) => ({ ...prev, pending: false }));
        if (isAuthError(error)) {
          // Token rejected — keep the gate locked with the server's message.
          setState((prev) => ({ ...prev, required: true, error }));
        }
        // Non-auth errors (network, 5xx): leave the gate as-is without opening.
      }
    },
    [queryClient]
  );

  const signOut = useCallback(() => {
    clearStoredToken();
    setState({
      required: true,
      pending: false,
      error: new ApiError(401, "signed_out", t("auth.signedOut"))
    });
    // No invalidate here: while locked the app shell is unmounted so no queries
    // are active, and `authenticate` refetches everything on the next login.
  }, [t]);

  const value = useMemo<ConsoleAuthState>(
    () => ({ ...state, authenticate, signOut }),
    [state, authenticate, signOut]
  );

  return <ConsoleAuthContext.Provider value={value}>{children}</ConsoleAuthContext.Provider>;
}

export function useConsoleAuth(): ConsoleAuthState {
  const context = useContext(ConsoleAuthContext);
  if (!context) {
    throw new Error("useConsoleAuth must be used within a ConsoleAuthProvider.");
  }
  return context;
}
