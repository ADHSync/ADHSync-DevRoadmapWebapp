# ADHSync Content Admin

Interne Admin-Webapp zur Pflege und Veröffentlichung der Roadmap- und
Changelog-Inhalte von ADHSync.

## Voraussetzungen

- Node.js 26.5.0 (unterstützt werden Versionen ab 26.4.0 bis vor 27)
- npm 11.17.0 oder neuer innerhalb der Hauptversion 11
- Supabase CLI
- Ein Supabase-Projekt mit dem in `AGENTS.md` beschriebenen Schema

## Lokales Setup

1. Repository klonen und Abhängigkeiten aus der Lockdatei installieren:

   ```bash
   nvm use
   npm ci
   ```

2. Lokale Umgebungsvariablen anlegen:

   ```bash
   cp .env.example .env.local
   ```

3. Das Supabase-Projekt verknüpfen und die Migrationen anwenden:

   ```bash
   supabase init
   supabase link --project-ref <project-ref>
   supabase db push
   ```

   `supabase init` ist nur nötig, solange noch keine
   `supabase/config.toml` vorhanden ist.

4. Den Admin-Benutzer wie unten beschrieben anlegen.

5. Entwicklungsserver starten:

   ```bash
   npm run dev
   ```

### Fehlendes Datenbankschema

Wenn die benötigten Tabellen fehlen, erkennt die Admin-App die entsprechenden
Postgres-/PostgREST-Fehler und zeigt den erforderlichen Migrationsbefehl an:

```bash
supabase db push
```

Das Schema wird bewusst nicht aus dem Browser installiert. Dafür wären
privilegierte Datenbank- oder Management-Zugangsdaten nötig, die gemäß der
Sicherheitsarchitektur niemals im Frontend liegen dürfen. Die versionierten
Migrationen unter `supabase/migrations/` sind die verbindliche und
reproduzierbare Installationsquelle.

## Umgebungsvariablen

### Frontend

Die Root-Datei `.env.local` enthält ausschließlich diese öffentlichen Werte:

| Variable                 | Bedeutung                          |
| ------------------------ | ---------------------------------- |
| `VITE_SUPABASE_URL`      | URL des Supabase-Projekts          |
| `VITE_SUPABASE_ANON_KEY` | Öffentlicher anon-/Publishable-Key |

Alle `VITE_`-Variablen werden von Vite in das Browser-Bundle eingebaut. Deshalb
dürfen dort keine Server-Secrets stehen. Die Vorlage befindet sich in
`.env.example`. Der Wert für `VITE_SUPABASE_ANON_KEY` muss ein öffentlicher
`sb_publishable_…`-Key oder ein Legacy-`anon`-JWT sein. Ein `sb_secret_…`-Key
oder ein JWT mit der Rolle `service_role` wird bereits beim Start und Build
abgewiesen.

### Supabase Edge Functions

Diese Werte existieren nur serverseitig:

| Variable                    | Bereitstellung                                                |
| --------------------------- | ------------------------------------------------------------- |
| `SUPABASE_URL`              | Automatisch durch Supabase                                    |
| `SUPABASE_ANON_KEY`         | Automatisch durch Supabase                                    |
| `SUPABASE_SERVICE_ROLE_KEY` | Automatisch durch Supabase; niemals an das Frontend übergeben |
| `ANTHROPIC_API_KEY`         | Supabase-Secret für die Function `translate`                  |
| `PUBLISH_SECRET`            | Supabase-Secret für die Function `publish`                    |

Die beiden selbst verwalteten Secrets werden gesetzt mit:

```bash
supabase secrets set ANTHROPIC_API_KEY=<key>
supabase secrets set PUBLISH_SECRET=<secret>
```

Sie gehören weder in `.env.local` noch in eine andere Frontend-Datei.

Für ein gehostetes Supabase-Projekt steht eine getrennte, serverseitige Vorlage
bereit. Die lokale Zieldatei wird von Git ignoriert und ausschließlich zum
Upload in den Supabase-Secret-Store verwendet:

```bash
cp supabase/.env.example supabase/.env.remote.local
# Werte in supabase/.env.remote.local eintragen
supabase secrets set --project-ref <project-ref> \
  --env-file supabase/.env.remote.local
```

Ein lokaler Supabase-Stack ist dafür nicht erforderlich; die CLI überträgt die
Werte in das verknüpfte gehostete Projekt. Echte Werte werden nur in dieser
ignorierten Datei oder als Supabase-Secrets gespeichert. Die Root-Dateien
`.env` und `.env.local` bleiben ausschließlich der öffentlichen
Frontend-Konfiguration vorbehalten.

## Admin-Konto anlegen

Es gibt kein Registrierungsformular. Das einzige Konto wird im Supabase
Dashboard manuell angelegt:

1. **Authentication → Users → Add user** öffnen.
2. Die Admin-E-Mail-Adresse eintragen und den Benutzer anlegen.
3. Unter **Authentication → URL Configuration** die Site URL sowie
   `http://localhost:5173/roadmap` als lokale Redirect-URL eintragen.
4. Für die produktive Admin-Webapp deren `/roadmap`-URL ergänzen.
5. Auf `/login` einen Magic Link anfordern und die Anmeldung prüfen.

## Verfügbare Befehle

```bash
npm run dev       # Vite-Entwicklungsserver
npm run build     # TypeScript-Prüfung und Produktions-Build
npm test          # Unit-Tests einmalig ausführen
npm run preview   # Produktions-Build lokal anzeigen
npm run lint      # ESLint ausführen
npm run format    # Dateien mit Prettier formatieren
npm run format:check
npm run audit:frontend-secrets
```

## Projektstruktur

```text
src/
  components/         Wiederverwendbare UI-Bausteine
  features/
    roadmap/          Roadmap-Funktionalität
    changelog/        Changelog-Funktionalität
    publish/          Veröffentlichungsoberfläche
  lib/                Supabase-Client und Hilfsfunktionen
  types/              Aus dem Datenbankschema abgeleitete Typen
supabase/
  migrations/         Datenbankmigrationen
  functions/          Supabase Edge Functions
```

## Stabile Roadmap-IDs

Beim Anlegen eines Roadmap-Eintrags erzeugt die Admin-App den `slug`
automatisch aus dem lokalen Datum und einer fortlaufenden Tagesnummer, zum
Beispiel `260724-1`, `260724-2` und `260724-3`. Der Slug wird anschließend nicht
mehr verändert.

Diese stabile ID wird im veröffentlichten JSON als `id` verwendet und verbindet
Changelog-Einträge mit Roadmap-Einträgen. Dadurch kann die iOS-App denselben
Inhalt über mehrere Veröffentlichungen hinweg wiedererkennen, ohne eine interne
Datenbank-UUID auszugeben.

## Sicherheit

Im Frontend dürfen ausschließlich `VITE_SUPABASE_URL` und
`VITE_SUPABASE_ANON_KEY` verwendet werden. Der Supabase-`service_role`-Key,
`PUBLISH_SECRET` und `ANTHROPIC_API_KEY` sind Server-Secrets und dürfen weder in
`.env`-Dateien dieses Frontends noch in `VITE_`-Variablen oder React-Code
gelangen.

Die verbindliche fachliche und technische Spezifikation steht in
[`AGENTS.md`](./AGENTS.md).

Weitere Hinweise zu Fehlercodes, Rollback und Schemaänderungen stehen im
[Betriebshandbuch](./docs/betrieb.md).

## Edge Functions deployen

Nach dem Setzen der Secrets werden beide Functions ausgerollt:

```bash
supabase functions deploy translate --no-verify-jwt
supabase functions deploy publish --no-verify-jwt
```

