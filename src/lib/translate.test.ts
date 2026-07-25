import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("./supabase", () => ({
  supabase: {
    functions: {
      invoke,
    },
  },
}));

import { translateDraft } from "./translate";

describe("translateDraft", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("sendet einen neuen Roadmap-Entwurf ohne Datenbank-ID", async () => {
    invoke.mockResolvedValue({
      data: {
        table: "roadmap_items",
        title_en: "Focus timer",
        summary_en: "A timer that plans breaks.",
        translation_status: "auto",
        source_hash: "source-hash",
      },
      error: null,
    });

    await expect(
      translateDraft("roadmap_items", {
        title: "Fokus-Timer",
        text: "Ein Timer, der Pausen mitdenkt.",
      }),
    ).resolves.toMatchObject({
      title_en: "Focus timer",
      summary_en: "A timer that plans breaks.",
    });

    expect(invoke).toHaveBeenCalledWith("translate", {
      body: {
        table: "roadmap_items",
        source: {
          title: "Fokus-Timer",
          text: "Ein Timer, der Pausen mitdenkt.",
        },
      },
    });
  });

  it("weist eine unvollständige Antwort zurück", async () => {
    invoke.mockResolvedValue({
      data: {
        table: "changelog_entries",
        title_en: "Widgets",
        translation_status: "auto",
        source_hash: "source-hash",
      },
      error: null,
    });

    await expect(
      translateDraft("changelog_entries", {
        title: "Widgets",
        text: "Neue Widgets für den Homescreen.",
      }),
    ).rejects.toThrow("ungültige Daten");
  });
});
