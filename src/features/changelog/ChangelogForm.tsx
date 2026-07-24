import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  CheckCircle2,
  Languages,
  LoaderCircle,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useBlocker } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { ConfirmDialog } from "../../components/ConfirmDialog";
import { SidePanel } from "../../components/SidePanel";
import {
  CHANGE_KINDS,
  CONTENT_VISIBILITIES,
  TRANSLATION_STATES,
  changeKindLabels,
  errorMessage,
  todayAsDateInput,
  visibilityLabels,
} from "../../lib/content";
import { sha256 } from "../../lib/hash";
import { isTranslationStale } from "../../lib/translation";
import { translateEntry } from "../../lib/translate";
import { useBeforeUnloadWarning } from "../../lib/useUnsavedChanges";
import type {
  ChangelogEntry,
  ChangelogEntryInsert,
  ChangelogEntryUpdate,
  RoadmapItem,
} from "../../types/database";

const changelogFormSchema = z.object({
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
  change_kind: z.enum(CHANGE_KINDS),
  title_de: z.string().trim().min(1, "Deutscher Titel ist erforderlich."),
  body_de: z.string().trim().min(1, "Deutscher Text ist erforderlich."),
  title_en: z.string().trim(),
  body_en: z.string().trim(),
  visibility: z.enum(CONTENT_VISIBILITIES),
  sort_order: z.number().int("Sortierung muss eine Ganzzahl sein."),
  roadmap_item_id: z.string(),
  mark_roadmap_done: z.boolean(),
  translation_status: z.enum(TRANSLATION_STATES),
});

type ChangelogFormValues = z.infer<typeof changelogFormSchema>;

interface ChangelogFormProps {
  open: boolean;
  entry: ChangelogEntry | null;
  roadmapItems: RoadmapItem[];
  onSave: (
    payload: ChangelogEntryInsert,
    roadmapToComplete: RoadmapItem | null,
  ) => Promise<void>;
  onTranslated: (update: ChangelogEntryUpdate) => void;
  onDelete: (() => Promise<void>) | null;
  onClose: () => void;
}

const inputClassName =
  "mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-cyan-400 dark:focus:ring-cyan-400/20 dark:disabled:bg-slate-900/60";

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="mt-1 text-xs text-red-700 dark:text-red-300">{message}</p>
  ) : null;
}

function defaultValues(entry: ChangelogEntry | null): ChangelogFormValues {
  return {
    app_version: entry?.app_version ?? "",
    released_on: entry?.released_on ?? todayAsDateInput(),
    change_kind: entry?.change_kind ?? "changed",
    title_de: entry?.title_de ?? "",
    body_de: entry?.body_de ?? "",
    title_en: entry?.title_en ?? "",
    body_en: entry?.body_en ?? "",
    visibility: entry?.visibility ?? "draft",
    sort_order: entry?.sort_order ?? 0,
    roadmap_item_id: entry?.roadmap_item_id ?? "",
    mark_roadmap_done: false,
    translation_status: entry?.translation_status ?? "missing",
  };
}

