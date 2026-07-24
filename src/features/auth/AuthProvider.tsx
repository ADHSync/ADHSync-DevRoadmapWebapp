import type { Session } from "@supabase/supabase-js";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { toast } from "sonner";

import { supabase } from "../../lib/supabase";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (!isMounted) {
          return;
        }

        setSession(data.session);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        toast.error("Sitzung konnte nicht geladen werden.", {
          description:
            error instanceof Error ? error.message : "Unbekannter Fehler",
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    const redirectUrl = new URL("/roadmap", window.location.origin).toString();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
        shouldCreateUser: false,
      },
    });

    if (error) {
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut({ scope: "local" });

    if (error) {
      throw error;
    }
  }, []);

  const value = useMemo(
    () => ({
      session,
      isLoading,
      signInWithMagicLink,
      signOut,
    }),
    [isLoading, session, signInWithMagicLink, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
