# Typografie-Rollen-Mapping

**Status:** Arbeitsdokument für PR 4 des [UI-Migrationsplans](./UI_MIGRATION_PLAN.md).
**Zweck:** Die im Bestand vorhandenen Roh-Schriftgrößen auf die Textrollen aus [UI_STANDARD.md](./UI_STANDARD.md) Abschnitt 3.2 abbilden, damit die Migration nicht pro Datei neu entschieden wird.

Dieses Dokument wird nach Abschluss der Typografie-Wellen archiviert. Verbindlich bleibt der Standard.

---

## 1. Ausgangslage

Erhebung über `mucgpt-frontend/src`, alle `*.css`:

| Kennzahl                              | Wert |
| ------------------------------------- | ---- |
| `font-size`-Deklarationen gesamt       | 236  |
| davon Rohwerte                         | 173  |
| davon bereits Token                    | 63   |
| distinkte Rohwerte                     | 39   |
| `font-weight`-Deklarationen            | 133  |
| `line-height`-Deklarationen            | 103  |
| Fluent-Typografie-Komponenten im Code  | 5    |
| generisches `<Text>` ohne Rolle        | 129  |

Der Kern des Problems ist nicht die Rohzahl, sondern die fehlende Semantik: Die Rollen aus 3.2 sind faktisch nicht im Einsatz.

---

## 2. Die Fluent-Skala als Zielraster

Werte aus `@fluentui/tokens` (`global/fonts.js`, `global/typographyStyles.js`), also nicht geraten sondern aus der installierten Version gelesen.

| Rolle       | fontSize            | px | fontWeight | lineHeight            | px |
| ----------- | ------------------- | -- | ---------- | --------------------- | -- |
| `Caption2`  | `fontSizeBase100`   | 10 | Regular    | `lineHeightBase100`   | 14 |
| `Caption1`  | `fontSizeBase200`   | 12 | Regular    | `lineHeightBase200`   | 16 |
| `Body1`     | `fontSizeBase300`   | 14 | Regular    | `lineHeightBase300`   | 20 |
| `Body2`     | `fontSizeBase400`   | 16 | Regular    | `lineHeightBase400`   | 22 |
| `Subtitle2` | `fontSizeBase400`   | 16 | Semibold   | `lineHeightBase400`   | 22 |
| `Subtitle1` | `fontSizeBase500`   | 20 | Semibold   | `lineHeightBase500`   | 28 |
| `Title3`    | `fontSizeBase600`   | 24 | Semibold   | `lineHeightBase600`   | 32 |
| `Title2`    | `fontSizeHero700`   | 28 | Semibold   | `lineHeightHero700`   | 36 |
| `Title1`    | `fontSizeHero800`   | 32 | Semibold   | `lineHeightHero800`   | 40 |
| `LargeTitle`| `fontSizeHero900`   | 40 | Semibold   | `lineHeightHero900`   | 52 |

Die Skala deckt die vier häufigsten Rohwerte (12, 14, 20, 16 px = 90 Vorkommen) exakt ab. Es besteht kein Bedarf, eigene MUCGPT-Schriftgrößen-Tokens zu ergänzen.

---

## 3. Mapping der Rohwerte

### 3.1 Exakte Treffer

Diese Werte entsprechen der Fluent-Skala ohne Abweichung. Migration ist verlustfrei.

| Rohwert | Vork. | Zielrolle                        | Anmerkung                                              |
| ------- | ----- | -------------------------------- | ------------------------------------------------------ |
| `12px`  | 33    | `Caption1`                       | Metadaten, Badges, Zähler                              |
| `14px`  | 27    | `Body1`                          | Standard-UI-Text                                       |
| `20px`  | 15    | `Subtitle1`                      | Nur bei Text. Bei Icon-Größe siehe 3.4                 |
| `16px`  | 15    | `Body2` oder `Subtitle2`         | Nach `font-weight` entscheiden: Regular / Semibold      |
| `24px`  | 12    | `Title3`                         | Nur bei Text. Bei Icon-Größe siehe 3.4                 |
| `10px`  | 4     | `Caption2`                       | Prüfen, ob nicht `Caption1` lesbarer ist               |

