import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = {
    hasError: false,
  };

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unbehandelter Anwendungsfehler", error, info);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <main className="grid min-h-dvh place-items-center bg-slate-50 px-6 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
          <section
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            aria-labelledby="error-title"
          >
            <div className="flex size-10 items-center justify-center rounded-md bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
              <AlertTriangle aria-hidden="true" className="size-5" />
            </div>
            <h1 id="error-title" className="mt-5 text-lg font-semibold">
              Die Anwendung konnte nicht geladen werden
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Ein unerwarteter Fehler ist aufgetreten. Lade die Anwendung neu.
              Falls der Fehler bleibt, prüfe die Browser-Konsole.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white dark:focus-visible:ring-offset-slate-900"
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              Neu laden
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
