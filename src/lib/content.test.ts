import { describe, expect, it } from "vitest";

import { nextRoadmapId } from "./content";

describe("nextRoadmapId", () => {
  const date = new Date(2026, 6, 24, 12);

  it("beginnt für ein Datum mit der laufenden Nummer 1", () => {
    expect(nextRoadmapId([], date)).toBe("260724-1");
  });

  it("setzt die höchste Nummer desselben Datums fort", () => {
    expect(
      nextRoadmapId(["260724-1", "260724-3", "fokus-timer", "260723-99"], date),
    ).toBe("260724-4");
  });

  it("ignoriert ungültige Nummern desselben Datums", () => {
    expect(
      nextRoadmapId(["260724-0", "260724-test", "260724-2-extra"], date),
    ).toBe("260724-1");
  });
});
