import { supabase } from "./supabase";

type TranslationStatus = "auto";

interface TranslationResultBase {
  translation_status: TranslationStatus;
  source_hash: string;
}

export interface RoadmapDraftTranslationResult extends TranslationResultBase {
  table: "roadmap_items";
  title_en: string;
  summary_en: string;
}

export interface RoadmapTranslationResult extends RoadmapDraftTranslationResult {
  id: string;
}

export interface ChangelogDraftTranslationResult extends TranslationResultBase {
  table: "changelog_entries";
  title_en: string;
  body_en: string;
}

export interface ChangelogTranslationResult extends ChangelogDraftTranslationResult {
  id: string;
}

export type TranslationResult =
  RoadmapTranslationResult | ChangelogTranslationResult;

interface DraftTranslationSource {
  title: string;
  text: string;
}

async function functionErrorMessage(error: unknown): Promise<string> {
  if (
    error &&
    typeof error === "object" &&
    "context" in error &&
    error.context instanceof Response
  ) {
    try {
      const body = (await error.context.clone().json()) as {
        error?: unknown;
      };

      if (typeof body.error === "string") {
        return body.error;
      }
    } catch {
      // Use the generic SDK error below.
    }
  }

  return error instanceof Error ? error.message : "Unbekannter Fehler";
}

export async function translateEntry(
  table: "roadmap_items",
  id: string,
): Promise<RoadmapTranslationResult>;
export async function translateEntry(
  table: "changelog_entries",
  id: string,
): Promise<ChangelogTranslationResult>;
export async function translateEntry(
  table: "roadmap_items" | "changelog_entries",
  id: string,
): Promise<TranslationResult> {
  const { data, error } = await supabase.functions.invoke<TranslationResult>(
    "translate",
    {
      body: { table, id },
    },
  );

  if (error) {
    throw new Error(await functionErrorMessage(error));
  }

  if (!data || data.table !== table || data.id !== id) {
    throw new Error("Die Übersetzungsfunktion lieferte ungültige Daten.");
  }

  return data;
}

export async function translateDraft(
  table: "roadmap_items",
  source: DraftTranslationSource,
): Promise<RoadmapDraftTranslationResult>;
export async function translateDraft(
  table: "changelog_entries",
  source: DraftTranslationSource,
): Promise<ChangelogDraftTranslationResult>;
export async function translateDraft(
  table: "roadmap_items" | "changelog_entries",
  source: DraftTranslationSource,
): Promise<RoadmapDraftTranslationResult | ChangelogDraftTranslationResult> {
  const { data, error } = await supabase.functions.invoke<
    RoadmapDraftTranslationResult | ChangelogDraftTranslationResult
  >("translate", {
    body: { table, source },
  });

  if (error) {
    throw new Error(await functionErrorMessage(error));
  }

  const expectedText =
    table === "roadmap_items"
      ? data && "summary_en" in data && data.summary_en
      : data && "body_en" in data && data.body_en;

  if (
    !data ||
    data.table !== table ||
    typeof data.title_en !== "string" ||
    typeof expectedText !== "string" ||
    data.translation_status !== "auto" ||
    typeof data.source_hash !== "string"
  ) {
    throw new Error("Die Übersetzungsfunktion lieferte ungültige Daten.");
  }

  return data;
}
