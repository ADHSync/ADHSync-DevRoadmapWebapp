import { createClient } from "npm:@supabase/supabase-js@2.49.1";

import {
  buildChangelogExport,
  buildRoadmapExport,
  versionLabelFor,
  type ChangelogExportRow,
  type PublishContentType,
  type RoadmapExportRow,
} from "./build-export.ts";

const publishEndpoint = "https://updates.adhsync.com/api/publish.php";

const targetUrls: Record<PublishContentType, string[]> = {
  roadmap: [
    "https://updates.adhsync.com/roadmap/roadmap.json",
    "https://updates.adhsync.com/roadmap/version.json",
  ],
  changelog: [
    "https://updates.adhsync.com/changelog/changelog.json",
    "https://updates.adhsync.com/changelog/version.json",
  ],
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PublishRequest {
  type: PublishContentType;
}

interface RoadmapRelation {
  slug?: unknown;
}

interface ChangelogDatabaseRow {
  id: string;
  app_version: string;
  released_on: string;
  change_kind: ChangelogExportRow["change_kind"];
  sort_order: number;
  title_de: string;
  body_de: string;
  title_en: string | null;
  body_en: string | null;
  visibility: ChangelogExportRow["visibility"];
  translation_status: ChangelogExportRow["translation_status"];
  source_hash: string | null;
  roadmap_items: RoadmapRelation | RoadmapRelation[] | null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function isPublishRequest(value: unknown): value is PublishRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return candidate.type === "roadmap" || candidate.type === "changelog";
}

function relationSlug(
  relation: RoadmapRelation | RoadmapRelation[] | null,
): string | null {
  const candidate = Array.isArray(relation) ? relation[0] : relation;
  return candidate && typeof candidate.slug === "string"
    ? candidate.slug
    : null;
}

function changelogExportRows(
  rows: readonly ChangelogDatabaseRow[],
): ChangelogExportRow[] {
  return rows.map((row) => ({
    id: row.id,
    app_version: row.app_version,
    released_on: row.released_on,
    change_kind: row.change_kind,
    sort_order: row.sort_order,
    roadmap_slug: relationSlug(row.roadmap_items),
    title_de: row.title_de,
    body_de: row.body_de,
    title_en: row.title_en,
    body_en: row.body_en,
    visibility: row.visibility,
    translation_status: row.translation_status,
    source_hash: row.source_hash,
  }));
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : "Unbekannter Fehler";
}

function responseErrorMessage(status: number, responseText: string): string {
  const detail = responseText.trim().slice(0, 500);
  return detail
    ? `Publish-Endpunkt antwortete mit HTTP ${status}: ${detail}`
    : `Publish-Endpunkt antwortete mit HTTP ${status}.`;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );

  return Array.from(new Uint8Array(signature))
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
  const publishSecret = Deno.env.get("PUBLISH_SECRET");

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !publishSecret) {
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

  let requestBody: unknown;

  try {
    requestBody = await request.json();
  } catch {
    return jsonResponse({ error: "Ungültiger JSON-Request." }, 400);
  }

  if (!isPublishRequest(requestBody)) {
    return jsonResponse(
      { error: "Erwartet wird type ('roadmap' oder 'changelog')." },
      400,
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const contentType = requestBody.type;
  let exportRows: RoadmapExportRow[] | ChangelogExportRow[];

  if (contentType === "roadmap") {
    const { data, error } = await adminClient
      .from("roadmap_items")
      .select(
        "slug,status,horizon,category,sort_order,completed_at,title_de,summary_de,title_en,summary_en,visibility,translation_status,source_hash",
      )
      .eq("visibility", "public")
      .order("sort_order", { ascending: true });

    if (error || !data) {
      return jsonResponse(
        { error: `Roadmap konnte nicht geladen werden: ${error?.message}` },
        500,
      );
    }

    exportRows = data as RoadmapExportRow[];
  } else {
    const { data, error } = await adminClient
      .from("changelog_entries")
      .select(
        "id,app_version,released_on,change_kind,sort_order,title_de,body_de,title_en,body_en,visibility,translation_status,source_hash,roadmap_items(slug)",
      )
      .eq("visibility", "public")
      .order("released_on", { ascending: false })
      .order("sort_order", { ascending: true });

    if (error || !data) {
      return jsonResponse(
        { error: `Changelog konnte nicht geladen werden: ${error?.message}` },
        500,
      );
    }

    exportRows = changelogExportRows(data as ChangelogDatabaseRow[]);
  }

  const { data: nextVersion, error: versionError } = await adminClient.rpc(
    "next_publication_version",
    {
      content_type: contentType,
    },
  );
  const version = Number(nextVersion);

  if (versionError || !Number.isSafeInteger(version) || version < 1) {
    return jsonResponse(
      {
        error: `Neue Publikationsversion konnte nicht erzeugt werden: ${versionError?.message ?? "ungültige Version"}`,
      },
      500,
    );
  }

  const generatedDate = new Date();
  const metadata = {
    version,
    versionLabel: versionLabelFor(generatedDate),
    generatedAt: generatedDate.toISOString(),
  };
  const payload =
    contentType === "roadmap"
      ? buildRoadmapExport(exportRows as RoadmapExportRow[], metadata)
      : buildChangelogExport(exportRows as ChangelogExportRow[], metadata);

  // bodyString is deliberately created once and used unchanged for signing and POST.
  const bodyString = JSON.stringify(payload);
  const bodyBytes = new TextEncoder().encode(bodyString);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  let upstreamSucceeded = false;

  try {
    const signature = await hmacSha256Hex(
      publishSecret,
      `${timestamp}.${bodyString}`,
    );
    const publishResponse = await fetch(publishEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ADHSync-Timestamp": timestamp,
        "X-ADHSync-Signature": `sha256=${signature}`,
      },
      body: bodyString,
    });

    if (!publishResponse.ok) {
      throw new Error(
        responseErrorMessage(
          publishResponse.status,
          await publishResponse.text(),
        ),
      );
    }

    upstreamSucceeded = true;

    const { error: logError } = await adminClient.from("publications").insert({
      content_type: contentType,
      version,
      version_label: metadata.versionLabel,
      item_count: payload.items.length,
      payload,
      status: "success",
      error_message: null,
      published_by: user.id,
    });

    if (logError) {
      throw new Error(
        `Erfolgreiche Veröffentlichung konnte nicht protokolliert werden: ${logError.message}`,
      );
    }

    return jsonResponse({
      type: contentType,
      version,
      versionLabel: metadata.versionLabel,
      generatedAt: metadata.generatedAt,
      itemCount: payload.items.length,
      sizeBytes: bodyBytes.byteLength,
      targetUrls: targetUrls[contentType],
    });
  } catch (error) {
    const errorMessage = readableError(error);
    const { error: logError } = await adminClient.from("publications").insert({
      content_type: contentType,
      version,
      version_label: metadata.versionLabel,
      item_count: payload.items.length,
      payload,
      status: "failed",
      error_message: errorMessage,
      published_by: user.id,
    });

    return jsonResponse(
      {
        error: logError
          ? `${errorMessage} Der fehlgeschlagene Versuch konnte nicht protokolliert werden: ${logError.message}`
          : errorMessage,
      },
      upstreamSucceeded ? 500 : 502,
    );
  }
});
