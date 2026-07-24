import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  GripVertical,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import { toast } from "sonner";

import {
  CONTENT_HORIZONS,
  CONTENT_STATUSES,
  CONTENT_VISIBILITIES,
  errorMessage,
  formatDateTime,
  horizonLabels,
  priorityLabels,
  statusLabels,
  visibilityLabels,
} from "../../lib/content";
import { useStaleTranslations } from "../../lib/useStaleTranslations";
import type {
  ContentHorizon,
  ContentStatus,
  ContentVisibility,
  RoadmapItem,
  RoadmapItemInsert,
} from "../../types/database";
import { RoadmapForm } from "./RoadmapForm";
import { useRoadmapItems } from "./useRoadmapItems";

interface SortableRoadmapRowProps {
  item: RoadmapItem;
  dragDisabled: boolean;
  translationStale: boolean;
  onEdit: (item: RoadmapItem) => void;
}

const selectClassName =
  "h-9 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-cyan-400";

function statusClassName(status: ContentStatus): string {
  const classes: Record<ContentStatus, string> = {
    planned:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    in_progress: "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
    done: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    cancelled: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
  };

  return classes[status];
}

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

function SortableRoadmapRow({
  item,
  dragDisabled,
  translationStale,
  onEdit,
}: SortableRoadmapRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: dragDisabled });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    position: "relative",
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-b border-slate-100 bg-white last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/70"
    >
      <td className="w-10 px-2 py-3">
        <button
          type="button"
          disabled={dragDisabled}
          {...attributes}
          {...listeners}
          aria-label={`${item.title_de} innerhalb von ${horizonLabels[item.horizon]} sortieren`}
          title={
            dragDisabled
              ? "Sortierung ist nur ohne aktive Filter möglich."
              : "Ziehen oder per Tastatur sortieren"
          }
          className="cursor-grab rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-slate-700 dark:hover:text-slate-100"
        >
          <GripVertical aria-hidden="true" className="size-4" />
        </button>
      </td>
      <td className="min-w-60 px-3 py-3">
        <p className="font-medium text-slate-950 dark:text-white">
          {item.title_de}
        </p>
        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
          {item.summary_de}
        </p>
        <p className="mt-1 font-mono text-[11px] text-slate-400">{item.slug}</p>
      </td>
      <td className="px-3 py-3">
        <span
          className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${statusClassName(item.status)}`}
        >
          {statusLabels[item.status]}
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-600 dark:text-slate-300">
        {horizonLabels[item.horizon]}
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-600 dark:text-slate-300">
        {priorityLabels[item.priority]}
      </td>
      <td className="px-3 py-3">
        <span
          className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${visibilityClassName(item.visibility)}`}
        >
          {visibilityLabels[item.visibility]}
        </span>
      </td>
      <td className="px-3 py-3">
        <span
          className={
            !item.title_en || !item.summary_en
              ? "inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              : translationStale
                ? "inline-flex whitespace-nowrap rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                : item.translation_status === "reviewed"
                  ? "inline-flex whitespace-nowrap rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                  : item.translation_status === "auto"
                    ? "inline-flex whitespace-nowrap rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-950 dark:text-blue-200"
                    : "inline-flex whitespace-nowrap rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200"
          }
        >
          {translationStale && item.title_en && item.summary_en && (
            <AlertTriangle aria-hidden="true" className="mr-1 size-3.5" />
          )}
          {!item.title_en || !item.summary_en
            ? "Fehlt"
            : translationStale
              ? "Veraltet"
              : item.translation_status === "reviewed"
                ? "Geprüft"
                : item.translation_status === "auto"
                  ? "Automatisch"
                  : "Ungeprüft"}
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
        {formatDateTime(item.updated_at)}
      </td>
      <td className="px-3 py-3 text-right">
        <button
          type="button"
          onClick={() => onEdit(item)}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
        >
          <Pencil aria-hidden="true" className="size-3.5" />
          Bearbeiten
        </button>
      </td>
    </tr>
  );
}

