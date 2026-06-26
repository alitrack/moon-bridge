import { type ReactNode } from "react";
import { AuthGate } from "../../components/AuthGate";
import { useConsoleAuth } from "./ConsoleAuthContext";

type ConsoleAuthGateProps = {
  children: ReactNode;
};

/**
 * Replaces the whole app shell with the login card while the console is locked,
 * and renders the app otherwise. Auth state comes from {@link useConsoleAuth}.
 */
export function ConsoleAuthGate({ children }: ConsoleAuthGateProps) {
  const { required, error, pending, authenticate } = useConsoleAuth();

  if (!required) {
    return <>{children}</>;
  }

  return (
    <AuthGate error={error} pending={pending} onSubmit={authenticate}>
      {children}
    </AuthGate>
  );
}
