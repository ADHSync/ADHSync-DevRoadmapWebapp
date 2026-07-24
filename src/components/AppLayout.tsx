import { ClipboardList, FileClock, LogOut, RadioTower } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { toast } from "sonner";

import { useAuth } from "../features/auth/auth-context";
import { cn } from "../lib/utils";

const navigation = [
  {
    label: "Roadmap",
    to: "/roadmap",
    icon: ClipboardList,
  },
  {
    label: "Changelog",
    to: "/changelog",
    icon: FileClock,
  },
  {
    label: "Veröffentlichen",
    to: "/publish",
    icon: RadioTower,
  },
] as const;

export function AppLayout() {
  const { session, signOut } = useAuth();
  const email = session?.user.email ?? "Angemeldet";

  async function handleSignOut() {
    try {
      await signOut();
      toast.success("Du wurdest abgemeldet.");
    } catch (error) {
      toast.error("Abmelden fehlgeschlagen.", {
        description:
          error instanceof Error ? error.message : "Unbekannter Fehler",
      });
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100 md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-white px-3 py-2 text-sm font-medium text-slate-950 shadow focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:outline-none focus:ring-2 focus:ring-cyan-600 dark:bg-slate-900 dark:text-white"
      >
        Zum Hauptinhalt
      </a>

      <aside className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:border-b-0 md:border-r">
        <div className="flex h-14 items-center gap-3 px-4 md:h-16">
          <span className="flex size-8 items-center justify-center rounded-md bg-cyan-700 text-sm font-bold text-white dark:bg-cyan-500 dark:text-slate-950">
            A
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">ADHSync</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              Content Admin
            </p>
          </div>
        </div>

        <nav
          aria-label="Hauptnavigation"
          className="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:space-y-1 md:py-2"
        >
          {navigation.map(({ icon: Icon, label, to }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 dark:focus-visible:ring-cyan-400 dark:focus-visible:ring-offset-slate-900 md:flex",
                  isActive
                    ? "bg-cyan-50 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-100"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
                )
              }
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 px-3 py-3 dark:border-slate-800 md:mt-auto">
          <p className="px-2 text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Angemeldet als
          </p>
          <p
            className="mt-1 truncate px-2 text-sm text-slate-800 dark:text-slate-200"
            title={email}
          >
            {email}
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-3 inline-flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:focus-visible:ring-cyan-400 dark:focus-visible:ring-offset-slate-900"
          >
            <LogOut aria-hidden="true" className="size-4" />
            Abmelden
          </button>
        </div>
      </aside>

      <main id="main-content" className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
