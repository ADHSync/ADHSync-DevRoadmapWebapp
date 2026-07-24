# Betrieb und Störungsbehebung

Dieses Dokument beschreibt den Betrieb der statischen Roadmap- und
Changelog-Veröffentlichungen. Die fachlich und technisch verbindliche
Spezifikation steht in [`AGENTS.md`](../AGENTS.md).

## Fehler des Publish-Endpunkts

| Code  | Bedeutung                                                                  | Gegenmaßnahme                                                                                                                                                                                                                                                                         |
| ----- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `401` | Signatur ungültig oder Zeitstempel außerhalb des erlaubten Zeitfensters.   | Systemzeit der Supabase Edge Function und des Webservers prüfen. Danach kontrollieren, ob auf beiden Seiten dasselbe `PUBLISH_SECRET` gesetzt ist und ob exakt der gesendete Body signiert wird. Bei möglicher Offenlegung das Secret auf beiden Seiten rotieren.                     |
| `409` | Die gesendete Version ist nicht größer als die bereits veröffentlichte.    | Aktuelle Serverversion und letzten Eintrag in `publications` vergleichen. Nach Restore oder Projektwechsel die betroffene Postgres-Sequenz mit `setval(...)` mindestens auf die Serverversion anheben. Nie eine niedrigere Version erzwingen oder die Versionsprüfung umgehen.        |
| `422` | Der Payload enthält ein verbotenes internes Feld oder verletzt das Schema. | Veröffentlichung stoppen und den fehlgeschlagenen Payload prüfen. Insbesondere nach `dev_notes`, `priority` und `visibility` suchen. Den feldweisen Export-Builder und dessen Unit-Tests korrigieren; erst danach mit der nächsten monoton steigenden Version erneut veröffentlichen. |
| `413` | Der JSON-Body überschreitet 2 MB.                                          | Ungewöhnlich große Texte oder eine unerwartet hohe Eintragszahl prüfen. Inhalte fachlich kürzen; das Größenlimit nicht durch einen ungeprüften alternativen Upload umgehen.                                                                                                           |

Ein fehlgeschlagener Versuch verbraucht eine Versionsnummer. Das ist erwartet:
Versionen müssen monoton steigen und dürfen Lücken enthalten.

## Rollback über das Archiv

Ein Rollback darf keine alte Versionsnummer erneut ausliefern, weil Clients
diese gegenüber einer bereits gesehenen neueren Version ignorieren können.

1. Weitere Veröffentlichungen anhalten und die aktuell ausgelieferte Version
   sowie die nächste Datenbankversion notieren.
2. Die gewünschte frühere `roadmap.json` beziehungsweise `changelog.json` aus
   dem Serverarchiv in eine Arbeitskopie übernehmen.
3. Für die Arbeitskopie eine neue, höhere Version reservieren. `version`,
   `versionLabel` und `generatedAt` im Hauptdokument aktualisieren.
4. Eine dazu passende `version.json` mit derselben Version und dem korrekten
   `itemCount` erzeugen.
5. Hauptdatei und `version.json` auf dem Webserver möglichst atomar an ihre
   öffentlichen Pfade verschieben.
6. Die entsprechende Postgres-Sequenz mindestens auf diese neue Version setzen,
   damit die nächste reguläre Veröffentlichung nicht mit `409` scheitert.
7. Beide öffentlichen URLs abrufen, JSON und ETag prüfen und anschließend einen
   App-Test durchführen.

Das archivierte Dokument liefert dabei den Inhalt; die Rollback-Veröffentlichung
erhält immer neue Metadaten und eine neue Version.

## Neue `schemaVersion`

Eine neue `schemaVersion` ist eine Formatmigration und keine normale
Inhaltsänderung.

1. Zuerst die iOS-App so erweitern, dass sie die neue Version versteht und bei
   unbekannten Versionen sicher auf vorhandene Inhalte zurückfällt.
2. Beispiele und Decoder-Tests für altes und neues Format ergänzen. Bestehende
   Felder nicht stillschweigend umdeuten.
3. Export-Builder, TypeScript-Typen, Unit-Tests und die Erzeugung von
   `version.json` gemeinsam auf die neue `schemaVersion` umstellen.
4. Falls der Publish-Endpunkt Payloads validiert, dessen Schema vor der Edge
   Function ausrollen und Abwärtskompatibilität prüfen.
5. In einer Staging-Umgebung veröffentlichen und beide statischen Dateien sowie
   das Verhalten einer alten und einer neuen App-Version testen.
6. Erst danach produktiv veröffentlichen. Die Inhaltsversion steigt unabhängig
   von der `schemaVersion` weiter monoton.

Bei Problemen wird das vorherige Format mit einer neuen Inhaltsversion aus dem
Archiv wiederhergestellt; die Versionsnummer wird niemals zurückgesetzt.
