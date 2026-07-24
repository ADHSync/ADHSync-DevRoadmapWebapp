# ADHSync Content Admin

Interne Admin-Webapp zur Pflege von Roadmap und Changelog der iOS-App **ADHSync**.
Die Inhalte werden als statische JSON-Dateien veröffentlicht und von der App nachgeladen.

Diese Datei ist die verbindliche Spezifikation. Bei Widersprüchen zwischen einem
Prompt und dieser Datei gilt diese Datei.

---

## Architektur

```
React-Admin (nur der Betreiber, eingeloggt)
        │  supabase-js
        ▼
Supabase  ──  Postgres + Auth + Edge Functions
        │
        │  Edge Function "publish": baut JSON, signiert mit HMAC
        ▼
POST https://updates.adhsync.com/api/publish.php
        │
        ▼
statische Dateien
  https://updates.adhsync.com/roadmap/roadmap.json
  https://updates.adhsync.com/roadmap/version.json
  https://updates.adhsync.com/changelog/changelog.json
  https://updates.adhsync.com/changelog/version.json
        │
        ▼
iOS-App (ADHSync) – Conditional GET über ETag
```

**Die iOS-App spricht niemals direkt mit Supabase.** Sie liest ausschließlich die
statischen JSON-Dateien. Dadurch können interne Daten strukturell nicht abfließen,
und die App funktioniert auch, wenn Supabase nicht erreichbar ist.

---

## Technischer Stack

| Bereich      | Wahl                                          |
| ------------ | --------------------------------------------- |
| Frontend     | React 18 + TypeScript + Vite                  |
| Styling      | Tailwind CSS                                  |
| Datenbank    | Supabase (Postgres)                           |
| Auth         | Supabase Auth, Magic Link, genau ein Benutzer |
| Serverlogik  | Supabase Edge Functions (Deno, TypeScript)    |
| Übersetzung  | Anthropic Messages API                        |
| Auslieferung | Statische Dateien auf Plesk/nginx             |

---

## Harte Regeln

Diese Regeln dürfen unter keinen Umständen verletzt werden:

1. **Keine Secrets im Frontend.** Weder `PUBLISH_SECRET`, noch `ANTHROPIC_API_KEY`,
   noch der Supabase `service_role`-Key gehören in React-Code oder in eine
   `VITE_`-Umgebungsvariable. Alles, was ein Secret braucht, läuft in einer Edge Function.
2. **`dev_notes` verlässt niemals die Datenbank.** Das Feld darf in keinem Export
   auftauchen. Der Publish-Endpunkt lehnt Payloads mit diesem Feld mit HTTP 422 ab.
3. **`priority` und `visibility` werden ebenfalls nicht exportiert.** Die Priorität ist
   eine interne Steuerungsgröße; Nutzern anzuzeigen, dass ihr Wunschfeature „niedrig"
   priorisiert ist, schadet mehr als es nützt.
4. **Nur `visibility = 'public'` wird exportiert.** `draft` und `internal` niemals.
5. **Versionen steigen streng monoton.** Der Server weist niedrigere Versionen ab.
6. **Kein maschinell übersetzter Text wird ungeprüft veröffentlicht**, sofern nicht
   ausdrücklich freigegeben (siehe `translation_status`).

---

## Datenbankschema

