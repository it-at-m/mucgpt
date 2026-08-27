# MUCGPT UI-Standard

**Status:** Zielstandard, schrittweise eingeführt.  
**Geltung:** Neuer UI-Code folgt diesem Standard sofort. Bestehender Code wird nur im Rahmen der geplanten Migrationswellen angepasst.

Dieser Standard beschreibt die gewünschte MUCGPT-Oberfläche im bestehenden Fluent-UI-Stack. Er ist kein Ersatz für Fluents Dokumentation und keine Liste von Verboten für jeden CSS-Wert. Sein Zweck ist, wiederkehrende Designentscheidungen einmal zu treffen, statt sie auf jeder Seite neu zu treffen.

Die Reihenfolge der Umsetzung steht in [UI_MIGRATION_PLAN.md](./UI_MIGRATION_PLAN.md).

---

## 1. Leitprinzipien

1. **Fluent ist das technische Fundament.** Fluent-Komponenten, Slots, Props und Theme-Tokens werden bevorzugt, bevor CSS-Overrides eingesetzt werden.
2. **MUCGPT definiert die visuelle Sprache.** Farben, Typografie, Abstände, Radien und Zustände folgen zentralen MUCGPT-Regeln.
3. **Wiederholung wird zentralisiert.** Eine wiederkehrende visuelle Entscheidung gehört in Theme, gemeinsame Komponente oder Utility, nicht in die einzelne Seite.
4. **Bestehende Optik ist eine Referenz.** Eine Migration darf eine Oberfläche nicht ohne bewusste Produktentscheidung visuell verschlechtern.
5. **Barrierefreiheit ist Teil der Komponente.** Sichtbarer Fokus, Tastaturbedienung und verständliche Zustände sind keine nachträgliche Politur.

---

## 2. Token-Architektur

```
Fluent-Komponenten und Token-Skalen
                ↓
MUCGPT-Theme-Semantik in themeTokens.ts und LayoutHelper.tsx
                ↓
Gemeinsame MUCGPT-Komponenten und Feature-CSS
```

Fluent liefert die Komponentenmechanik und Token-Skalen. MUCGPT darf Theme-Alias-Tokens gezielt anpassen, um eine eigene, konsistente Sprache umzusetzen.

In Komponenten-CSS werden bevorzugt Tokens verwendet. Neue Rohfarben, eigene Schatten oder willkürliche Schriftgrößen brauchen eine bewusste Begründung. Strukturelle CSS-Werte wie `100%`, `minmax()`, `calc()`, Grid-Definitionen oder Transform-Werte bleiben erlaubt.

Wenn ein wiederkehrender Wert fehlt, wird er als semantisches MUCGPT-Token ergänzt. Ein einmaliger, rein struktureller Wert muss nicht künstlich tokenisiert werden.

---

## 3. Typografie

### 3.1 Grundregeln

- Die Basisschrift kommt aus Fluents `fontFamilyBase`; Komponenten-CSS setzt keine eigene Schriftfamilie.
- `fontFamilyMonospace` wird für Code, technische IDs und strukturierte Tokenwerte verwendet.
- Montserrat bleibt ausschließlich der Wortmarke vorbehalten.
- Für normalen UI-Text werden Fluent-Typografie-Komponenten verwendet, wenn sie semantisch passen.
- Wo dies nicht möglich ist, etwa in Markdown, Textareas oder Fremdkomponenten, werden die Fluent-Schrift-Tokens verwendet. Rohwerte sind dort nur mit einer begründeten Ausnahme zulässig.
- Schriftgrößen und Zeilenhöhen, die Nutzer-Schriftskalierung respektieren müssen, dürfen nicht hartkodiert werden.

### 3.2 Textrollen

| Rolle                    | Bevorzugte Fluent-Komponente | Einsatz                                    |
| ------------------------ | ---------------------------- | ------------------------------------------ |
| Seitentitel              | `Title2`                     | Ein Titel pro Seite                        |
| Abschnittstitel          | `Title3`                     | Hauptabschnitte einer Seite                |
| Dialog-/Drawer-Titel     | `Subtitle1`                  | Kontexttitel                               |
| Karten- oder Listentitel | `Subtitle2`                  | Wiederkehrende Einträge                    |
| Standardtext             | `Body1`                      | UI-Text, Beschreibungen                    |
| Lesetext                 | `Body2`                      | Chat-Antworten, Tutorials, längere Inhalte |
| Metadaten                | `Caption1`                   | Zeitstempel, Autor, Zähler                 |
| Hilfetext / Fehlertext   | `Caption1`                   | Feldbeschreibungen, Validierung            |

