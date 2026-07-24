import { supabase } from "./supabase";

type TranslationStatus = "auto";

export interface RoadmapTranslationResult {
  table: "roadmap_items";
  id: string;
  title_en: string;
  summary_en: string;
  translation_status: TranslationStatus;
  source_hash: string;
}

export interface ChangelogTranslationResult {
  table: "changelog_entries";
  id: string;
  title_en: string;
  body_en: string;
  translation_status: TranslationStatus;
  source_hash: string;
}

export type TranslationResult =
  RoadmapTranslationResult | ChangelogTranslationResult;

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
