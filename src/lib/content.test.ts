import { describe, expect, it } from "vitest";

import { slugify, uniqueSlug } from "./content";

describe("slugify", () => {
  it("normalisiert deutsche Titel", () => {
    expect(slugify("  Verschlüsselter Anhang-Sync  ")).toBe(
      "verschluesselter-anhang-sync",
    );
  });
});

describe("uniqueSlug", () => {
  it("verwendet den normalisierten Titel, wenn er noch frei ist", () => {
    expect(uniqueSlug("Fokus-Timer", [])).toBe("fokus-timer");
  });

  it("ergänzt bei Kollisionen eine fortlaufende Nummer", () => {
    expect(uniqueSlug("Fokus-Timer", ["fokus-timer", "fokus-timer-2"])).toBe(
      "fokus-timer-3",
    );
  });

  it("liefert auch für nicht slug-fähige Titel eine stabile Basis", () => {
    expect(uniqueSlug("✨", [])).toBe("roadmap-eintrag");
  });

  it("hält inklusive Kollisionssuffix das Datenbanklimit ein", () => {
    const title = "Ein sehr langer Titel ".repeat(20);
    const base = uniqueSlug(title, []);
    const duplicate = uniqueSlug(title, [base]);

    expect(base.length).toBeLessThanOrEqual(100);
    expect(duplicate.length).toBeLessThanOrEqual(100);
    expect(duplicate.endsWith("-2")).toBe(true);
  });
});