Zusammen 106 der 173 Rohwerte.

### 3.2 Nächstgelegene Rolle (bewusste Angleichung)

Diese Werte liegen zwischen zwei Stufen. Die Migration verändert die Optik geringfügig; das ist beabsichtigt und pro Oberfläche im Review abzunehmen.

| Rohwert     | Vork. | Zielrolle              | Delta   | Begründung                                     |
| ----------- | ----- | ---------------------- | ------- | ---------------------------------------------- |
| `18px`      | 13    | `Subtitle1` (20px)     | +2px    | Fast immer Abschnittstitel; Semibold passt      |
| `13px`      | 6     | `Body1` (14px)         | +1px    | Sekundärtext, kein eigener Rang                 |
| `11px`      | 4     | `Caption1` (12px)      | +1px    | Verbessert Lesbarkeit                           |
| `0.875rem`  | 3     | `Body1` (14px)         | 0       | Identisch bei 16px Root                         |
| `0.75rem`   | 3     | `Caption1` (12px)      | 0       | Identisch bei 16px Root                         |
| `0.8125rem` | 3     | `Body1` (14px)         | +1px    | 13px in rem                                     |
| `22px`      | 2     | `Title3` (24px)        | +2px    | —                                               |
| `15px`      | 2     | `Body2` (16px)         | +1px    | —                                               |
| `21px`      | 1     | `Subtitle1` (20px)     | −1px    | —                                               |
| `28px`      | 1     | `Title2` (28px)        | 0       | Exakt                                           |
| `30px`      | 1     | `Title2` (28px)        | −2px    | `!important`, siehe Discovery                   |
| `1.75rem`   | 3     | `Title2` (28px)        | 0       | Identisch bei 16px Root                         |
| `1.25rem`   | 1     | `Subtitle1` (20px)     | 0       | Identisch                                       |
| `1.5rem`    | 1     | `Title3` (24px)        | 0       | Identisch                                       |
| `2rem`      | 1     | `Title1` (32px)        | 0       | Identisch                                       |
| `1.1rem`    | 1     | `Body2` (16px)         | −1.6px  | —                                               |
| `1.3rem`    | 1     | `Subtitle1` (20px)     | −0.8px  | —                                               |
| `1.2rem`    | 2     | `Subtitle1` (20px)     | +0.8px  | —                                               |
| `0.7rem`    | 1     | `Caption1` (12px)      | +0.8px  | —                                               |
| `0.65rem`   | 1     | `Caption2` (10px)      | +0.4px  | —                                               |
| `9px`       | 1     | `Caption2` (10px)      | +1px    | Unter 10px wird nicht neu vergeben              |
| `8px`       | 1     | `Caption2` (10px)      | +2px    | Vermutlich Icon/Dekoration, im Einzelfall prüfen |

### 3.3 Einzelfallentscheidung

Nicht schematisch migrieren. Diese Werte sind bewusst groß oder an Fremdkomponenten gebunden.

| Rohwert            | Ort                | Vorgehen                                                      |
| ------------------ | ------------------ | ------------------------------------------------------------- |
| `4rem`, `48px`     | Tutorials, Layout  | Dekorative Großgrafik. `LargeTitle`/`Display` oder bewusst roh |
| `40px`, `3rem`     | Tutorials          | Als `LargeTitle` (40px) prüfen                                 |
| `2.2em`, `1.3em`   | Tutorials          | `em` ist elternrelativ. Erst Kontext klären, dann mappen       |
| `1.1em`, `0.98em`  | Tutorials          | dito                                                           |
| `1em`, `inherit`   | diverse            | Bewusste Vererbung. Meist korrekt, unverändert lassen          |

