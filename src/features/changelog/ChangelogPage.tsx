import {
  AlertCircle,
  AlertTriangle,
  FileClock,
  Link2,
  ListPlus,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  CHANGE_KINDS,
  CONTENT_VISIBILITIES,
  changeKindLabels,
  errorMessage,
  formatDate,
  visibilityLabels,
} from "../../lib/content";
import { sha256 } from "../../lib/hash";
import { useStaleTranslations } from "../../lib/useStaleTranslations";
import type {
  ChangeKind,
  ChangelogEntry,
  ChangelogEntryInsert,
  ContentVisibility,
  RoadmapItem,
} from "../../types/database";
import { useRoadmapItems } from "../roadmap/useRoadmapItems";
import { ChangelogForm } from "./ChangelogForm";
import {
  RoadmapImportDialog,
  type RoadmapImportValues,
} from "./RoadmapImportDialog";
import { useChangelogEntries } from "./useChangelogEntries";

function visibilityClassName(visibility: ContentVisibility): string {
  const classes: Record<ContentVisibility, string> = {
    draft: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    internal:
      "bg-violet-50 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
    public:
      "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  };

  return classes[visibility];
}

export function ChangelogPage() {
  const {
    entries,
    isLoading,
    isMutating,
    loadError,
    reload,
    createEntry,
    createEntries,
    updateEntry,
    applyRemoteUpdate,
    deleteEntry,
  } = useChangelogEntries();
  const {
    items: roadmapItems,
    updateItem: updateRoadmapItem,
    loadError: roadmapLoadError,
  } = useRoadmapItems();
  const [search, setSearch] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<
    ContentVisibility | ""
  >("");
  const [kindFilter, setKindFilter] = useState<ChangeKind | "">("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<ChangelogEntry | null>(
    null,
  );
  const staleTranslationIds = useStaleTranslations(entries);

  const normalizedSearch = search.trim().toLocaleLowerCase("de");
  const filteredEntries = useMemo(
    () =>
      entries.filter((entry) => {
        const matchesSearch =
          !normalizedSearch ||
          entry.title_de.toLocaleLowerCase("de").includes(normalizedSearch) ||
          entry.body_de.toLocaleLowerCase("de").includes(normalizedSearch) ||
          entry.app_version.toLocaleLowerCase("de").includes(normalizedSearch);

        return (
          matchesSearch &&
          (!visibilityFilter || entry.visibility === visibilityFilter) &&
          (!kindFilter || entry.change_kind === kindFilter)
        );
      }),
    [entries, kindFilter, normalizedSearch, visibilityFilter],
  );

  const groupedEntries = useMemo(() => {
    const sortedEntries = filteredEntries.slice().sort((a, b) => {
      const dateComparison = b.released_on.localeCompare(a.released_on);
      return dateComparison || a.sort_order - b.sort_order;
    });
    const groups = new Map<string, ChangelogEntry[]>();

    for (const entry of sortedEntries) {
      const group = groups.get(entry.app_version) ?? [];
      group.push(entry);
      groups.set(entry.app_version, group);
    }

    return Array.from(groups, ([version, versionEntries]) => ({
      version,
      entries: versionEntries,
      latestRelease: versionEntries[0]?.released_on ?? "",
    })).sort((a, b) => b.latestRelease.localeCompare(a.latestRelease));
  }, [filteredEntries]);

  const roadmapById = useMemo(
    () => new Map(roadmapItems.map((item) => [item.id, item])),
    [roadmapItems],
  );
  const importableRoadmapItems = useMemo(() => {
    const referencedRoadmapIds = new Set(
      entries
        .map((entry) => entry.roadmap_item_id)
        .filter((id): id is string => Boolean(id)),
    );

    return roadmapItems
      .filter(
        (item) => item.status === "done" && !referencedRoadmapIds.has(item.id),
      )
      .sort((left, right) => left.title_de.localeCompare(right.title_de, "de"));
  }, [entries, roadmapItems]);

  function openCreatePanel() {
    setSelectedEntry(null);
    setPanelOpen(true);
  }

  function openEditPanel(entry: ChangelogEntry) {
    setSelectedEntry(entry);
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    setSelectedEntry(null);
  }

  async function saveEntry(
    payload: ChangelogEntryInsert,
    roadmapToComplete: RoadmapItem | null,
  ) {
    if (selectedEntry) {
      await updateEntry(selectedEntry.id, payload);
    } else {
      await createEntry(payload);
    }

    if (roadmapToComplete) {
      try {
        await updateRoadmapItem(roadmapToComplete.id, {
          status: "done",
        });
        toast.success("Verknüpfter Roadmap-Eintrag als erledigt markiert.");
      } catch (error) {
        toast.warning(
          "Changelog gespeichert, Roadmap-Status aber nicht aktualisiert.",
          { description: errorMessage(error) },
        );
      }
    }
  }

  async function importFromRoadmap(values: RoadmapImportValues) {
    const selectedItems = values.roadmap_item_ids
      .map((id) => importableRoadmapItems.find((item) => item.id === id))
      .filter((item): item is RoadmapItem => Boolean(item));

    if (selectedItems.length !== values.roadmap_item_ids.length) {
      toast.error(
        "Mindestens ein Roadmap-Eintrag ist nicht mehr für die Übernahme verfügbar.",
      );
      return;
    }

    const highestSortOrder = Math.max(
      0,
      ...entries
        .filter((entry) => entry.app_version === values.app_version)
        .map((entry) => entry.sort_order),
    );
    const payloads = await Promise.all(
      selectedItems.map(async (item, index): Promise<ChangelogEntryInsert> => ({
        app_version: values.app_version,
        released_on: values.released_on,
        change_kind: "added",
        title_de: item.title_de,
        body_de: item.summary_de,
        title_en: null,
        body_en: null,
        visibility: "draft",
        roadmap_item_id: item.id,
        sort_order: highestSortOrder + (index + 1) * 10,
        translation_status: "missing",
        source_hash: await sha256(`${item.title_de}${item.summary_de}`),
      })),
    );

    try {
      await createEntries(payloads);
      setImportDialogOpen(false);
      toast.success(
        payloads.length === 1
          ? "Changelog-Vorlage wurde angelegt."
          : `${payloads.length} Changelog-Vorlagen wurden angelegt.`,
      );
    } catch (error) {
      toast.error("Roadmap-Einträge konnten nicht übernommen werden.", {
        description: errorMessage(error),
      });
    }
  }

  return (
    <section aria-labelledby="changelog-title">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
            Inhalte
          </p>
          <h1 id="changelog-title" className="mt-1 text-2xl font-semibold">
            Changelog
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Versionshinweise, Übersetzungen und Roadmap-Verknüpfungen verwalten.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isMutating && (
            <span className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <LoaderCircle
                aria-hidden="true"
                className="size-3.5 animate-spin"
              />
              Wird gespeichert …
            </span>
          )}
          <button
            type="button"
            onClick={() => setImportDialogOpen(true)}
            disabled={isMutating}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-950"
          >
            <ListPlus aria-hidden="true" className="size-4" />
            Aus Roadmap übernehmen
          </button>
          <button
            type="button"
            onClick={openCreatePanel}
            className="inline-flex items-center gap-2 rounded-md bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400 dark:focus-visible:ring-offset-slate-950"
          >
            <Plus aria-hidden="true" className="size-4" />
            Neuer Eintrag
          </button>
        </div>
      </header>

      <div className="mt-5 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap gap-2">
          <label className="relative min-w-64 flex-1">
            <span className="sr-only">Changelog durchsuchen</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Version, Titel oder Text durchsuchen …"
              className="filter-search-control"
            />
          </label>
          <label>
            <span className="sr-only">Nach Änderungsart filtern</span>
            <select
              value={kindFilter}
              onChange={(event) =>
                setKindFilter(event.target.value as ChangeKind | "")
              }
              className="filter-control"
            >
              <option value="">Alle Änderungsarten</option>
              {CHANGE_KINDS.map((value) => (
                <option key={value} value={value}>
                  {changeKindLabels[value]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Nach Sichtbarkeit filtern</span>
            <select
              value={visibilityFilter}
              onChange={(event) =>
                setVisibilityFilter(
                  event.target.value as ContentVisibility | "",
                )
              }
              className="filter-control"
            >
              <option value="">Alle Sichtbarkeiten</option>
              {CONTENT_VISIBILITIES.map((value) => (
                <option key={value} value={value}>
                  {visibilityLabels[value]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-2 px-1 text-xs text-slate-500 dark:text-slate-400">
          {filteredEntries.length} von {entries.length} Einträgen
        </p>
      </div>

      {roadmapLoadError && (
        <div className="mt-3 flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
          Roadmap-Verknüpfungen konnten nicht geladen werden: {roadmapLoadError}
        </div>
      )}

      {loadError ? (
        <div className="mt-5 flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
          <div className="flex gap-3">
            <AlertCircle
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0"
            />
            <div>
              <h2 className="text-sm font-semibold">
                Changelog konnte nicht geladen werden
              </h2>
              <p className="mt-1 text-sm">{loadError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void reload()}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 dark:border-red-800 dark:hover:bg-red-900"
          >
            Erneut versuchen
          </button>
        </div>
      ) : isLoading ? (
        <div className="mt-5 grid min-h-56 place-items-center rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <span className="inline-flex items-center gap-2 text-sm text-slate-500">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            Changelog wird geladen …
          </span>
        </div>
      ) : groupedEntries.length === 0 ? (
        <div className="mt-5 grid min-h-56 place-items-center rounded-lg border border-slate-200 bg-white px-6 text-center dark:border-slate-800 dark:bg-slate-900">
          <div>
            <FileClock
              aria-hidden="true"
              className="mx-auto size-6 text-slate-400"
            />
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Keine Changelog-Einträge für diese Filter gefunden.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {groupedEntries.map((group) => (
            <section
              key={group.version}
              aria-labelledby={`version-${group.version}`}
              className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
            >
              <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
                <div>
                  <h2
                    id={`version-${group.version}`}
                    className="text-sm font-semibold"
                  >
                    Version {group.version}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(group.latestRelease)}
                  </p>
                </div>
                <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {group.entries.length}
                </span>
              </header>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left">
                  <thead className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th scope="col" className="px-4 py-2">
                        Datum
                      </th>
                      <th scope="col" className="px-3 py-2">
                        Art
                      </th>
                      <th scope="col" className="px-3 py-2">
                        Titel (de)
                      </th>
                      <th scope="col" className="px-3 py-2">
                        Roadmap
                      </th>
                      <th scope="col" className="px-3 py-2">
                        Sichtbarkeit
                      </th>
                      <th scope="col" className="px-3 py-2">
                        Übersetzung
                      </th>
                      <th scope="col" className="px-4 py-2 text-right">
                        Aktion
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.entries.map((entry) => {
                      const linkedRoadmap = entry.roadmap_item_id
                        ? roadmapById.get(entry.roadmap_item_id)
                        : null;

                      return (
                        <tr
                          key={entry.id}
                          className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70"
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                            {formatDate(entry.released_on)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-600 dark:text-slate-300">
                            {changeKindLabels[entry.change_kind]}
                          </td>
                          <td className="min-w-64 px-3 py-3">
                            <p className="font-medium">{entry.title_de}</p>
                            <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                              {entry.body_de}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            {linkedRoadmap ? (
                              <span className="inline-flex max-w-48 items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                                <Link2
                                  aria-hidden="true"
                                  className="size-3.5 shrink-0"
                                />
                                <span className="truncate">
                                  {linkedRoadmap.title_de}
                                </span>
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">–</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${visibilityClassName(entry.visibility)}`}
                            >
                              {visibilityLabels[entry.visibility]}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={
                                !entry.title_en || !entry.body_en
                                  ? "inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                  : staleTranslationIds.has(entry.id)
                                    ? "inline-flex whitespace-nowrap rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                                    : entry.translation_status === "reviewed"
                                      ? "inline-flex whitespace-nowrap rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                                      : entry.translation_status === "auto"
                                        ? "inline-flex whitespace-nowrap rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-950 dark:text-blue-200"
                                        : "inline-flex whitespace-nowrap rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                              }
                            >
                              {staleTranslationIds.has(entry.id) &&
                                entry.title_en &&
                                entry.body_en && (
                                  <AlertTriangle
                                    aria-hidden="true"
                                    className="mr-1 size-3.5"
                                  />
                                )}
                              {!entry.title_en || !entry.body_en
                                ? "Fehlt"
                                : staleTranslationIds.has(entry.id)
                                  ? "Veraltet"
                                  : entry.translation_status === "reviewed"
                                    ? "Geprüft"
                                    : entry.translation_status === "auto"
                                      ? "Automatisch"
                                      : "Ungeprüft"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => openEditPanel(entry)}
                              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                            >
                              <Pencil aria-hidden="true" className="size-3.5" />
                              Bearbeiten
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      <ChangelogForm
        key={selectedEntry?.id ?? (panelOpen ? "new-open" : "new-closed")}
        open={panelOpen}
        entry={selectedEntry}
        roadmapItems={roadmapItems}
        onSave={saveEntry}
        onTranslated={(update) => {
          if (selectedEntry) {
            applyRemoteUpdate(selectedEntry.id, update);
          }
        }}
        onDelete={selectedEntry ? () => deleteEntry(selectedEntry.id) : null}
        onClose={closePanel}
      />

      <RoadmapImportDialog
        open={importDialogOpen}
        items={importableRoadmapItems}
        onImport={importFromRoadmap}
        onClose={() => setImportDialogOpen(false)}
      />
    </section>
  );
}
