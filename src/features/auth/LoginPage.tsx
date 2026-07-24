import { CheckCircle2, KeyRound, LoaderCircle, Mail } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";

import { useAuth } from "./auth-context";

export function LoginPage() {
  const { isLoading, session, signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  if (!isLoading && session) {
    return <Navigate to="/roadmap" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      return;
    }

    setIsSubmitting(true);

    try {
      await signInWithMagicLink(normalizedEmail);
      setIsSent(true);
      toast.success("Magic Link wurde gesendet.", {
        description: "Prüfe dein E-Mail-Postfach.",
      });
    } catch (error) {
      toast.error("Magic Link konnte nicht gesendet werden.", {
        description:
          error instanceof Error ? error.message : "Unbekannter Fehler",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-100 px-4 py-10 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <div className="w-full max-w-sm">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-md bg-cyan-700 text-sm font-bold text-white dark:bg-cyan-500 dark:text-slate-950">
            A
          </span>
          <div>
            <p className="text-sm font-semibold">ADHSync</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Content Admin
            </p>
          </div>
        </div>

        <section
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          aria-labelledby="login-title"
        >
          <div className="flex size-9 items-center justify-center rounded-md bg-cyan-50 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">
            <KeyRound aria-hidden="true" className="size-4" />
          </div>
          <h1 id="login-title" className="mt-4 text-lg font-semibold">
            Admin-Zugang
          </h1>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Melde dich mit der in Supabase hinterlegten E-Mail-Adresse an.
          </p>

          <form className="mt-5" onSubmit={handleSubmit}>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-800 dark:text-slate-200"
            >
              E-Mail-Adresse
            </label>
            <div className="relative mt-1.5">
              <Mail
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              />
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setIsSent(false);
                }}
                autoComplete="email"
                required
                autoFocus
                disabled={isSubmitting}
                aria-describedby="email-help"
                className="login-control"
                placeholder="admin@beispiel.de"
              />
            </div>
            <p
              id="email-help"
              className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400"
            >
              Es wird kein Passwort benötigt. Neue Konten können hier nicht
              angelegt werden.
            </p>

            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-cyan-700 px-4 text-sm font-semibold text-white hover:bg-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400 dark:focus-visible:ring-cyan-400 dark:focus-visible:ring-offset-slate-900"
            >
              {isSubmitting ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
              ) : (
                <Mail aria-hidden="true" className="size-4" />
              )}
              {isSubmitting ? "Wird gesendet …" : "Magic Link senden"}
            </button>
          </form>

          {isSent && (
            <div
              className="mt-4 flex gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
              role="status"
            >
              <CheckCircle2
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <p>
                Der Link wurde gesendet. Du kannst dieses Fenster offen lassen.
              </p>
            </div>
          )}
        </section>

        <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
          Interner Zugang · Nur für den Betreiber
        </p>
      </div>
    </main>
  );
}