```sql
-- ---------------------------------------------------------------- Enums
create type content_status     as enum ('planned', 'in_progress', 'done', 'cancelled');
create type content_visibility as enum ('draft', 'internal', 'public');
create type content_horizon    as enum ('short', 'mid', 'long');
create type content_priority   as enum ('high', 'normal', 'low');
create type translation_state  as enum ('missing', 'auto', 'reviewed');
create type change_kind        as enum ('added', 'changed', 'fixed', 'removed');

-- ---------------------------------------------------------------- Roadmap
create table roadmap_items (
    id                 uuid primary key default gen_random_uuid(),
    slug               text not null unique,          -- stabile ID für die App, z. B. "fokus-timer"

    title_de           text not null,
    summary_de         text not null,                 -- für Nutzer sichtbar
    title_en           text,
    summary_en         text,
    dev_notes          text,                          -- INTERN, wird nie exportiert

    status             content_status     not null default 'planned',
    visibility         content_visibility not null default 'public',
    horizon            content_horizon    not null default 'mid',
    priority           content_priority   not null default 'normal',   -- INTERN
    category           text,                          -- z. B. "Fokus", "Sync", "Widgets"
    sort_order         integer not null default 0,
    completed_at       date,                          -- gesetzt, wenn status = 'done'

    translation_status translation_state not null default 'missing',
    source_hash        text,                          -- sha256(title_de || summary_de)

    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

create index roadmap_items_public_idx on roadmap_items (visibility, sort_order);

-- ---------------------------------------------------------------- Changelog
create table changelog_entries (
    id                 uuid primary key default gen_random_uuid(),
    app_version        text not null,                 -- "2.1.0"
    released_on        date not null,
    change_kind        change_kind not null default 'changed',

    title_de           text not null,
    body_de            text not null,
    title_en           text,
    body_en            text,

    visibility         content_visibility not null default 'public',
    roadmap_item_id    uuid references roadmap_items (id) on delete set null,
    sort_order         integer not null default 0,

    translation_status translation_state not null default 'missing',
    source_hash        text,

    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

create index changelog_entries_public_idx
    on changelog_entries (visibility, released_on desc, sort_order);

-- ---------------------------------------------------------------- Publikationen
create sequence roadmap_version_seq   start 1;
create sequence changelog_version_seq start 1;

create table publications (
    id            bigserial primary key,
    content_type  text not null check (content_type in ('roadmap', 'changelog')),
    version       bigint not null,
    version_label text not null,                      -- yyyymmdd-HHmm (UTC)
    item_count    integer not null default 0,
    payload       jsonb not null,                     -- exakt das veröffentlichte JSON
    status        text not null default 'success' check (status in ('success', 'failed')),
    error_message text,
    published_by  uuid references auth.users (id),
    published_at  timestamptz not null default now(),
    unique (content_type, version)
);

-- ---------------------------------------------------------------- Trigger
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger roadmap_items_updated_at before update on roadmap_items
    for each row execute function set_updated_at();
create trigger changelog_entries_updated_at before update on changelog_entries
    for each row execute function set_updated_at();

-- ---------------------------------------------------------------- RLS
alter table roadmap_items      enable row level security;
alter table changelog_entries  enable row level security;
alter table publications       enable row level security;

-- Kein anon-Zugriff. Nur eingeloggte Benutzer, und das ist nur der Betreiber.
create policy admin_all on roadmap_items
    for all to authenticated using (true) with check (true);
create policy admin_all on changelog_entries
    for all to authenticated using (true) with check (true);
create policy admin_read on publications
    for select to authenticated using (true);
```

### Erläuterung einzelner Felder

- **`slug`** – stabile, menschenlesbare ID. Die App erkennt daran Einträge über
  Veröffentlichungen hinweg wieder, etwa um „neu seit deinem letzten Besuch" zu markieren.
  UUIDs würden das auch leisten, sind aber in Debug-Ausgaben unlesbar.
- **`status`** statt eines Boolean „umgesetzt": Der Zustand `in_progress` ist der,
  den Nutzer am meisten interessiert. Ein Boolean kann ihn nicht abbilden.
- **`sort_order`** – ohne dieses Feld ist die Reihenfolge innerhalb eines Horizonts
  undefiniert und ändert sich zwischen zwei Exporten willkürlich.
- **`source_hash`** – SHA-256 über den deutschen Quelltext zum Zeitpunkt der Übersetzung.
  Weicht der aktuelle Hash ab, ist die englische Fassung veraltet; die UI zeigt das an.
- **`payload`** in `publications` – erlaubt es, jede frühere Veröffentlichung exakt
  zu rekonstruieren, unabhängig vom Archiv auf dem Webserver.