Seitentitel, Abschnittstitel und Kartentitel werden nicht über individuelle CSS-Schriftgrößen nachgebaut. Layout-Eigenschaften wie Abstand, Trunkierung oder Farbe dürfen in der jeweiligen CSS-Klasse stehen.

---

## 4. Flächen, Farbe und Zustände

### 4.1 Semantische Rollen

| Rolle                                     | Standard-Token             |
| ----------------------------------------- | -------------------------- |
| Seitenhintergrund                         | `colorNeutralBackground1`  |
| Control-Fläche, z. B. Suche oder Select   | `colorNeutralBackground2`  |
| Inhaltliche Fläche, z. B. Card oder Panel | `colorNeutralBackground3`  |
| Standardtext                              | `colorNeutralForeground1`  |
| Sekundärtext                              | `colorNeutralForeground2`  |
| Metadaten                                 | `colorNeutralForeground3`  |
| Link                                      | `colorBrandForegroundLink` |

Diese Zuordnung wird anhand verbindlicher Light- und Dark-Referenzscreens bestätigt. Eine abweichende Komponente benennt ihre Rolle im Review, statt die Zuordnung stillschweigend zu verändern.

### 4.2 Interaktionszustände

Interaktive Elemente besitzen alle für ihren Typ relevanten Zustände: mindestens Rest, Hover, Fokus und Disabled, sofern der Zustand möglich ist. Auswahl- und Pressed-Zustände gelten zusätzlich für auswählbare beziehungsweise auslösende Elemente.

- Fokus wird mit `:focus-visible` dargestellt und nie ohne gleichwertigen Ersatz entfernt.
- Für Standard-Controls werden Fluent-Zustände bevorzugt.
- Eigene Zustände verwenden passende Background-, Stroke- und Foreground-Tokens statt zufällig ähnlich aussehender Tokens.
- Statusmeldungen verwenden die semantischen Erfolg-, Warn-, Fehler- oder Info-Tokens.
- Jede Änderung wird in Light und Dark geprüft.

---

## 5. Layout, Abstände und Bewegung

### 5.1 Abstände und Breiten

Für wiederkehrende Abstände werden Fluent-Spacing-Tokens verwendet. Als Orientierung:

| Kontext         | Token                                     |
| --------------- | ----------------------------------------- |
| Kompakte Gruppe | `spacingHorizontalS` / `spacingVerticalS` |
| Formularfelder  | `spacingVerticalM`                        |
| Untersektion    | `spacingVerticalL`                        |
| Sektion         | `spacingVerticalXXL`                      |
| Hauptbereich    | `spacingVerticalXXXL`                     |

Lesetext erhält eine begrenzte Zeilenlänge. Wiederkehrende Inhaltsbreiten werden als benannte App-Variablen gepflegt; einmalige Layoutberechnungen dürfen CSS-Funktionen wie `min()`, `max()` oder `calc()` verwenden.

### 5.2 Radien, Rahmen und Schatten

- Wiederkehrende UI-Flächen verwenden die Fluent-Radius- und Shadow-Tokens mit den MUCGPT-Theme-Werten.
- Cards und Menüs verwenden in der Regel den großen Radius, Controls den mittleren Radius, Badges den kleinen Radius.
- `border-radius: 50%` ist für tatsächlich kreisförmige Avatare und Medien erlaubt.
- Rahmen und Schatten folgen ihrer Rolle: Abgrenzung, Hover, Auswahl, Fokus oder Elevation.
- Neue handgemischte Farb-Schatten und rohe Hex-Farben werden vermieden.

### 5.3 Responsive Verhalten und Bewegung

