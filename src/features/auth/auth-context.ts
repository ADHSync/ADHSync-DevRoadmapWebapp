import type { Session } from "@supabase/supabase-js";
import { createContext, useContext } from "react";

export interface AuthContextValue {
  session: Session | null;
  isLoading: boolean;
  signInWithMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth muss innerhalb des AuthProviders verwendet werden.",
    );
  }

  return context;
}
