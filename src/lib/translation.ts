import { sha256 } from "./hash";

interface TranslationSourceBase {
  title_de: string;
  source_hash: string | null;
}

export interface RoadmapTranslationSource extends TranslationSourceBase {
  summary_de: string;
}

export interface ChangelogTranslationSource extends TranslationSourceBase {
  body_de: string;
}

export type TranslationSourceRow =
  RoadmapTranslationSource | ChangelogTranslationSource;

export function translationSourceText(row: TranslationSourceRow): string {
  return "summary_de" in row
    ? `${row.title_de}${row.summary_de}`
    : `${row.title_de}${row.body_de}`;
}

export async function isTranslationStale(
  row: TranslationSourceRow,
): Promise<boolean> {
  return (await sha256(translationSourceText(row))) !== row.source_hash;
}