export function ChangelogForm({
  open,
  entry,
  roadmapItems,
  onSave,
  onTranslated,
  onDelete,
  onClose,
}: ChangelogFormProps) {
  const [languageTab, setLanguageTab] = useState<"de" | "en">("de");
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [sourceChanged, setSourceChanged] = useState(false);
  const [sourceHashReference, setSourceHashReference] = useState(
    entry?.source_hash ?? null,
  );
  const initialValues = useMemo(() => defaultValues(entry), [entry]);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { dirtyFields, errors, isDirty, isSubmitting },
  } = useForm<ChangelogFormValues>({
    resolver: zodResolver(changelogFormSchema),
    defaultValues: initialValues,
  });

  const titleDe = useWatch({ control, name: "title_de" });
  const bodyDe = useWatch({ control, name: "body_de" });
  const titleEn = useWatch({ control, name: "title_en" });
  const bodyEn = useWatch({ control, name: "body_en" });
  const translationStatus = useWatch({
    control,
    name: "translation_status",
  });
  const roadmapItemId = useWatch({ control, name: "roadmap_item_id" });
  const blocker = useBlocker(isDirty);
  const linkedRoadmap =
    roadmapItems.find((item) => item.id === roadmapItemId) ?? null;

  useBeforeUnloadWarning(isDirty);

  useEffect(() => {
    let active = true;

    if (!entry) {
      setSourceChanged(false);
      return;
    }

    void isTranslationStale({
      title_de: titleDe,
      body_de: bodyDe,
      source_hash: sourceHashReference,
    }).then((isStale) => {
      if (active) {
        setSourceChanged(isStale);
      }
    });

    return () => {
      active = false;
    };
  }, [bodyDe, entry, sourceHashReference, titleDe]);

  const translationMissing = !titleEn.trim() || !bodyEn.trim();
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
    if (!entry) {
      return;
    }

    setIsTranslating(true);

    try {
      const translation = await translateEntry("changelog_entries", entry.id);
      setValue("title_en", translation.title_en, { shouldDirty: false });
      setValue("body_en", translation.body_en, { shouldDirty: false });
      setValue("translation_status", "auto", { shouldDirty: false });
      setSourceHashReference(translation.source_hash);
      setSourceChanged(false);
      setLanguageTab("en");
      onTranslated({
        title_en: translation.title_en,
        body_en: translation.body_en,
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
      const currentHash = await sha256(`${titleDe}${bodyDe}`);
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

  async function submit(values: ChangelogFormValues) {
    try {
      const sourceHash = await sha256(`${values.title_de}${values.body_de}`);
      const englishComplete = Boolean(values.title_en && values.body_en);
      const englishChanged = Boolean(
        dirtyFields.title_en || dirtyFields.body_en,
      );
      let nextTranslationStatus = values.translation_status;

      if (
        !englishComplete ||
        (values.translation_status === "reviewed" &&
          sourceHash !== sourceHashReference)
      ) {
        nextTranslationStatus = "missing";
      }

      await onSave(
        {
          app_version: values.app_version,
          released_on: values.released_on,
          change_kind: values.change_kind,
          title_de: values.title_de,
          body_de: values.body_de,
          title_en: values.title_en || null,
          body_en: values.body_en || null,
          visibility: values.visibility,
          roadmap_item_id: values.roadmap_item_id || null,
          sort_order: values.sort_order,
          translation_status: nextTranslationStatus,
          source_hash:
            !englishComplete ||
            !entry ||
            englishChanged ||
            (values.translation_status === "reviewed" && !sourceChanged)
              ? sourceHash
              : sourceHashReference,
        },
        values.mark_roadmap_done && linkedRoadmap?.status !== "done"
          ? linkedRoadmap
          : null,
      );

      reset(values);
      toast.success(
        entry
          ? "Changelog-Eintrag gespeichert."
          : "Changelog-Eintrag angelegt.",
      );
      onClose();
    } catch (error) {
      toast.error("Changelog-Eintrag konnte nicht gespeichert werden.", {
        description: errorMessage(error),
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
      toast.success("Changelog-Eintrag gelöscht.");
      setDeleteDialogOpen(false);
      onClose();
    } catch (error) {
      toast.error("Changelog-Eintrag konnte nicht gelöscht werden.", {
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
        title={
          entry ? "Changelog-Eintrag bearbeiten" : "Changelog-Eintrag anlegen"
        }
        description="Versionshinweis und optionale Roadmap-Verknüpfung pflegen."
        onClose={requestClose}
      >
        <form
          onSubmit={handleSubmit(submit)}
          className="flex min-h-full flex-col"
        >
          <div className="flex-1 space-y-6 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="changelog-version"
                  className="text-sm font-medium"
                >
                  App-Version <span className="text-red-600">*</span>
                </label>
                <input
                  {...register("app_version")}
                  id="changelog-version"
                  placeholder="2.1.0"
                  className={inputClassName}
                />
                <FieldError message={errors.app_version?.message} />
              </div>
              <div>
                <label
                  htmlFor="changelog-released-on"
                  className="text-sm font-medium"
                >
                  Veröffentlicht am <span className="text-red-600">*</span>
                </label>
                <input
                  {...register("released_on")}
                  id="changelog-released-on"
                  type="date"
                  className={inputClassName}
                />
                <FieldError message={errors.released_on?.message} />
              </div>
              <div>
                <label htmlFor="changelog-kind" className="text-sm font-medium">
                  Art der Änderung
                </label>
                <select
                  {...register("change_kind")}
                  id="changelog-kind"
                  className={inputClassName}
                >
                  {CHANGE_KINDS.map((value) => (
                    <option key={value} value={value}>
                      {changeKindLabels[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="changelog-visibility"
                  className="text-sm font-medium"
                >
                  Sichtbarkeit
                </label>
                <select
                  {...register("visibility")}
                  id="changelog-visibility"
                  className={inputClassName}
                >
                  {CONTENT_VISIBILITIES.map((value) => (
                    <option key={value} value={value}>
                      {visibilityLabels[value]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void translateToEnglish()}
                  disabled={!entry || isDirty || isTranslating}
                  title={
                    !entry
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
                    <label
                      htmlFor="changelog-title-de"
                      className="text-sm font-medium"
                    >
                      Titel (Deutsch) <span className="text-red-600">*</span>
                    </label>
                    <input
                      {...register("title_de")}
                      id="changelog-title-de"
                      className={inputClassName}
                    />
                    <FieldError message={errors.title_de?.message} />
                  </div>
                  <div>
                    <label
                      htmlFor="changelog-body-de"
                      className="text-sm font-medium"
                    >
                      Text (Deutsch) <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      {...register("body_de")}
                      id="changelog-body-de"
                      rows={7}
                      className={inputClassName}
                    />
                    <FieldError message={errors.body_de?.message} />
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
                    <label
                      htmlFor="changelog-title-en"
                      className="text-sm font-medium"
                    >
                      Titel (Englisch)
                    </label>
                    <input
                      {...register("title_en")}
                      id="changelog-title-en"
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="changelog-body-en"
                      className="text-sm font-medium"
                    >
                      Text (Englisch)
                    </label>
                    <textarea
                      {...register("body_en")}
                      id="changelog-body-en"
                      rows={7}
                      className={inputClassName}
                    />
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

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
              <div>
                <label
                  htmlFor="changelog-roadmap"
                  className="text-sm font-medium"
                >
                  Roadmap-Verknüpfung
                </label>
                <select
                  {...register("roadmap_item_id")}
                  id="changelog-roadmap"
                  className={inputClassName}
                >
                  <option value="">Keine Verknüpfung</option>
                  {roadmapItems
                    .slice()
                    .sort((a, b) => a.title_de.localeCompare(b.title_de, "de"))
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title_de} ({item.slug})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="changelog-sort-order"
                  className="text-sm font-medium"
                >
                  Sortierung
                </label>
                <input
                  {...register("sort_order", { valueAsNumber: true })}
                  id="changelog-sort-order"
                  type="number"
                  step="10"
                  className={inputClassName}
                />
                <FieldError message={errors.sort_order?.message} />
              </div>
            </div>

            {linkedRoadmap && linkedRoadmap.status !== "done" && (
              <label className="flex items-start gap-3 rounded-md border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950 dark:text-cyan-100">
                <input
                  {...register("mark_roadmap_done")}
                  type="checkbox"
                  className="mt-0.5 size-4 rounded border-cyan-400 text-cyan-700 focus:ring-cyan-600 dark:bg-slate-900"
                />
                <span>
                  <span className="block font-medium">
                    Roadmap-Eintrag als erledigt markieren
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-cyan-800 dark:text-cyan-200">
                    Setzt den Status von „{linkedRoadmap.title_de}“ auf
                    „Erledigt“ und ergänzt bei Bedarf das heutige Datum.
                  </span>
                </span>
              </label>
            )}
          </div>

          <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-950">
            <div>
              {entry && onDelete && (
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
        title="Changelog-Eintrag löschen?"
        description={`„${entry?.title_de ?? ""}“ wird dauerhaft gelöscht.`}
        confirmLabel="Endgültig löschen"
        tone="danger"
        isPending={isDeleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </>
  );
}
