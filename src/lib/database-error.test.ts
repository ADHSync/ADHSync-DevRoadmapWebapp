import { describe, expect, it } from "vitest";

import { databaseErrorMessage } from "./database-error";

describe("databaseErrorMessage", () => {
  it.each(["42P01", "PGRST205"])(
    "erklärt ein fehlendes Schema für Fehlercode %s",
    (code) => {
      const message = databaseErrorMessage({
        code,
        message: "Technische Fehlermeldung",
      });

      expect(message).toContain("supabase db push");
      expect(message).toContain("nicht aus dem Browser");
    },
  );

  it("erkennt einen fehlenden Schema-Cache auch ohne bekannten Fehlercode", () => {
    expect(
      databaseErrorMessage({
        message: "Could not find the table in the schema cache",
      }),
    ).toContain("Das Datenbankschema fehlt");
  });

  it("erhält andere Datenbankfehler unverändert", () => {
    expect(
      databaseErrorMessage({ code: "42501", message: "Keine Rechte" }),
    ).toBe("Keine Rechte");
  });
});
