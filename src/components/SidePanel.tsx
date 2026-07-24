import { X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface SidePanelProps {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}

export function SidePanel({
  open,
  title,
  description,
  children,
  onClose,
}: SidePanelProps) {
  const titleId = useId();
  const descriptionId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-slate-950/45 backdrop-blur-[1px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onKeyDown={handleKeyDown}
        className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
      >
        <header className="flex items-start gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            {description && (
              <p
                id={descriptionId}
                className="mt-1 text-sm text-slate-500 dark:text-slate-400"
              >
                {description}
              </p>
            )}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Seitenpanel schließen"
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}
