import { describe, expect, it } from "vitest";

import { sha256 } from "./hash";
import { isTranslationStale } from "./translation";

describe("isTranslationStale", () => {
  it("erkennt eine aktuelle Roadmap-Übersetzung", async () => {
    const sourceHash = await sha256("TitelKurztext");

    await expect(
      isTranslationStale({
        title_de: "Titel",
        summary_de: "Kurztext",
        source_hash: sourceHash,
      }),
    ).resolves.toBe(false);
  });

  it("erkennt eine veraltete Changelog-Übersetzung", async () => {
    await expect(
      isTranslationStale({
        title_de: "Neuer Titel",
        body_de: "Neuer Text",
        source_hash: await sha256("Alter TitelAlter Text"),
      }),
    ).resolves.toBe(true);
  });
});