Alle `em`-Werte liegen in den Tutorials und werden mit dieser Welle **nicht** angefasst.

### 3.4 Abgrenzung: keine Typografie

`font-size` auf einem Icon-Container steuert die Icon-Größe, nicht Text. Diese Vorkommen gehören **nicht** in dieses Mapping, sondern in die Icon-Welle (PR 2/3) und sind dort über die `AppIcon`-Größen 16/20/24 zu lösen.

Erkennungsmerkmal: Die Regel steht auf einem Element, das ausschließlich ein Icon enthält, häufig mit `display: inline-flex` und fester `width`/`height`.

Bekanntes Beispiel: `Discovery.module.css` → `.emptyIcon` (`font-size: 20px` bei `36px` Box).

---

## 4. font-family

Nur 6 echte Abweichungen, davon 1 korrekt.

| Ort                                          | Ist                                    | Soll                       |
| -------------------------------------------- | -------------------------------------- | -------------------------- |
| `AppSidebar.module.css:194`                  | `"Montserrat", "Segoe UI", sans-serif` | korrekt (Wortmarke, 3.1)   |
| `BrainstormFragment.module.css:85`           | `"Consolas", "Monaco", …`              | `var(--fontFamilyMonospace)` |
| `AIBasicsTutorial.module.css` 159/383/584/675 | `monospace`                            | `var(--fontFamilyMonospace)` |

`inherit` an 4 Stellen (`AssistantDetailsSidebar`, `ChatLayout`, `WikiTutorial` ×2) ist zulässig: Fremd- bzw. Formularelemente sollen die Basisschrift erben.

---

## 5. Migrationsregeln

1. **Komponente vor Token.** Erste Wahl ist die Fluent-Typografie-Komponente. `font-size: var(--fontSizeBase500)` in CSS ist weiterhin ein Nachbau und nur die zweite Wahl.
2. **Token nur in den Ausnahmen aus 3.1 des Standards** — Markdown, Textareas, Fremdkomponenten.
3. **Rolle ersetzt drei Deklarationen.** Mit der Komponente entfallen `font-size`, `font-weight` und `line-height` gemeinsam. Einzelne stehen zu lassen hebt die Rolle wieder auf.
4. **Kein `!important` auf Fluent-Typografie.** Wer eine Rolle überschreiben muss, hat die falsche Rolle gewählt.
5. **In der CSS-Klasse bleiben** Farbe, Abstand, Trunkierung, `max-width` (Standard 3.2).
6. **`<Text size={…}>` zählt als Rohwert.** Die numerischen `size`-Props sind ebenfalls Nachbauten und werden durch Rollen ersetzt.
7. **Semantik prüfen.** `<h2 className={styles.sectionTitle}>` wird zu `<Title3 as="h2">`; die Überschriftenebene bleibt erhalten.

---

## 6. Reihenfolge

| Welle | Bereich                          | Rohwerte | Status  |
| ----- | -------------------------------- | -------- | ------- |
| 1     | Discovery (Seite + `DiscoveryCard`) | 8     | erledigt |
| 2     | Home + `PageHeader`-Baustein     | 10       | offen   |
| 3     | Assistant-Dialoge / Editor       | ~25      | offen   |
| 4     | Sidebars (App, AssistantDetails) | ~21      | offen   |
| 5     | Chat und Fragments               | ~21      | offen   |
| 6     | Tutorials                        | ~58      | offen   |

Eine Welle umfasst die Seite **und** die Komponenten, die sie rendert. Eine migrierte Seite mit CSS-simulierter Typografie in ihren Karten ist nicht migriert.

Nicht Teil der Typografie-Wellen: `font-size` auf Fluent-Control-Interna (Badge, Dropdown-Option, Button-Label). Diese gehören zu PR 5/6.

Tutorials bewusst zuletzt: hohe Dichte, eigene Textästhetik, kein wiederverwendbares Muster für die übrigen Oberflächen.
