import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileClock,
  LoaderCircle,
  Map as MapIcon,
  RadioTower,
  RefreshCw,
  ScrollText,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "../../components/ConfirmDialog";
import { formatDateTime } from "../../lib/content";
import {
  publishContent,
  type PublishContentType,
  type PublishResult,
} from "../../lib/publish";
import {
  buildChangelogExport,
  buildRoadmapExport,
  versionLabelFor,
  type ChangelogExportRow,
  type ExportMetadata,
} from "../../../supabase/functions/publish/build-export";
import {
  usePublishData,
  type ChangelogPublishRow,
  type PublicationSummary,
  type RoadmapPublishRow,
} from "./usePublishData";

const labels: Record<PublishContentType, string> = {
  roadmap: "Roadmap",
  changelog: "Changelog",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 1,
  }).format(bytes / 1024)} KB`;
}

function previewMetadata(
  latestAttempt: PublicationSummary | null,
  generatedAt: string,
): ExportMetadata {
  return {
    version: (latestAttempt?.version ?? 0) + 1,
    versionLabel: versionLabelFor(new Date(generatedAt)),
    generatedAt,
  };
}

function changelogExportRows(
  entries: readonly ChangelogPublishRow[],
  roadmapItems: readonly RoadmapPublishRow[],
): ChangelogExportRow[] {
  const slugsById = new Map(
    roadmapItems.map((item) => [item.id, item.slug] as const),
  );

  return entries.map((entry) => ({
    id: entry.id,
    app_version: entry.app_version,
    released_on: entry.released_on,
    change_kind: entry.change_kind,
    sort_order: entry.sort_order,
    roadmap_slug: entry.roadmap_item_id
      ? (slugsById.get(entry.roadmap_item_id) ?? null)
      : null,
    title_de: entry.title_de,
    body_de: entry.body_de,
    title_en: entry.title_en,
    body_en: entry.body_en,
    visibility: entry.visibility,
    translation_status: entry.translation_status,
    source_hash: entry.source_hash,
  }));
}

interface PublishCardProps {
  type: PublishContentType;
  latest: PublicationSummary | null;
  publishableCount: number;
  excludedCount: number;
  reviewWarningCount: number;
  staleWarningCount: number;
  preview: string;
  isPublishing: boolean;
  result: PublishResult | null;
  onPublish: () => void;
}

function PublishCard({
  type,
  latest,
  publishableCount,
  excludedCount,
  reviewWarningCount,
  staleWarningCount,
  preview,
  isPublishing,
  result,
  onPublish,
}: PublishCardProps) {
  const Icon = type === "roadmap" ? MapIcon : ScrollText;

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
            <Icon aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold">{labels[type]}</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {latest
                ? `Version ${latest.version} · ${formatDateTime(latest.published_at)}`
                : "Noch nicht veröffentlicht"}
            </p>
          </div>
        </div>
        {latest && (
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            {latest.version_label}
          </span>
        )}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-950/60">
          <dt className="text-xs text-slate-500 dark:text-slate-400">
            Im Export
          </dt>
          <dd className="mt-1 text-xl font-semibold">{publishableCount}</dd>
        </div>
        <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-950/60">
          <dt className="text-xs text-slate-500 dark:text-slate-400">
            Ausgeschlossen
          </dt>
          <dd className="mt-1 text-xl font-semibold">{excludedCount}</dd>
        </div>
      </dl>

      {staleWarningCount > 0 && (
        <div className="mt-4 flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          <p>
            {staleWarningCount}{" "}
            {staleWarningCount === 1
              ? "öffentliche Übersetzung ist veraltet"
              : "öffentliche Übersetzungen sind veraltet"}
            .{" "}
            {staleWarningCount === 1
              ? "Sie wird exportiert"
              : "Sie werden exportiert"}
            ; prüfe sie vor der Veröffentlichung.
          </p>
        </div>
      )}

      {reviewWarningCount > 0 ? (
        <div className="mt-3 flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          <p>
            {reviewWarningCount} öffentliche{" "}
            {reviewWarningCount === 1
              ? "Übersetzung fehlt oder ist"
              : "Übersetzungen fehlen oder sind"}{" "}
            noch nicht geprüft.
          </p>
        </div>
      ) : staleWarningCount === 0 ? (
        <div className="mt-4 flex gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p>Alle öffentlichen Übersetzungen sind geprüft und aktuell.</p>
        </div>
      ) : null}

      <details className="group mt-4 rounded-md border border-slate-200 dark:border-slate-700">
        <summary className="cursor-pointer rounded-md px-3 py-2 text-sm font-medium outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-cyan-600 dark:hover:bg-slate-800">
          JSON-Vorschau anzeigen
        </summary>
        <pre className="max-h-80 overflow-auto border-t border-slate-200 bg-slate-950 p-3 text-xs leading-5 text-slate-100 dark:border-slate-700">
          <code>{preview}</code>
        </pre>
      </details>

      {result && (
        <div
          role="status"
          className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/60"
        >
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            Version {result.version} veröffentlicht ·{" "}
            {formatBytes(result.sizeBytes)}
          </p>
          <ul className="mt-2 space-y-1">
            {result.targetUrls.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-cyan-700 underline decoration-cyan-300 underline-offset-2 hover:text-cyan-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-100"
                >
                  {url}
                  <ExternalLink aria-hidden="true" className="size-3" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={onPublish}
        disabled={isPublishing}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-cyan-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-cyan-600 dark:hover:bg-cyan-500 dark:text-slate-950 dark:focus-visible:ring-offset-slate-900"
      >
        {isPublishing ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <RadioTower aria-hidden="true" className="size-4" />
        )}
        {isPublishing ? "Wird veröffentlicht …" : "Veröffentlichen"}
      </button>
    </article>
  );
}

function PublicationHistory({
  publications,
}: {
  publications: PublicationSummary[];
}) {
  return (
    <section
      aria-labelledby="publication-history-title"
      className="mt-6 rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <FileClock
          aria-hidden="true"
          className="size-5 text-slate-500 dark:text-slate-400"
        />
        <div>
          <h2 id="publication-history-title" className="text-sm font-semibold">
            Letzte Publikationen
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Die letzten 20 erfolgreichen und fehlgeschlagenen Versuche
          </p>
        </div>
      </div>

      {publications.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          Noch keine Publikationen protokolliert.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/50 dark:text-slate-400">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">
                  Inhalt
                </th>
                <th scope="col" className="px-3 py-3 font-medium">
                  Version
                </th>
                <th scope="col" className="px-3 py-3 font-medium">
                  Einträge
                </th>
                <th scope="col" className="px-3 py-3 font-medium">
                  Zeitpunkt
                </th>
                <th scope="col" className="px-3 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Meldung
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {publications.map((publication) => (
                <tr key={publication.id}>
                  <td className="whitespace-nowrap px-5 py-3 font-medium">
                    {labels[publication.content_type]}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {publication.version}{" "}
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      ({publication.version_label})
                    </span>
                  </td>
                  <td className="px-3 py-3">{publication.item_count}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600 dark:text-slate-300">
                    {formatDateTime(publication.published_at)}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={
                        publication.status === "success"
                          ? "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300"
                      }
                    >
                      {publication.status === "success" ? (
                        <CheckCircle2 aria-hidden="true" className="size-3" />
                      ) : (
                        <XCircle aria-hidden="true" className="size-3" />
                      )}
                      {publication.status === "success"
                        ? "Erfolgreich"
                        : "Fehlgeschlagen"}
                    </span>
                  </td>
                  <td className="max-w-sm px-5 py-3 text-xs text-red-700 dark:text-red-300">
                    {publication.error_message ?? "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function PublishPage() {
  const {
    roadmapItems,
    changelogEntries,
    history,
    latestSuccessful,
    latestAttempt,
    reviewWarnings,
    staleWarnings,
    previewGeneratedAt,
    isLoading,
    loadError,
    reload,
  } = usePublishData();
  const [confirmationType, setConfirmationType] =
    useState<PublishContentType | null>(null);
  const [publishingType, setPublishingType] =
    useState<PublishContentType | null>(null);
  const [results, setResults] = useState<
    Partial<Record<PublishContentType, PublishResult>>
  >({});
  const publicRoadmapCount = roadmapItems.filter(
    (item) => item.visibility === "public",
  ).length;
  const publicChangelogCount = changelogEntries.filter(
    (entry) => entry.visibility === "public",
  ).length;
  const previews = useMemo(() => {
    const roadmapPayload = buildRoadmapExport(
      roadmapItems,
      previewMetadata(latestAttempt.roadmap, previewGeneratedAt),
    );
    const changelogPayload = buildChangelogExport(
      changelogExportRows(changelogEntries, roadmapItems),
      previewMetadata(latestAttempt.changelog, previewGeneratedAt),
    );

    return {
      roadmap: JSON.stringify(roadmapPayload, null, 2),
      changelog: JSON.stringify(changelogPayload, null, 2),
    };
  }, [
    changelogEntries,
    latestAttempt.changelog,
    latestAttempt.roadmap,
    previewGeneratedAt,
    roadmapItems,
  ]);

  async function handlePublish() {
    if (!confirmationType) {
      return;
    }

    const type = confirmationType;
    setPublishingType(type);

    try {
      const result = await publishContent(type);
      setResults((current) => ({
        ...current,
        [type]: result,
      }));
      setConfirmationType(null);
      toast.success(`${labels[type]} wurde erfolgreich veröffentlicht.`);
      await reload();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Veröffentlichung fehlgeschlagen.",
      );
      await reload();
    } finally {
      setPublishingType(null);
    }
  }

  const confirmationCount =
    confirmationType === "roadmap" ? publicRoadmapCount : publicChangelogCount;
  const confirmationWarnings = confirmationType
    ? reviewWarnings[confirmationType]
    : 0;
  const confirmationStaleWarnings = confirmationType
    ? staleWarnings[confirmationType]
    : 0;

  return (
    <section aria-labelledby="publish-title">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
            Auslieferung
          </p>
          <h1 id="publish-title" className="mt-1 text-2xl font-semibold">
            Veröffentlichen
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Öffentliche Inhalte prüfen, signieren und als statische JSON-Dateien
            ausliefern.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={isLoading || publishingType !== null}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <RefreshCw
            aria-hidden="true"
            className={isLoading ? "size-4 animate-spin" : "size-4"}
          />
          Aktualisieren
        </button>
      </header>

      {loadError ? (
        <div
          role="alert"
          className="mt-5 flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
        >
          <p>Publish-Daten konnten nicht geladen werden: {loadError}</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="shrink-0 font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          >
            Erneut versuchen
          </button>
        </div>
      ) : isLoading ? (
        <div
          aria-busy="true"
          className="mt-5 grid min-h-64 place-items-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
        >
          <span className="inline-flex items-center gap-2">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            Publikationsdaten werden geladen …
          </span>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <PublishCard
              type="roadmap"
              latest={latestSuccessful.roadmap}
              publishableCount={publicRoadmapCount}
              excludedCount={roadmapItems.length - publicRoadmapCount}
              reviewWarningCount={reviewWarnings.roadmap}
              staleWarningCount={staleWarnings.roadmap}
              preview={previews.roadmap}
              isPublishing={publishingType === "roadmap"}
              result={results.roadmap ?? null}
              onPublish={() => setConfirmationType("roadmap")}
            />
            <PublishCard
              type="changelog"
              latest={latestSuccessful.changelog}
              publishableCount={publicChangelogCount}
              excludedCount={changelogEntries.length - publicChangelogCount}
              reviewWarningCount={reviewWarnings.changelog}
              staleWarningCount={staleWarnings.changelog}
              preview={previews.changelog}
              isPublishing={publishingType === "changelog"}
              result={results.changelog ?? null}
              onPublish={() => setConfirmationType("changelog")}
            />
          </div>

          <PublicationHistory publications={history} />
        </>
      )}

      <ConfirmDialog
        open={confirmationType !== null}
        title={`${confirmationType ? labels[confirmationType] : "Inhalt"} veröffentlichen?`}
        description={`${confirmationCount} ${
          confirmationCount === 1 ? "Eintrag wird" : "Einträge werden"
        } als statische JSON-Dateien veröffentlicht.${
          confirmationWarnings > 0
            ? ` Achtung: ${confirmationWarnings} ${
                confirmationWarnings === 1
                  ? "öffentliche Übersetzung fehlt oder ist"
                  : "öffentliche Übersetzungen fehlen oder sind"
              } ungeprüft.`
            : ""
        }${
          confirmationStaleWarnings > 0
            ? ` ${confirmationStaleWarnings} ${
                confirmationStaleWarnings === 1
                  ? "veraltete Übersetzung wird"
                  : "veraltete Übersetzungen werden"
              } trotzdem exportiert.`
            : ""
        } Die Version kann anschließend nicht zurückgesetzt werden.`}
        confirmLabel="Jetzt veröffentlichen"
        isPending={publishingType !== null}
        onConfirm={() => void handlePublish()}
        onCancel={() => setConfirmationType(null)}
      />
    </section>
  );
}
