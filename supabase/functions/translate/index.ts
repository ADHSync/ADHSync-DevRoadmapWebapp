import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const allowedTables = ["roadmap_items", "changelog_entries"] as const;

type TranslatableTable = (typeof allowedTables)[number];

interface TranslateStoredRequest {
  table: TranslatableTable;
  id: string;
}

interface TranslateDraftRequest {
  table: TranslatableTable;
  source: {
    title: string;
    text: string;
  };
}

type TranslateRequest = TranslateStoredRequest | TranslateDraftRequest;

interface AnthropicResponse {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
}

const systemPrompt = `
Du übersetzt deutsche Texte ins Englische für die Nutzeroberfläche einer ADHS-App.

Regeln:
- Ton: klar, freundlich und direkt.
- Verwende keinen Fachjargon, keine Marketingsprache und keine Verniedlichungen.
- Der Produktname "ADHSync" und Feature-Eigennamen bleiben unverändert.
- Übersetze ADHS immer mit ADHD.
- Ein title darf höchstens 80 Zeichen lang sein.
- Eine summary oder ein Changelog-body darf höchstens 300 Zeichen lang sein.
- Antworte ausschließlich mit dem angeforderten JSON-Objekt.
- Verwende keine Markdown-Codefences und keine Vorrede.
`.trim();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function isTranslateRequest(value: unknown): value is TranslateRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const tableIsValid =
    typeof candidate.table === "string" &&
    allowedTables.includes(candidate.table as TranslatableTable);

  if (!tableIsValid) {
    return false;
  }

  if (typeof candidate.id === "string") {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      candidate.id,
    );
  }

  if (!candidate.source || typeof candidate.source !== "object") {
    return false;
  }

  const source = candidate.source as Record<string, unknown>;

  return (
    typeof source.title === "string" &&
    source.title.trim().length > 0 &&
    source.title.trim().length <= 80 &&
    typeof source.text === "string" &&
    source.text.trim().length > 0 &&
    source.text.trim().length <= 300
  );
}

function stripCodeFences(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseTranslation(
  text: string,
  textField: "summary" | "body",
): { title: string; text: string } | null {
  try {
    const parsed = JSON.parse(stripCodeFences(text)) as Record<string, unknown>;
    const title = parsed.title;
    const translatedText = parsed[textField];

    if (typeof title !== "string" || typeof translatedText !== "string") {
      return null;
    }

    const normalizedTitle = title.trim();
    const normalizedText = translatedText.trim();

    if (
      !normalizedTitle ||
      !normalizedText ||
      normalizedTitle.length > 80 ||
      normalizedText.length > 300
    ) {
      return null;
    }

    return {
      title: normalizedTitle,
      text: normalizedText,
    };
  } catch {
    return null;
  }
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Nur POST ist erlaubt." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !anthropicApiKey) {
    return jsonResponse(
      { error: "Erforderliche Server-Konfiguration fehlt." },
      500,
    );
  }

  const authorization = request.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Gültige Sitzung erforderlich." }, 401);
  }

  const token = authorization.slice("Bearer ".length).trim();
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(token);

  if (authError || !user) {
    return jsonResponse({ error: "Gültige Sitzung erforderlich." }, 401);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Ungültiger JSON-Request." }, 400);
  }

  if (!isTranslateRequest(body)) {
    return jsonResponse(
      {
        error:
          "Erwartet werden table und entweder eine gültige UUID oder deutscher Quelltext.",
      },
      400,
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const isRoadmap = body.table === "roadmap_items";
  const sourceTextField = isRoadmap ? "summary_de" : "body_de";
  const responseTextField = isRoadmap ? "summary" : "body";
  const selectColumns = isRoadmap
    ? "id,title_de,summary_de"
    : "id,title_de,body_de";
  let titleDe: string;
  let sourceText: string;

  if ("id" in body) {
    const { data: record, error: readError } = await adminClient
      .from(body.table)
      .select(selectColumns)
      .eq("id", body.id)
      .single();

    if (readError || !record) {
      return jsonResponse(
        { error: "Der zu übersetzende Eintrag wurde nicht gefunden." },
        404,
      );
    }

    titleDe = record.title_de;
    sourceText = record[sourceTextField];

    if (typeof titleDe !== "string" || typeof sourceText !== "string") {
      return jsonResponse(
        { error: "Der deutsche Quelltext des Eintrags ist ungültig." },
        500,
      );
    }
  } else {
    titleDe = body.source.title.trim();
    sourceText = body.source.text.trim();
  }

  const requestedShape = isRoadmap
    ? '{"title":"...","summary":"..."}'
    : '{"title":"...","body":"..."}';
  const anthropicResponse = await fetch(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Übersetze dieses JSON ins Englische und antworte exakt im Format ${requestedShape}: ${JSON.stringify(
              {
                title: titleDe,
                [responseTextField]: sourceText,
              },
            )}`,
          },
        ],
      }),
    },
  );

  if (!anthropicResponse.ok) {
    return jsonResponse(
      { error: "Der Übersetzungsdienst ist derzeit nicht verfügbar." },
      502,
    );
  }

  let anthropicPayload: AnthropicResponse;

  try {
    anthropicPayload = (await anthropicResponse.json()) as AnthropicResponse;
  } catch {
    return jsonResponse(
      { error: "Der Übersetzungsdienst lieferte ungültiges JSON." },
      502,
    );
  }

  const responseText = anthropicPayload.content?.find(
    (block) => block.type === "text",
  )?.text;

  if (!responseText) {
    return jsonResponse(
      { error: "Der Übersetzungsdienst lieferte keinen Text." },
      502,
    );
  }

  const translation = parseTranslation(responseText, responseTextField);

  if (!translation) {
    return jsonResponse(
      {
        error:
          "Die Antwort des Übersetzungsdienstes hatte nicht das erwartete JSON-Format oder überschritt die Längenbegrenzungen.",
      },
      502,
    );
  }

  const sourceHash = await sha256(`${titleDe}${sourceText}`);
  const updatePayload = isRoadmap
    ? {
        title_en: translation.title,
        summary_en: translation.text,
        translation_status: "auto",
        source_hash: sourceHash,
      }
    : {
        title_en: translation.title,
        body_en: translation.text,
        translation_status: "auto",
        source_hash: sourceHash,
      };
  const updateColumns = isRoadmap
    ? "id,title_en,summary_en,translation_status,source_hash"
    : "id,title_en,body_en,translation_status,source_hash";

  if (!("id" in body)) {
    return jsonResponse({
      table: body.table,
      ...updatePayload,
    });
  }

  const { data: updatedRecord, error: updateError } = await adminClient
    .from(body.table)
    .update(updatePayload)
    .eq("id", body.id)
    .select(updateColumns)
    .single();

  if (updateError || !updatedRecord) {
    return jsonResponse(
      { error: "Die Übersetzung konnte nicht gespeichert werden." },
      500,
    );
  }

  return jsonResponse({
    table: body.table,
    ...updatedRecord,
  });
});
