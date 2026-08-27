# MUCGPT UI-Migrationsplan

Dieser Plan beschreibt die Reihenfolge zur Einführung des [UI-Standards](./UI_STANDARD.md). Er ist bewusst von den dauerhaften Gestaltungsregeln getrennt: Nach Abschluss einer Welle bleibt der Standard gültig, der Plan kann dagegen archiviert werden.

## Ziel

MUCGPT nutzt weiterhin Fluent UI als Komponentenfundament. Die Anwendung erhält darüber eine einheitliche Typografie, Icon-Sprache und wiederverwendbare MUCGPT-Komponenten. Es gibt keine parallele shadcn-Migration.

## Grundsätze für die Umsetzung

- Keine Big-Bang-Migration und kein PR mit mehreren unabhängigen Oberflächen.
- Jede Welle ist in Light und Dark sowie auf Desktop und Mobile abnehmbar.
- Bestehende, gut funktionierende Oberflächen werden nur angefasst, wenn sie von einem gemeinsamen Baustein profitieren.
- Pro sichtbarer Oberfläche wird die Icon-Migration vollständig durchgeführt, damit Fluent- und Lucide-Icons nicht dauerhaft gemischt erscheinen.
- Der aktuelle shadcn-Pilot wird nicht gemergt.

## PR 1 – Standard und Referenzen

**Ziel:** Den UI-Standard als verbindliche Entscheidungsgrundlage abschließen.

- UI-Standard reviewen und als Team freigeben.
- Für die wichtigsten Oberflächen je einen Light- und Dark-Referenzscreen festlegen.
- Die Surface-Zuordnung für Hintergrund, Controls und Cards bestätigen.
- Keine Produktionskomponente umbauen.

**Abnahme:** Alle Beteiligten können bei einem UI-Review auf dieselben Rollen und Referenzen verweisen.

## PR 2 – Lucide-Grundlage

**Ziel:** Eine einheitliche Icon-Sprache technisch vorbereiten.

- `lucide-react` einführen.
- `AppIcon` mit den Größen und Accessibility-Regeln aus dem UI-Standard bereitstellen.
- Prüfen, ob `lucide-animated` samt `motion` für die gewünschten Feedback-Momente aufgenommen wird.
- Falls ja: `AppAnimatedIcon` mit Reduced-Motion-Verhalten bereitstellen.
- Noch keine komplette Anwendungsmigration in dieser PR.

**Abnahme:** Statische und animierte Icons können ohne eigene Größen-, Farb- oder Accessibility-Regeln verwendet werden.

## PR 3 – App-Shell und globale Icons

**Ziel:** Den sichtbarsten gemeinsamen Bereich auf die neue Icon-Sprache umstellen.

- Sidebar, Navigation und globale Utility-Aktionen auf Lucide migrieren.
- Keine Mischung beider Icon-Sets innerhalb dieser Flächen.
- Light, Dark, Tastaturfokus und reduzierte Bewegung prüfen.

**Abnahme:** Die globale Navigation wirkt konsistent und bedient sich wie zuvor.

## PR 4 – Typografie und Seitenköpfe

**Ziel:** Wiederkehrende Textrollen zentral nutzen.

- Gemeinsame Bausteine für Seitenkopf und Abschnittskopf einführen, wenn mindestens mehrere Oberflächen sie benötigen.
- Direkte Typografie-Nachbauten auf den zuerst migrierten Seiten durch Fluent-Textrollen ersetzen.
- Nutzer-Schriftskalierung und lange Übersetzungen prüfen.

**Abnahme:** Neue oder migrierte Seiten verwenden Seitentitel, Abschnittstitel, Beschreibung und Metadaten erkennbar gleich.

## PR 5 – Controls und Formulare

**Ziel:** Die häufigsten Interaktionen vereinheitlichen.

- Wiederkehrende Button-, Icon-Button-, Feld- und Formularmuster zentralisieren.
- Fehler, Hilfetexte, Lade- und Read-only-Zustände festlegen.
- Keine generischen Wrapper einführen, die nur Fluents API duplizieren.

**Abnahme:** Mindestens zwei produktive Oberflächen teilen dieselben Control-Bausteine ohne lokale Fluent-Overrides.

## PR 6 – Cards, Status und Leerzustände

**Ziel:** Wiederkehrende Inhaltsflächen konsistent gestalten.

- Gemeinsame Card-, Badge-, Status- und Empty-State-Muster einführen.
- Zuerst die Komponenten mit vielen bestehenden Overrides anpassen.
- Visuelle Referenzen vor und nach der Umstellung vergleichen.

**Abnahme:** Die migrierten Muster benötigen weniger lokale CSS-Sonderfälle und bleiben optisch mindestens gleichwertig.

## PR 7 ff. – Produktbereiche in Wellen

Die Reihenfolge wird nach Nutzungsfrequenz, Override-Dichte und Wiederverwendung entschieden:

1. Discovery und Assistentenkarten
2. Assistant-Erstellung und -Bearbeitung
3. Chat-Oberfläche und Anhänge
4. Sidebar, Historie und globale Einstellungen
5. Verbleibende Spezialoberflächen

Jede Welle erhält eigene PRs. Ein PR enthält möglichst einen zusammenhängenden Produktbereich und seine unmittelbar benötigten gemeinsamen Bausteine.

## Durchsetzung

Der Standard wird nicht durch ein großes Bestands-Audit oder einen sofort blockierenden Linter eingeführt.

- In neuen und migrierten Dateien ist die Review-Checkliste verbindlich.
- Bestehende Ausnahmen werden beim Anfassen reduziert, nicht pauschal umgeschrieben.
- Erst wenn die gemeinsamen Muster stabil sind, wird entschieden, welche einfache automatische Regel tatsächlich einen Nutzen bringt, etwa ein Verbot neuer direkter Fluent-Icon-Imports in migrierten Bereichen.

## Abschluss

Die Migration ist abgeschlossen, wenn die zentralen Oberflächen die gemeinsamen Typografie-, Icon- und Control-Muster verwenden, die Referenzscreens eingehalten werden und neue UI-Arbeit ohne wiederkehrende Einzelentscheidungen möglich ist.
