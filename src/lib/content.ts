import type {
  ChangeKind,
  ContentHorizon,
  ContentPriority,
  ContentStatus,
  ContentVisibility,
  TranslationState,
} from "../types/database";

export const CONTENT_STATUSES = [
  "planned",
  "in_progress",
  "done",
  "cancelled",
] as const satisfies readonly ContentStatus[];

export const CONTENT_HORIZONS = [
  "short",
  "mid",
  "long",
] as const satisfies readonly ContentHorizon[];

export const CONTENT_PRIORITIES = [
  "high",
  "normal",
  "low",
] as const satisfies readonly ContentPriority[];

export const CONTENT_VISIBILITIES = [
  "draft",
  "internal",
  "public",
] as const satisfies readonly ContentVisibility[];

export const TRANSLATION_STATES = [
  "missing",
  "auto",
  "reviewed",
] as const satisfies readonly TranslationState[];

export const CHANGE_KINDS = [
  "added",
  "changed",
  "fixed",
  "removed",
] as const satisfies readonly ChangeKind[];

export const statusLabels: Record<ContentStatus, string> = {
  planned: "Geplant",
  in_progress: "In Arbeit",
  done: "Erledigt",
  cancelled: "Abgebrochen",
};

export const horizonLabels: Record<ContentHorizon, string> = {
  short: "Kurzfristig",
  mid: "Mittelfristig",
  long: "Langfristig",
};

export const priorityLabels: Record<ContentPriority, string> = {
  high: "Hoch",
  normal: "Normal",
  low: "Niedrig",
};

export const visibilityLabels: Record<ContentVisibility, string> = {
  draft: "Entwurf",
  internal: "Intern",
  public: "Öffentlich",
};

export const translationLabels: Record<TranslationState, string> = {
  missing: "Fehlt / veraltet",
  auto: "Automatisch",
  reviewed: "Geprüft",
};

export const changeKindLabels: Record<ChangeKind, string> = {
  added: "Hinzugefügt",
  changed: "Geändert",
  fixed: "Behoben",
  removed: "Entfernt",
};

const umlautMap: Record<string, string> = {
  ä: "ae",
  ö: "oe",
  ü: "ue",
  ß: "ss",
};

export function slugify(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("de")
    .replace(/[äöüß]/g, (character) => umlautMap[character] ?? character)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function todayAsDateInput(): string {
  const now = new Date();
  const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 10);
}

export function formatDate(date: string | null): string {
  if (!date) {
    return "–";
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

export function formatDateTime(date: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Unbekannter Fehler";
}
