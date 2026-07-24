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