- Komponenten sind mobile-first. Die gemeinsamen Viewport-Breakpoints sind `480px`, `768px`, `1024px` und `1440px`.
- Container Queries sind erlaubt, wenn das Verhalten von der verfügbaren Komponentenbreite und nicht vom Viewport abhängt.
- Animationen vermitteln Zustand oder räumliche Veränderung. Sie sind kurz und respektieren `prefers-reduced-motion`.
- `transition: all` wird nicht für neuen Code verwendet; animierte Eigenschaften werden benannt.

---

## 6. Icons

### 6.1 Statische Icons

`lucide-react` ist der Standard für neue und migrierte Oberflächen. Innerhalb einer migrierten Oberfläche werden keine Fluent-Icons mehr neben Lucide verwendet.

| Größe | Verwendung                    |
| ----- | ----------------------------- |
| 16 px | Metadaten, dichte Listen      |
| 20 px | Buttons und Eingabefelder     |
| 24 px | Navigation und große Aktionen |

- Icons verwenden `currentColor`; individuelle Icon-Farben brauchen eine semantische Begründung.
- Dekorative Icons erhalten `aria-hidden="true"`.
- Icon-only-Aktionen besitzen ein aussagekräftiges `aria-label`.

### 6.2 Animierte Icons

`lucide-animated` ist eine ergänzende Bibliothek für gezieltes Feedback, nicht der Standard für alle Icons.

- Geeignet: Upload-Fortschritt, erfolgreiches Kopieren/Speichern, Senden, Aufnahme und klarer Zustandswechsel.
- Ungeeignet: permanente Navigation, Tabellen, Listeneinträge und rein dekorative Metadaten.
- Animationen starten bevorzugt aufgrund einer Aktion oder eines Zustands. Reiner Hover ist nur bei einzelnen, nicht wiederholten Aktionen erlaubt.
- Bei `prefers-reduced-motion` werden sie deaktiviert oder erheblich reduziert.
- Beide Icon-Bibliotheken werden über gemeinsame `AppIcon`- und `AppAnimatedIcon`-Bausteine eingebunden, nicht direkt und uneinheitlich in Feature-Code.

---

## 7. Formulare, Ebenen und Ausnahmen

### 7.1 Formulare

Jedes Eingabefeld hat, sofern relevant, ein sichtbares Label, einen klaren Fehlerzustand und einen zugeordneten Hilfe- oder Fehlertext. `disabled` wird nur verwendet, wenn eine Eingabe wirklich nicht möglich ist; `readOnly` für weiterhin lesbare Werte. Ladezustände dürfen den Fokus nicht unerwartet verlieren.

### 7.2 Ebenen

Die vorhandene Fluent-Portal-Reihenfolge wird respektiert. Für neue Schichten gilt: Inhalt < Sticky-Elemente < Dropdown/Tooltip < Drawer < Dialog < Toast. Neue hohe `z-index`-Werte benötigen eine Begründung.

### 7.3 Pragmatische Ausnahmen

`.fui-*`-Selektoren und `!important` sind erlaubt, wenn Props, Slots und Theme-Tokens die nötige Anpassung nicht abdecken. Die Ausnahme steht direkt über der Regel und benennt Grund sowie betroffene Fluent-Version.

```css
/* fui-exception: Fluent 9.73, Header-Höhe ist weder per Prop noch per Theme-Token anpassbar. */
:global(.fui-AccordionHeader__button) {
  min-height: var(--spacingVerticalXXXL);
}
```

Ausnahmen sind lokal begrenzt. Bei Fluent-Upgrades werden sie überprüft, aber nicht pauschal als Fehler behandelt.

---

## 8. Review-Checkliste

Vor dem Merge eines UI-PRs:

- [ ] Nutzt der Code vorhandene Fluent- oder MUCGPT-Tokens, wo die Entscheidung wiederkehrend ist?
- [ ] Passt die Textrolle zu einer bestehenden Typografie-Rolle?
- [ ] Sind Fokus und relevante Interaktionszustände sichtbar und tastaturbedienbar?
- [ ] Ist die Oberfläche in Light und Dark geprüft?
- [ ] Passt sie zu den Referenzscreens oder wurde eine bewusste Abweichung dokumentiert?
- [ ] Werden Icons, Formfehler und Bewegung entsprechend diesem Standard eingesetzt?
- [ ] Ist eine Fluent-Ausnahme lokal und begründet?
