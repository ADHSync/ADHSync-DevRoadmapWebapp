import { describe, expect, it } from "vitest";

import {
  buildChangelogExport,
  buildRoadmapExport,
  type ChangelogExportRow,
  type RoadmapExportRow,
} from "./build-export";

const metadata = {
  version: 12,
  versionLabel: "20260724-0815",
  generatedAt: "2026-07-24T08:15:00.000Z",
};

function roadmapRow(values: Partial<RoadmapExportRow> = {}): RoadmapExportRow {
  return {
    slug: "fokus-timer",
    status: "planned",
    horizon: "short",
    category: "Fokus",
    sort_order: 10,
    completed_at: null,
    title_de: "Fokus-Timer",
    summary_de: "Ein Timer, der Pausen mitdenkt.",
    title_en: "Focus timer",
    summary_en: "A timer that plans your breaks.",
    visibility: "public",
    translation_status: "reviewed",
    source_hash: "source",
    dev_notes: "Nur intern",
    priority: "high",
    ...values,
  };
}

function changelogRow(
  values: Partial<ChangelogExportRow> = {},
): ChangelogExportRow {
  return {
    id: "a3f1c8e2",
    app_version: "2.1.0",
    released_on: "2026-07-20",
    change_kind: "added",
    sort_order: 10,
    roadmap_slug: "fokus-timer",
    title_de: "Widgets",
    body_de: "Neue Widgets für den Homescreen.",
    title_en: "Widgets",
    body_en: "New home screen widgets.",
    visibility: "public",
    translation_status: "reviewed",
    source_hash: "source",
    ...values,
  };
}

describe("buildRoadmapExport", () => {
  it("übernimmt interne Felder nie in den Export", () => {
    const result = buildRoadmapExport([roadmapRow()], metadata);
    const item = result.items[0];

    expect(item).not.toHaveProperty("dev_notes");
    expect(item).not.toHaveProperty("devNotes");
    expect(item).not.toHaveProperty("priority");
    expect(item).not.toHaveProperty("visibility");
    expect(JSON.stringify(result)).not.toContain("Nur intern");
  });

  it("filtert interne und noch nicht öffentliche Einträge", () => {
    const result = buildRoadmapExport(
      [
        roadmapRow({ slug: "public", visibility: "public" }),
        roadmapRow({ slug: "internal", visibility: "internal" }),
        roadmapRow({ slug: "draft", visibility: "draft" }),
      ],
      metadata,
    );

    expect(result.items.map((item) => item.id)).toEqual(["public"]);
  });

  it("lässt en vollständig weg, wenn ein englisches Feld fehlt", () => {
    const result = buildRoadmapExport(
      [roadmapRow({ summary_en: null })],
      metadata,
    );

    expect(result.items[0].translations).not.toHaveProperty("en");
  });

  it("sortiert nach sort_order", () => {
    const result = buildRoadmapExport(
      [
        roadmapRow({ slug: "dritter", sort_order: 30 }),
        roadmapRow({ slug: "erster", sort_order: 10 }),
        roadmapRow({ slug: "zweiter", sort_order: 20 }),
      ],
      metadata,
    );

    expect(result.items.map((item) => item.id)).toEqual([
      "erster",
      "zweiter",
      "dritter",
    ]);
  });
});

describe("buildChangelogExport", () => {
  it("sortiert zuerst nach Release absteigend und dann nach sort_order", () => {
    const result = buildChangelogExport(
      [
        changelogRow({
          id: "alt",
          released_on: "2026-06-01",
          sort_order: 1,
        }),
        changelogRow({ id: "neu-zwei", sort_order: 20 }),
        changelogRow({ id: "neu-eins", sort_order: 10 }),
      ],
      metadata,
    );

    expect(result.items.map((item) => item.id)).toEqual([
      "neu-eins",
      "neu-zwei",
      "alt",
    ]);
  });
});