---

## JSON-Exportformat

### `roadmap.json`

```json
{
  "schemaVersion": 1,
  "type": "roadmap",
  "version": 42,
  "versionLabel": "20260723-1430",
  "generatedAt": "2026-07-23T14:30:07Z",
  "defaultLanguage": "de",
  "availableLanguages": ["de", "en"],
  "items": [
    {
      "id": "fokus-timer",
      "status": "in_progress",
      "horizon": "short",
      "category": "Fokus",
      "sortOrder": 10,
      "completedAt": null,
      "translations": {
        "de": {
          "title": "Fokus-Timer",
          "summary": "Ein Timer, der Pausen mitdenkt."
        },
        "en": {
          "title": "Focus timer",
          "summary": "A timer that plans your breaks."
        }
      }
    }
  ]
}
```

### `changelog.json`

```json
{
  "schemaVersion": 1,
  "type": "changelog",
  "version": 7,
  "versionLabel": "20260723-1431",
  "generatedAt": "2026-07-23T14:31:02Z",
  "defaultLanguage": "de",
  "availableLanguages": ["de", "en"],
  "items": [
    {
      "id": "a3f1c8e2",
      "appVersion": "2.1.0",
      "releasedOn": "2026-07-20",
      "changeKind": "added",
      "sortOrder": 10,
      "roadmapItemId": "fokus-timer",
      "translations": {
        "de": {
          "title": "Widgets",
          "body": "Neue Widgets für den Homescreen."
        },
        "en": { "title": "Widgets", "body": "New home screen widgets." }
      }
    }
  ]
}
```

### `version.json`

Schreibt der Server selbst. Rund 130 Byte, damit die App beim Start prüfen kann,
ob sich überhaupt etwas geändert hat:

```json
{
  "type": "roadmap",
  "schemaVersion": 1,
  "version": 42,
  "versionLabel": "20260723-1430",
  "generatedAt": "2026-07-23T14:30:07Z",
  "itemCount": 12
}
```

### Formatregeln

| Regel                                                               | Begründung                                                |
| ------------------------------------------------------------------- | --------------------------------------------------------- |
| `version` ist eine monoton steigende Ganzzahl                       | eindeutig vergleichbar, anders als ein Zeitstempel-String |
| `versionLabel` ist `yyyymmdd-HHmm` in **UTC**                       | menschenlesbar, für Archivdateinamen                      |
| `generatedAt` ist ISO-8601 mit `Z`                                  | maschinenlesbar, zeitzonensicher                          |
| `schemaVersion` ist getrennt von `version`                          | die App kann Formatänderungen erkennen und abfangen       |
| Fehlt eine Übersetzung, **entfällt der `en`-Schlüssel vollständig** | kein leerer String; die App fällt auf `de` zurück         |
| `items` ist nach `sortOrder` vorsortiert                            | die App muss nicht sortieren                              |
| Keine `null`-Werte für optionale Textfelder                         | Schlüssel weglassen statt `null` senden                   |

---

## Signatur des Publish-Requests

```
POST https://updates.adhsync.com/api/publish.php
Content-Type: application/json
X-ADHSync-Timestamp: 1784819407
X-ADHSync-Signature: sha256=<hex>

signature = HMAC_SHA256(key = PUBLISH_SECRET, message = "{timestamp}.{rawBody}")
```

Der signierte Body muss **byteidentisch** zum gesendeten Body sein. Nach dem Signieren
darf das JSON nicht mehr neu serialisiert oder umformatiert werden.

Antwortcodes: `200` Erfolg · `401` Signatur oder Zeitfenster · `409` Version nicht neuer ·
`422` internes Feld im Payload · `413` über 2 MB.

---

## Benennung

- Datenbank: `snake_case`
- JSON-Export und TypeScript: `camelCase`
- Die Umwandlung passiert ausschließlich in der Edge Function `publish`.
