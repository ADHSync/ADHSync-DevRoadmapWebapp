import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  CheckCircle2,
  Languages,
  LoaderCircle,
  LockKeyhole,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useBlocker } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { ConfirmDialog } from "../../components/ConfirmDialog";
import { SidePanel } from "../../components/SidePanel";
import {
  CONTENT_HORIZONS,
  CONTENT_PRIORITIES,
  CONTENT_STATUSES,
  CONTENT_VISIBILITIES,
  TRANSLATION_STATES,
  errorMessage,
  horizonLabels,
  priorityLabels,
  statusLabels,
  todayAsDateInput,
  uniqueSlug,
  visibilityLabels,
} from "../../lib/content";
import { sha256 } from "../../lib/hash";
import { isTranslationStale } from "../../lib/translation";
import { translateEntry } from "../../lib/translate";
import { useBeforeUnloadWarning } from "../../lib/useUnsavedChanges";
import type {
  RoadmapItem,
  RoadmapItemInsert,
  RoadmapItemUpdate,
} from "../../types/database";

const roadmapFormSchema = z.object({
  title_de: z
    .string()
    .trim()
    .min(1, "Deutscher Titel ist erforderlich.")
    .max(80, "Maximal 80 Zeichen."),
  summary_de: z
    .string()
    .trim()
    .min(1, "Deutscher Kurztext ist erforderlich.")
    .max(300, "Maximal 300 Zeichen."),
  title_en: z.string().trim().max(80, "Maximal 80 Zeichen."),
  summary_en: z.string().trim().max(300, "Maximal 300 Zeichen."),
  dev_notes: z.string(),
  status: z.enum(CONTENT_STATUSES),
  visibility: z.enum(CONTENT_VISIBILITIES),
  horizon: z.enum(CONTENT_HORIZONS),
  priority: z.enum(CONTENT_PRIORITIES),
  category: z.string().trim().max(80, "Maximal 80 Zeichen."),
  translation_status: z.enum(TRANSLATION_STATES),
  completed_at: z
    .string()
    .refine(
      (value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value),
      "Ungültiges Datum.",
    ),
});

type RoadmapFormValues = z.infer<typeof roadmapFormSchema>;

interface RoadmapFormProps {
  open: boolean;
  item: RoadmapItem | null;
  items: RoadmapItem[];
  onSave: (payload: RoadmapItemInsert) => Promise<void>;
  onTranslated: (update: RoadmapItemUpdate) => void;
  onDelete: (() => Promise<void>) | null;
  onClose: () => void;
}

const inputClassName =
  "mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-cyan-400 dark:focus:ring-cyan-400/20 dark:disabled:bg-slate-900/60";

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p className="mt-1 text-xs text-red-700 dark:text-red-300">{message}</p>
  );
}

function defaultValues(item: RoadmapItem | null): RoadmapFormValues {
  return {
    title_de: item?.title_de ?? "",
    summary_de: item?.summary_de ?? "",
    title_en: item?.title_en ?? "",
    summary_en: item?.summary_en ?? "",
    dev_notes: item?.dev_notes ?? "",
    status: item?.status ?? "planned",
    visibility: item?.visibility ?? "draft",
    horizon: item?.horizon ?? "mid",
    priority: item?.priority ?? "normal",
    category: item?.category ?? "",
    translation_status: item?.translation_status ?? "missing",
    completed_at: item?.completed_at ?? "",
  };
}

