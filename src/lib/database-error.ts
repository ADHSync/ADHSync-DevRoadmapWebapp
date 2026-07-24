interface DatabaseErrorLike {
  code?: string;
  message?: string;
}

const missingSchemaErrorCodes = new Set(["42P01", "PGRST205"]);

export function databaseErrorMessage(error: DatabaseErrorLike): string {
  if (
    (error.code && missingSchemaErrorCodes.has(error.code)) ||
    error.message?.includes("schema cache")
  ) {
    return (
      "Das Datenbankschema fehlt oder ist noch nicht über die Supabase API " +
      "verfügbar. Wende die versionierten Migrationen mit „supabase db push“ " +
      "an und versuche es erneut. Die Admin-App installiert das Schema aus " +
      "Sicherheitsgründen nicht aus dem Browser."
    );
  }

  return error.message?.trim() || "Unbekannter Datenbankfehler";
}
