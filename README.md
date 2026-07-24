# ADHSync Content Admin

Interne Admin-Webapp zur Pflege und Veröffentlichung der Roadmap- und
Changelog-Inhalte von ADHSync.

## Voraussetzungen

- Node.js 22
- npm
- Supabase CLI
- Ein Supabase-Projekt mit dem in `AGENTS.md` beschriebenen Schema

## Lokales Setup

1. Repository klonen und Abhängigkeiten aus der Lockdatei installieren:

   ```bash
   npm ci
   ```

2. Lokale Umgebungsvariablen anlegen:

   ```bash
   cp .env.example .env.local
   ```

3. Das Supabase-Projekt verknüpfen und die Migrationen anwenden:

   ```bash
   supabase link --project-ref <project-ref>
   supabase db push
   ```

4. Den Admin-Benutzer wie unten beschrieben anlegen.

5. Entwicklungsserver starten:

   ```bash
   npm run dev
   ```

## Umgebungsvariablen

### Frontend

Die Root-Datei `.env.local` enthält ausschließlich diese öffentlichen Werte:

| Variable                 | Bedeutung                                |
| ------------------------ | ---------------------------------------- |
| `VITE_SUPABASE_URL`      | URL des Supabase-Projekts                |
| `VITE_SUPABASE_ANON_KEY` | Öffentlicher anon-/publishable-Schlüssel |

Alle `VITE_`-Variablen werden von Vite in das Browser-Bundle eingebaut. Deshalb
dürfen dort keine Server-Secrets stehen. Die Vorlage befindet sich in
`.env.example`.

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
supabase functions deploy translate
supabase functions deploy publish
```

Vor einem Function-Deployment müssen die zugehörigen Migrationen bereits
angewendet sein:

```bash
supabase db push
```

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
bewusst kein Deployment.