Beide Functions prüfen den Bearer-Token selbst mit Supabase Auth. Die
zusätzliche Legacy-JWT-Prüfung des Function-Gateways muss deshalb deaktiviert
bleiben; andernfalls werden Sitzungen mit den aktuellen Signing Keys abgewiesen,
bevor der Function-Code ausgeführt wird.

Vor einem Function-Deployment müssen die zugehörigen Migrationen bereits
angewendet sein:

```bash
supabase db push
```

Neue Roadmap- und Changelog-Einträge können bereits vor dem ersten Speichern
übersetzt werden. In diesem Fall sendet das Frontend ausschließlich den
deutschen Titel und den deutschen Nutzertext an `translate`. Die Function
liefert die englischen Felder und den Quelltext-Hash zurück, schreibt aber noch
nichts in die Datenbank. Erst der normale Speichervorgang legt den vollständigen
Datensatz an.

## Frontend auf Plesk bereitstellen

Das Frontend wird von Vite als statische Website gebaut. Auf Plesk muss daher
kein Node.js-Prozess dauerhaft laufen. Wenn Plesk Node.js 26.5 bereitstellt,
kann der Build im Anwendungsverzeichnis so ausgeführt werden:

```bash
export PATH=/opt/plesk/node/26/bin:$PATH
npm ci
npm run build
```

Dabei müssen `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` als
Build-Umgebungsvariablen gesetzt sein. Anschließend wird der Inhalt von `dist/`
ausgeliefert, zum Beispiel indem `dist/` als Document Root konfiguriert wird.
Die Supabase- und Publish-Secrets bleiben ausschließlich in den Edge Functions.

Die Meldung `nodenv: command not found` entsteht in Plesks Shell-Initialisierung
und nicht im Frontend. Der explizite `PATH` verwendet die von Plesk installierte
Node.js-Version ohne eine projektspezifische `nodenv`-Konfiguration. Tritt die
Meldung bereits beim Öffnen einer CageFS-Shell auf, muss der Serveradministrator
die Plesk-/CageFS-Installation korrigieren.

## Ablauf einer Veröffentlichung

1. Roadmap- und Changelog-Inhalte pflegen und öffentliche Einträge prüfen.
2. Fehlende oder veraltete Übersetzungen in den Listen beziehungsweise
   Formularen kontrollieren. Veraltete Übersetzungen werden exportiert, aber
   vor jeder Veröffentlichung erneut gemeldet.
3. Auf `/publish` Eintragszahlen, ausgeschlossene Inhalte und die
   JSON-Vorschau prüfen.
4. Roadmap oder Changelog auswählen und den Bestätigungsdialog bestätigen.
5. Die Edge Function prüft die Session, lädt ausschließlich öffentliche
   Einträge und reserviert eine monoton steigende Version.
6. Der JSON-Body wird einmal serialisiert, mit `PUBLISH_SECRET` per HMAC-SHA256
   signiert und an den Publish-Endpunkt gesendet.
7. Erfolg oder Fehler wird in `publications` gespeichert. Nach Erfolg zeigt die
   Oberfläche Version, Dateigröße und beide öffentlichen Ziel-URLs.
8. Die Ziel-URLs öffnen und die ausgelieferte `version.json` stichprobenartig
   prüfen.

Die Funktion lädt ausschließlich öffentliche Einträge, baut das Exportobjekt
Feld für Feld und sendet es signiert an den ADHSync-Publish-Endpunkt.
`dev_notes`, `priority` und `visibility` sind nicht Teil des Exporttyps und
werden durch Unit-Tests gegen unbeabsichtigte Ausgabe abgesichert.

## Continuous Integration

Bei jedem Push auf `main` führt GitHub Actions `npm ci`, Lint, Unit-Tests,
Produktions-Build und den Frontend-Secret-Audit aus. Die Workflow-Datei enthält
bewusst kein Deployment. Die verwendete Node-Version wird zentral über
`.nvmrc` festgelegt.
