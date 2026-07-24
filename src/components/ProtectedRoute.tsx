import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../features/auth/auth-context";

export function ProtectedRoute() {
  const { isLoading, session } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <main
        className="grid min-h-dvh place-items-center bg-slate-50 dark:bg-slate-950"
        aria-busy="true"
      >
        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <span
            className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-cyan-600 dark:border-slate-700 dark:border-t-cyan-400"
            aria-hidden="true"
          />
          Sitzung wird geprüft …
        </div>
      </main>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
