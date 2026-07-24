import { supabase } from "./supabase";

export type PublishContentType = "roadmap" | "changelog";

export interface PublishResult {
  type: PublishContentType;
  version: number;
  versionLabel: string;
  generatedAt: string;
  itemCount: number;
  sizeBytes: number;
  targetUrls: string[];
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

export async function publishContent(
  type: PublishContentType,
): Promise<PublishResult> {
  const { data, error } = await supabase.functions.invoke<PublishResult>(
    "publish",
    {
      body: { type },
    },
  );

  if (error) {
    throw new Error(await functionErrorMessage(error));
  }

  if (
    !data ||
    data.type !== type ||
    !Number.isSafeInteger(data.version) ||
    !Array.isArray(data.targetUrls)
  ) {
    throw new Error("Die Publish-Funktion lieferte ungültige Daten.");
  }

  return data;
}
