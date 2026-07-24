export type PublishContentType = "roadmap" | "changelog";
export type ExportVisibility = "draft" | "internal" | "public";
export type ExportTranslationState = "missing" | "auto" | "reviewed";
export type ExportRoadmapStatus =
  "planned" | "in_progress" | "done" | "cancelled";
export type ExportRoadmapHorizon = "short" | "mid" | "long";
export type ExportChangeKind = "added" | "changed" | "fixed" | "removed";

export interface ExportMetadata {
  version: number;
  versionLabel: string;
  generatedAt: string;
}

export interface RoadmapExportRow {
  slug: string;
  status: ExportRoadmapStatus;
  horizon: ExportRoadmapHorizon;
  category: string | null;
  sort_order: number;
  completed_at: string | null;
  title_de: string;
  summary_de: string;
  title_en: string | null;
  summary_en: string | null;
  visibility: ExportVisibility;
  translation_status: ExportTranslationState;
  source_hash: string | null;
  dev_notes?: string | null;
  priority?: "high" | "normal" | "low";
}

export interface ChangelogExportRow {
  id: string;
  app_version: string;
  released_on: string;
  change_kind: ExportChangeKind;
  sort_order: number;
  roadmap_slug: string | null;
  title_de: string;
  body_de: string;
  title_en: string | null;
  body_en: string | null;
  visibility: ExportVisibility;
  translation_status: ExportTranslationState;
  source_hash: string | null;
}

interface RoadmapExportItem {
  id: string;
  status: ExportRoadmapStatus;
  horizon: ExportRoadmapHorizon;
  category?: string;
  sortOrder: number;
  completedAt: string | null;
  translations: {
    de: {
      title: string;
      summary: string;
    };
    en?: {
      title: string;
      summary: string;
    };
  };
}

interface ChangelogExportItem {
  id: string;
  appVersion: string;
  releasedOn: string;
  changeKind: ExportChangeKind;
  sortOrder: number;
  roadmapItemId?: string;
  translations: {
    de: {
      title: string;
      body: string;
    };
    en?: {
      title: string;
      body: string;
    };
  };
}

export interface RoadmapExport {
  schemaVersion: 1;
  type: "roadmap";
  version: number;
  versionLabel: string;
  generatedAt: string;
  defaultLanguage: "de";
  availableLanguages: ["de", "en"];
  items: RoadmapExportItem[];
}

export interface ChangelogExport {
  schemaVersion: 1;
  type: "changelog";
  version: number;
  versionLabel: string;
  generatedAt: string;
  defaultLanguage: "de";
  availableLanguages: ["de", "en"];
  items: ChangelogExportItem[];
}

function hasText(value: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function roadmapItemFromRow(row: RoadmapExportRow): RoadmapExportItem {
  const translations: RoadmapExportItem["translations"] = {
    de: {
      title: row.title_de,
      summary: row.summary_de,
    },
  };

  if (hasText(row.title_en) && hasText(row.summary_en)) {
    translations.en = {
      title: row.title_en,
      summary: row.summary_en,
    };
  }

  const item: RoadmapExportItem = {
    id: row.slug,
    status: row.status,
    horizon: row.horizon,
    sortOrder: row.sort_order,
    completedAt: row.completed_at,
    translations,
  };

  if (hasText(row.category)) {
    item.category = row.category;
  }

  return item;
}

function changelogItemFromRow(row: ChangelogExportRow): ChangelogExportItem {
  const translations: ChangelogExportItem["translations"] = {
    de: {
      title: row.title_de,
      body: row.body_de,
    },
  };

  if (hasText(row.title_en) && hasText(row.body_en)) {
    translations.en = {
      title: row.title_en,
      body: row.body_en,
    };
  }

  const item: ChangelogExportItem = {
    id: row.id,
    appVersion: row.app_version,
    releasedOn: row.released_on,
    changeKind: row.change_kind,
    sortOrder: row.sort_order,
    translations,
  };

  if (hasText(row.roadmap_slug)) {
    item.roadmapItemId = row.roadmap_slug;
  }

  return item;
}

export function buildRoadmapExport(
  rows: readonly RoadmapExportRow[],
  metadata: ExportMetadata,
): RoadmapExport {
  const items = rows
    .filter((row) => row.visibility === "public")
    .sort((left, right) => left.sort_order - right.sort_order)
    .map(roadmapItemFromRow);

  return {
    schemaVersion: 1,
    type: "roadmap",
    version: metadata.version,
    versionLabel: metadata.versionLabel,
    generatedAt: metadata.generatedAt,
    defaultLanguage: "de",
    availableLanguages: ["de", "en"],
    items,
  };
}

export function buildChangelogExport(
  rows: readonly ChangelogExportRow[],
  metadata: ExportMetadata,
): ChangelogExport {
  const items = rows
    .filter((row) => row.visibility === "public")
    .sort(
      (left, right) =>
        right.released_on.localeCompare(left.released_on) ||
        left.sort_order - right.sort_order,
    )
    .map(changelogItemFromRow);

  return {
    schemaVersion: 1,
    type: "changelog",
    version: metadata.version,
    versionLabel: metadata.versionLabel,
    generatedAt: metadata.generatedAt,
    defaultLanguage: "de",
    availableLanguages: ["de", "en"],
    items,
  };
}

export function versionLabelFor(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return `${year}${month}${day}-${hours}${minutes}`;
}