export function RoadmapForm({
  open,
  item,
  items,
  onSave,
  onTranslated,
  onDelete,
  onClose,
}: RoadmapFormProps) {
  const [languageTab, setLanguageTab] = useState<"de" | "en">("de");
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [sourceChanged, setSourceChanged] = useState(false);
  const [sourceHashReference, setSourceHashReference] = useState(
    item?.source_hash ?? null,
  );
  const previousStatusRef = useRef(item?.status ?? "planned");
  const initialValues = useMemo(() => defaultValues(item), [item]);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { dirtyFields, errors, isDirty, isSubmitting },
  } = useForm<RoadmapFormValues>({
    resolver: zodResolver(roadmapFormSchema),
    defaultValues: initialValues,
  });

  const titleDe = useWatch({ control, name: "title_de" });
  const summaryDe = useWatch({ control, name: "summary_de" });
  const titleEn = useWatch({ control, name: "title_en" });
  const summaryEn = useWatch({ control, name: "summary_en" });
  const translationStatus = useWatch({
    control,
    name: "translation_status",
  });
  const status = useWatch({ control, name: "status" });
  const completedAt = useWatch({ control, name: "completed_at" });
  const blocker = useBlocker(isDirty);

  useBeforeUnloadWarning(isDirty);

  useEffect(() => {
    if (
      status === "done" &&
      previousStatusRef.current !== "done" &&
      !completedAt
    ) {
      setValue("completed_at", todayAsDateInput(), {
        shouldDirty: true,
        shouldValidate: true,
      });
    }

    previousStatusRef.current = status;
  }, [completedAt, setValue, status]);

  useEffect(() => {
    let active = true;

    if (!item) {
      setSourceChanged(false);
      return;
    }

    void isTranslationStale({
      title_de: titleDe,
      summary_de: summaryDe,
      source_hash: sourceHashReference,
    }).then((isStale) => {
      if (active) {
        setSourceChanged(isStale);
      }
    });

    return () => {
      active = false;
    };
  }, [item, sourceHashReference, summaryDe, titleDe]);

  const translationMissing = !titleEn.trim() || !summaryEn.trim();
  const translationNeedsAttention =
    translationMissing || sourceChanged || translationStatus === "missing";

  function requestClose() {
    if (isDirty) {
      setDiscardDialogOpen(true);
      return;
    }

    onClose();
  }

  function confirmDiscard() {
    setDiscardDialogOpen(false);

    if (blocker.state === "blocked") {
      blocker.proceed();
      return;
    }

    reset(initialValues);
    onClose();
  }

  function cancelDiscard() {
    setDiscardDialogOpen(false);

    if (blocker.state === "blocked") {
      blocker.reset();
    }
  }

  async function translateToEnglish() {
    if (!item) {
      return;
    }

    setIsTranslating(true);

    try {
      const translation = await translateEntry("roadmap_items", item.id);
      setValue("title_en", translation.title_en, { shouldDirty: false });
      setValue("summary_en", translation.summary_en, { shouldDirty: false });
      setValue("translation_status", "auto", { shouldDirty: false });
      setSourceHashReference(translation.source_hash);
      setSourceChanged(false);
      setLanguageTab("en");
      onTranslated({
        title_en: translation.title_en,
        summary_en: translation.summary_en,
        translation_status: "auto",
        source_hash: translation.source_hash,
      });
      toast.success("Englische Übersetzung wurde erstellt.");
    } catch (error) {
      toast.error("Übersetzung konnte nicht erstellt werden.", {
        description: errorMessage(error),
      });
    } finally {
      setIsTranslating(false);
    }
  }

  async function setTranslationReviewed(reviewed: boolean) {
    if (reviewed) {
      const currentHash = await sha256(`${titleDe}${summaryDe}`);
      setSourceHashReference(currentHash);
      setSourceChanged(false);
      setValue("translation_status", "reviewed", { shouldDirty: true });
      return;
    }

    setValue(
      "translation_status",
      translationMissing || sourceChanged ? "missing" : "auto",
      { shouldDirty: true },
    );
  }

  async function submit(values: RoadmapFormValues) {
    try {
      const slug =
        item?.slug ??
        uniqueSlug(
          values.title_de,
          items.map((candidate) => candidate.slug),
        );
      const sourceHash = await sha256(`${values.title_de}${values.summary_de}`);
      const englishComplete = Boolean(values.title_en && values.summary_en);
      const englishChanged = Boolean(
        dirtyFields.title_en || dirtyFields.summary_en,
      );
      let nextTranslationStatus = values.translation_status;

      if (
        !englishComplete ||
        (values.translation_status === "reviewed" &&
          sourceHash !== sourceHashReference)
      ) {
        nextTranslationStatus = "missing";
      }

      await onSave({
        slug,
        title_de: values.title_de,
        summary_de: values.summary_de,
        title_en: values.title_en || null,
        summary_en: values.summary_en || null,
        dev_notes: values.dev_notes.trim() || null,
        status: values.status,
        visibility: values.visibility,
        horizon: values.horizon,
        priority: values.priority,
        category: values.category || null,
        completed_at: values.completed_at || null,
        sort_order: item?.sort_order ?? 0,
        translation_status: nextTranslationStatus,
        source_hash:
          !englishComplete ||
          !item ||
          englishChanged ||
          (values.translation_status === "reviewed" && !sourceChanged)
            ? sourceHash
            : sourceHashReference,
      });

      reset(values);
      toast.success(
        item ? "Roadmap-Eintrag gespeichert." : "Roadmap-Eintrag angelegt.",
      );
      onClose();
    } catch (error) {
      const message = errorMessage(error);

      toast.error("Roadmap-Eintrag konnte nicht gespeichert werden.", {
        description: message,
      });
    }
  }

  async function confirmDelete() {
    if (!onDelete) {
      return;
    }

    setIsDeleting(true);

    try {
      await onDelete();
      reset(initialValues);
      toast.success("Roadmap-Eintrag gelöscht.");
      setDeleteDialogOpen(false);
      onClose();
    } catch (error) {
      toast.error("Roadmap-Eintrag konnte nicht gelöscht werden.", {
        description: errorMessage(error),
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <SidePanel
        open={open}
        title={item ? "Roadmap-Eintrag bearbeiten" : "Roadmap-Eintrag anlegen"}
        description={
          item
            ? `Stabile ID: ${item.slug}`
            : "Die stabile ID wird beim Speichern automatisch aus dem Titel erzeugt."
        }
        onClose={requestClose}
      >
        <form
          onSubmit={handleSubmit(submit)}
          className="flex min-h-full flex-col"
        >
          <div className="flex-1 space-y-6 p-5">
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void translateToEnglish()}
                  disabled={!item || isDirty || isTranslating}
                  title={
                    !item
                      ? "Speichere den Eintrag zuerst."
                      : isDirty
                        ? "Speichere zuerst die aktuellen Änderungen."
                        : "Gespeicherten deutschen Text übersetzen"
                  }
                  className="inline-flex items-center gap-2 rounded-md border border-cyan-300 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-900 hover:bg-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-100 dark:hover:bg-cyan-900 dark:focus-visible:ring-offset-slate-950"
                >
                  {isTranslating ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  ) : (
                    <Languages aria-hidden="true" className="size-4" />
                  )}
                  {isTranslating
                    ? "Wird übersetzt …"
                    : "Ins Englische übersetzen"}
                </button>
              </div>
              <div
                role="tablist"
                aria-label="Sprachversion"
                className="flex border-b border-slate-200 dark:border-slate-800"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={languageTab === "de"}
                  onClick={() => setLanguageTab("de")}
                  className="border-b-2 border-transparent px-3 py-2 text-sm font-medium text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-600 aria-selected:border-cyan-600 aria-selected:text-slate-950 dark:text-slate-400 dark:aria-selected:border-cyan-400 dark:aria-selected:text-white"
                >
                  Deutsch
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={languageTab === "en"}
                  onClick={() => setLanguageTab("en")}
                  className="inline-flex items-center gap-2 border-b-2 border-transparent px-3 py-2 text-sm font-medium text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-600 aria-selected:border-cyan-600 aria-selected:text-slate-950 dark:text-slate-400 dark:aria-selected:border-cyan-400 dark:aria-selected:text-white"
                >
                  Englisch
                  {translationNeedsAttention && (
                    <span
                      className="size-2 rounded-full bg-amber-500"
                      aria-label="Prüfung erforderlich"
                    />
                  )}
                </button>
              </div>

              {languageTab === "de" ? (
                <div role="tabpanel" className="space-y-4 pt-4">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label
                        htmlFor="roadmap-title-de"
                        className="text-sm font-medium"
                      >
                        Titel (Deutsch) <span className="text-red-600">*</span>
                      </label>
                      <span className="text-xs tabular-nums text-slate-500">
                        {titleDe.length}/80
                      </span>
                    </div>
                    <input
                      {...register("title_de")}
                      id="roadmap-title-de"
                      maxLength={80}
                      aria-invalid={Boolean(errors.title_de)}
                      className={inputClassName}
                    />
                    <FieldError message={errors.title_de?.message} />
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label
                        htmlFor="roadmap-summary-de"
                        className="text-sm font-medium"
                      >
                        Kurztext (Deutsch){" "}
                        <span className="text-red-600">*</span>
                      </label>
                      <span className="text-xs tabular-nums text-slate-500">
                        {summaryDe.length}/300
                      </span>
                    </div>
                    <textarea
                      {...register("summary_de")}
                      id="roadmap-summary-de"
                      rows={5}
                      maxLength={300}
                      aria-invalid={Boolean(errors.summary_de)}
                      className={inputClassName}
                    />
                    <FieldError message={errors.summary_de?.message} />
                  </div>
                </div>
              ) : (
                <div role="tabpanel" className="space-y-4 pt-4">
                  {translationStatus === "auto" &&
                    !sourceChanged &&
                    !translationMissing && (
                      <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                        Automatisch übersetzt
                      </span>
                    )}

                  {translationNeedsAttention ? (
                    <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                      <AlertTriangle
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0"
                      />
                      <p>
                        {translationMissing
                          ? "Die englische Übersetzung ist unvollständig."
                          : sourceChanged
                            ? "Der deutsche Quelltext wurde geändert. Die Übersetzung ist veraltet."
                            : "Die Übersetzung muss geprüft werden."}
                      </p>
                    </div>
                  ) : translationStatus === "reviewed" ? (
                    <div className="flex gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                      <CheckCircle2
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0"
                      />
                      Übersetzung ist geprüft und aktuell.
                    </div>
                  ) : null}

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label
                        htmlFor="roadmap-title-en"
                        className="text-sm font-medium"
                      >
                        Titel (Englisch)
                      </label>
                      <span className="text-xs tabular-nums text-slate-500">
                        {titleEn.length}/80
                      </span>
                    </div>
                    <input
                      {...register("title_en")}
                      id="roadmap-title-en"
                      maxLength={80}
                      className={inputClassName}
                    />
                    <FieldError message={errors.title_en?.message} />
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label
                        htmlFor="roadmap-summary-en"
                        className="text-sm font-medium"
                      >
                        Kurztext (Englisch)
                      </label>
                      <span className="text-xs tabular-nums text-slate-500">
                        {summaryEn.length}/300
                      </span>
                    </div>
                    <textarea
                      {...register("summary_en")}
                      id="roadmap-summary-en"
                      rows={5}
                      maxLength={300}
                      className={inputClassName}
                    />
                    <FieldError message={errors.summary_en?.message} />
                  </div>

                  <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
                    <input
                      type="checkbox"
                      checked={
                        translationStatus === "reviewed" &&
                        !sourceChanged &&
                        !translationMissing
                      }
                      disabled={translationMissing}
                      onChange={(event) =>
                        void setTranslationReviewed(event.target.checked)
                      }
                      className="mt-0.5 size-4 rounded border-slate-400 text-cyan-700 focus:ring-cyan-600 disabled:opacity-50 dark:bg-slate-950"
                    />
                    <span>
                      <span className="block font-medium">
                        Übersetzung geprüft
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                        Bestätigt, dass die englische Fassung inhaltlich zum
                        aktuellen deutschen Text passt.
                      </span>
                    </span>
                  </label>
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="roadmap-status" className="text-sm font-medium">
                  Status
                </label>
                <select
                  {...register("status")}
                  id="roadmap-status"
                  className={inputClassName}
                >
                  {CONTENT_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {statusLabels[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="roadmap-visibility"
                  className="text-sm font-medium"
                >
                  Sichtbarkeit
                </label>
                <select
                  {...register("visibility")}
                  id="roadmap-visibility"
                  className={inputClassName}
                >
                  {CONTENT_VISIBILITIES.map((value) => (
                    <option key={value} value={value}>
                      {visibilityLabels[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="roadmap-horizon"
                  className="text-sm font-medium"
                >
                  Horizont
                </label>
                <select
                  {...register("horizon")}
                  id="roadmap-horizon"
                  className={inputClassName}
                >
                  {CONTENT_HORIZONS.map((value) => (
                    <option key={value} value={value}>
                      {horizonLabels[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="roadmap-priority"
                  className="text-sm font-medium"
                >
                  Priorität
                </label>
                <select
                  {...register("priority")}
                  id="roadmap-priority"
                  className={inputClassName}
                >
                  {CONTENT_PRIORITIES.map((value) => (
                    <option key={value} value={value}>
                      {priorityLabels[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="roadmap-category"
                  className="text-sm font-medium"
                >
                  Kategorie
                </label>
                <input
                  {...register("category")}
                  id="roadmap-category"
                  className={inputClassName}
                />
                <FieldError message={errors.category?.message} />
              </div>
              <div>
                <label
                  htmlFor="roadmap-completed-at"
                  className="text-sm font-medium"
                >
                  Erledigt am
                </label>
                <input
                  {...register("completed_at")}
                  id="roadmap-completed-at"
                  type="date"
                  className={inputClassName}
                />
                <FieldError message={errors.completed_at?.message} />
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/50">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
                <LockKeyhole aria-hidden="true" className="size-4" />
                Interne Entwicklungsnotizen
              </div>
              <p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-200">
                Dieses Feld ist ausschließlich intern und darf niemals
                veröffentlicht werden.
              </p>
              <textarea
                {...register("dev_notes")}
                id="roadmap-dev-notes"
                aria-label="Interne Entwicklungsnotizen"
                rows={5}
                className={`${inputClassName} border-amber-300 dark:border-amber-800`}
              />
            </div>
          </div>

          <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-950">
            <div>
              {item && onDelete && (
                <button
                  type="button"
                  onClick={() => setDeleteDialogOpen(true)}
                  className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 dark:text-red-300 dark:hover:bg-red-950"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  Löschen
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={requestClose}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-950"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-md bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400 dark:focus-visible:ring-offset-slate-950"
              >
                {isSubmitting && (
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin"
                  />
                )}
                Speichern
              </button>
            </div>
          </footer>
        </form>
      </SidePanel>

      <ConfirmDialog
        open={discardDialogOpen || blocker.state === "blocked"}
        title="Ungespeicherte Änderungen verwerfen?"
        description="Deine Änderungen wurden noch nicht gespeichert und gehen beim Verlassen verloren."
        confirmLabel="Änderungen verwerfen"
        tone="danger"
        onConfirm={confirmDiscard}
        onCancel={cancelDiscard}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Roadmap-Eintrag löschen?"
        description={`„${item?.title_de ?? ""}“ wird dauerhaft gelöscht. Verknüpfte Changelog-Einträge bleiben erhalten, verlieren aber die Verknüpfung.`}
        confirmLabel="Endgültig löschen"
        tone="danger"
        isPending={isDeleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </>
  );
}