export function RoadmapPage() {
  const {
    items,
    isLoading,
    isMutating,
    loadError,
    reload,
    createItem,
    updateItem,
    applyRemoteUpdate,
    deleteItem,
    reorderWithinHorizon,
  } = useRoadmapItems();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContentStatus | "">("");
  const [horizonFilter, setHorizonFilter] = useState<ContentHorizon | "">("");
  const [visibilityFilter, setVisibilityFilter] = useState<
    ContentVisibility | ""
  >("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<RoadmapItem | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const staleTranslationIds = useStaleTranslations(items);

  const normalizedSearch = search.trim().toLocaleLowerCase("de");
  const hasActiveFilters = Boolean(
    normalizedSearch || statusFilter || horizonFilter || visibilityFilter,
  );

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const matchesSearch =
          !normalizedSearch ||
          item.title_de.toLocaleLowerCase("de").includes(normalizedSearch) ||
          item.summary_de.toLocaleLowerCase("de").includes(normalizedSearch);

        return (
          matchesSearch &&
          (!statusFilter || item.status === statusFilter) &&
          (!horizonFilter || item.horizon === horizonFilter) &&
          (!visibilityFilter || item.visibility === visibilityFilter)
        );
      }),
    [horizonFilter, items, normalizedSearch, statusFilter, visibilityFilter],
  );

  function openCreatePanel() {
    setSelectedItem(null);
    setPanelOpen(true);
  }

  function openEditPanel(item: RoadmapItem) {
    setSelectedItem(item);
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    setSelectedItem(null);
  }

  async function saveItem(payload: RoadmapItemInsert) {
    if (selectedItem) {
      await updateItem(selectedItem.id, payload);
      return;
    }

    const nextSortOrder =
      Math.max(
        0,
        ...items
          .filter((item) => item.horizon === payload.horizon)
          .map((item) => item.sort_order),
      ) + 10;

    await createItem({ ...payload, sort_order: nextSortOrder });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id || hasActiveFilters || isMutating) {
      return;
    }

    const activeItem = items.find((item) => item.id === active.id);
    const overItem = items.find((item) => item.id === over.id);

    if (!activeItem || !overItem || activeItem.horizon !== overItem.horizon) {
      return;
    }

    const horizonItems = items
      .filter((item) => item.horizon === activeItem.horizon)
      .sort((a, b) => a.sort_order - b.sort_order);
    const oldIndex = horizonItems.findIndex((item) => item.id === active.id);
    const newIndex = horizonItems.findIndex((item) => item.id === over.id);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    try {
      await reorderWithinHorizon(
        activeItem.horizon,
        arrayMove(horizonItems, oldIndex, newIndex),
      );
      toast.success("Sortierung gespeichert.");
    } catch (error) {
      toast.error("Sortierung konnte nicht gespeichert werden.", {
        description: errorMessage(error),
      });
    }
  }

  return (
    <section aria-labelledby="roadmap-title">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
            Inhalte
          </p>
          <h1 id="roadmap-title" className="mt-1 text-2xl font-semibold">
            Roadmap
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Öffentliche und interne Roadmap-Einträge verwalten.
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
            <span className="sr-only">Roadmap durchsuchen</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Titel oder Kurztext durchsuchen …"
              className="h-9 w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:border-slate-700 dark:bg-slate-900 dark:focus:border-cyan-400"
            />
          </label>
          <label>
            <span className="sr-only">Nach Status filtern</span>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as ContentStatus | "")
              }
              className={selectClassName}
            >
              <option value="">Alle Status</option>
              {CONTENT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {statusLabels[value]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Nach Horizont filtern</span>
            <select
              value={horizonFilter}
              onChange={(event) =>
                setHorizonFilter(event.target.value as ContentHorizon | "")
              }
              className={selectClassName}
            >
              <option value="">Alle Horizonte</option>
              {CONTENT_HORIZONS.map((value) => (
                <option key={value} value={value}>
                  {horizonLabels[value]}
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
              className={selectClassName}
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
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500 dark:text-slate-400">
          <span>
            {filteredItems.length} von {items.length} Einträgen
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ArrowUpDown aria-hidden="true" className="size-3.5" />
            {hasActiveFilters
              ? "Filter zurücksetzen, um die Reihenfolge zu ändern."
              : "Am Griff innerhalb eines Horizonts sortieren."}
          </span>
        </div>
      </div>

      {loadError ? (
        <div className="mt-5 flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
          <div className="flex gap-3">
            <AlertCircle
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0"
            />
            <div>
              <h2 className="text-sm font-semibold">
                Roadmap konnte nicht geladen werden
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
      ) : (
        <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => void handleDragEnd(event)}
          >
            <table className="w-full min-w-[1100px] border-collapse text-left">
              <thead className="bg-slate-50 text-xs font-medium text-slate-500 dark:bg-slate-900/80 dark:text-slate-400">
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th scope="col" className="w-10 px-2 py-2">
                    <span className="sr-only">Sortierung</span>
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Titel (de)
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Horizont
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Priorität
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Sichtbarkeit
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Übersetzung
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Zuletzt geändert
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Aktion
                  </th>
                </tr>
              </thead>

              {isLoading ? (
                <tbody>
                  <tr>
                    <td colSpan={9} className="h-56 text-center">
                      <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                        <LoaderCircle
                          aria-hidden="true"
                          className="size-4 animate-spin"
                        />
                        Roadmap wird geladen …
                      </span>
                    </td>
                  </tr>
                </tbody>
              ) : filteredItems.length === 0 ? (
                <tbody>
                  <tr>
                    <td
                      colSpan={9}
                      className="h-56 px-6 text-center text-sm text-slate-500 dark:text-slate-400"
                    >
                      Keine Roadmap-Einträge für diese Filter gefunden.
                    </td>
                  </tr>
                </tbody>
              ) : (
                CONTENT_HORIZONS.map((horizon) => {
                  const horizonItems = filteredItems
                    .filter((item) => item.horizon === horizon)
                    .sort((a, b) => a.sort_order - b.sort_order);

                  if (horizonItems.length === 0) {
                    return null;
                  }

                  return (
                    <SortableContext
                      key={horizon}
                      items={horizonItems.map((item) => item.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <tbody>
                        <tr className="border-y border-slate-200 bg-slate-100/80 dark:border-slate-800 dark:bg-slate-950/60">
                          <th
                            scope="rowgroup"
                            colSpan={9}
                            className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
                          >
                            {horizonLabels[horizon]} · {horizonItems.length}
                          </th>
                        </tr>
                        {horizonItems.map((item) => (
                          <SortableRoadmapRow
                            key={item.id}
                            item={item}
                            dragDisabled={hasActiveFilters || isMutating}
                            translationStale={staleTranslationIds.has(item.id)}
                            onEdit={openEditPanel}
                          />
                        ))}
                      </tbody>
                    </SortableContext>
                  );
                })
              )}
            </table>
          </DndContext>
        </div>
      )}

      <RoadmapForm
        key={selectedItem?.id ?? (panelOpen ? "new-open" : "new-closed")}
        open={panelOpen}
        item={selectedItem}
        items={items}
        onSave={saveItem}
        onTranslated={(update) => {
          if (selectedItem) {
            applyRemoteUpdate(selectedItem.id, update);
          }
        }}
        onDelete={selectedItem ? () => deleteItem(selectedItem.id) : null}
        onClose={closePanel}
      />
    </section>
  );
}
