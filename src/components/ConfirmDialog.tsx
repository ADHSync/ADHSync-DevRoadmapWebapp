import { AlertTriangle, LoaderCircle, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "warning";
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Abbrechen",
  tone = "warning",
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    cancelButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPending) {
        event.preventDefault();
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPending, onCancel, open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 px-4 py-8 backdrop-blur-[1px]">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-start gap-3">
          <span
            className={
              tone === "danger"
                ? "flex size-9 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                : "flex size-9 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
            }
          >
            <AlertTriangle aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
            <p
              id={descriptionId}
              className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300"
            >
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            aria-label="Dialog schließen"
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={
              tone === "danger"
                ? "inline-flex items-center gap-2 rounded-md bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:opacity-50 dark:bg-red-600 dark:hover:bg-red-500 dark:focus-visible:ring-offset-slate-900"
                : "inline-flex items-center gap-2 rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 disabled:opacity-50 dark:text-slate-950 dark:hover:bg-amber-500 dark:focus-visible:ring-offset-slate-900"
            }
          >
            {isPending && (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            )}
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
