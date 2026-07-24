import { zodResolver } from "@hookform/resolvers/zod";
import { CheckSquare2, LoaderCircle, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { createPortal } from "react-dom";
import { z } from "zod";

import { todayAsDateInput } from "../../lib/content";
import type { RoadmapItem } from "../../types/database";

const importSchema = z.object({
  app_version: z
    .string()
    .trim()
    .min(1, "App-Version ist erforderlich.")
    .regex(
      /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/,
      "Version im Format 2.1.0 eingeben.",
    ),
  released_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Veröffentlichungsdatum ist erforderlich."),
  roadmap_item_ids: z
    .array(z.string())
    .min(1, "Wähle mindestens einen Roadmap-Eintrag aus."),
});

export type RoadmapImportValues = z.infer<typeof importSchema>;

interface RoadmapImportDialogProps {
  open: boolean;
  items: RoadmapItem[];
  onImport: (values: RoadmapImportValues) => Promise<void>;
  onClose: () => void;
}

const inputClassName =
  "mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-cyan-400 dark:focus:ring-cyan-400/20";

export function RoadmapImportDialog({
  open,
  items,
  onImport,
  onClose,
}: RoadmapImportDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const {
    register,
    control,
    handleSubmit,
    reset,
    setFocus,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RoadmapImportValues>({
    resolver: zodResolver(importSchema),
    defaultValues: {
      app_version: "",
      released_on: todayAsDateInput(),
      roadmap_item_ids: [],
    },
  });
  const selectedIds = useWatch({ control, name: "roadmap_item_ids" }) ?? [];
  const isSubmittingRef = useRef(isSubmitting);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    reset({
      app_version: "",
      released_on: todayAsDateInput(),
      roadmap_item_ids: [],
    });
    setFocus("app_version");

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmittingRef.current) {
        event.preventDefault();
        onCloseRef.current();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, reset, setFocus]);

  if (!open) {
    return null;
  }

  const allSelected = items.length > 0 && selectedIds.length === items.length;

  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 px-4 py-8 backdrop-blur-[1px]">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
      >
        <header className="flex items-start gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
            <CheckSquare2 aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold">
              Aus Roadmap übernehmen
            </h2>
            <p
              id={descriptionId}
              className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300"
            >
              Erzeugt unabhängig bearbeitbare Changelog-Vorlagen aus erledigten,
              noch nicht verknüpften Roadmap-Einträgen.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Dialog schließen"
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </header>

        <form
          onSubmit={handleSubmit(onImport)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="roadmap-import-version"
                  className="text-sm font-medium"
                >
                  App-Version <span className="text-red-600">*</span>
                </label>
                <input
                  {...register("app_version")}
                  id="roadmap-import-version"
                  placeholder="2.1.0"
                  className={inputClassName}
                />
                {errors.app_version && (
                  <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                    {errors.app_version.message}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="roadmap-import-date"
                  className="text-sm font-medium"
                >
                  Veröffentlicht am <span className="text-red-600">*</span>
                </label>
                <input
                  {...register("released_on")}
                  id="roadmap-import-date"
                  type="date"
                  className={inputClassName}
                />
                {errors.released_on && (
                  <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                    {errors.released_on.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium">Roadmap-Einträge</h3>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {items.length} verfügbar · {selectedIds.length} ausgewählt
                  </p>
                </div>
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setValue(
                        "roadmap_item_ids",
                        allSelected ? [] : items.map((item) => item.id),
                        { shouldDirty: true, shouldValidate: true },
                      )
                    }
                    className="rounded-md px-2 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 dark:text-cyan-300 dark:hover:bg-cyan-950"
                  >
                    {allSelected ? "Auswahl aufheben" : "Alle auswählen"}
                  </button>
                )}
              </div>

              {items.length === 0 ? (
                <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300">
                  Es gibt keine erledigten Roadmap-Einträge ohne
                  Changelog-Verknüpfung.
                </div>
              ) : (
                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-2 dark:border-slate-700">
                  {items.map((item) => (
                    <label
                      key={item.id}
                      className="flex cursor-pointer items-start gap-3 rounded-md p-3 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <input
                        {...register("roadmap_item_ids")}
                        type="checkbox"
                        value={item.id}
                        className="mt-0.5 size-4 rounded border-slate-400 text-cyan-700 focus:ring-cyan-600 dark:bg-slate-950"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">
                          {item.title_de}
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                          {item.summary_de}
                        </span>
                        <span className="mt-1 block font-mono text-[11px] text-slate-400">
                          {item.slug}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {errors.roadmap_item_ids && (
                <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                  {errors.roadmap_item_ids.message}
                </p>
              )}
            </div>
          </div>

          <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={items.length === 0 || isSubmitting}
              className="inline-flex items-center gap-2 rounded-md bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
            >
              {isSubmitting && (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
              )}
              {selectedIds.length === 1
                ? "1 Vorlage anlegen"
                : `${selectedIds.length} Vorlagen anlegen`}
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body,
  );
}
