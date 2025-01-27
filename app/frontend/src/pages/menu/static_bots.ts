import { Bot } from "../../api";

const arielle_system = `

Erstelle syntaktisch korrekte Mermaid-Diagramme in Markdown für verschiedene Diagrammtypen: Flussdiagramme, Sequenzdiagramme, Klassendiagramme, User Journeys, Kuchendiagramme, Mindmaps und Gantt-Diagramme.

Bitte informiere mich zunächst über den gewünschten Diagrammtyp und die dazugehörigen Daten.

# Schritte
1. Bestimme den Diagrammtyp und die benötigten Daten.
2. Erstelle den entsprechenden Mermaid-Code.
3. Antworte ausschließlich in Markdown-Codeblöcken in der Programmiersprache mermaid.
4. Beschrifte die Knoten der Diagramme passend und verwende nur die gesammelten Daten.

# Output Format
Antworten sollten in Markdown-Codeblöcken erfolgen, formatierte Diagrammcodes in der Programmiersprache mermaid.

# Beispiele
Eine Beispielausgabe aus Schritt 3 für ein Kuchendiagramm sieht so aus :

\`\`\`mermaid
pie title Pets adopted by volunteers
    "Dogs" : 386
    "Cats" : 85
    "Rats" : 15
\`\`\`

Eine Beispielausgabe aus Schritt 3 für eine Mindmap sieht so aus:
\`\`\`mermaid
mindmap
    root((mindmap))
        Origins
            Long history
            ::icon(fa fa-book)
            Popularisation
            British popular psychology author Tony Buzan
        Research
            On effectivness<br/>and features
            On Automatic creation
            Uses
                Creative techniques
                Strategic planning
                Argument mapping
        Tools
            Pen and paper
            Mermaid
\`\`\`

Eine Beispielausgabe aus Schritt 3 für ein Sequenzdiagramm sieht so aus:
\`\`\`mermaid
sequenceDiagram
    Alice->>+John: Hello John, how are you?
    Alice->>+John: John, can you hear me?
    John-->>-Alice: Hi Alice, I can hear you!
    John-->>-Alice: I feel great!
\`\`\`

Eine Beispielausgabe aus Schritt 3 für eine Userjourney sieht so aus:
\`\`\`mermaid
journey
    title My working day
        section Go to work
            Make tea: 5: Me
            Go upstairs: 3: Me
            Do work: 1: Me, Cat
    section Go home
        Go downstairs: 5: Me
        Sit down: 3: Me
\`\`\`

Eine Beispielausgabe aus Schritt 3 für ein Gantt-diagramm sieht so aus:

\`\`\`mermaid
gantt
    title A Gantt Diagram
    dateFormat YYYY-MM-DD
    section Section
        A task              :a1, 2014-01-01, 30d
        Another task    :after a1, 20d
    section Another
        Task in Another :2014-01-12, 12d
        another task    :24d
\`\`\`

**Hinweis**: Bitte stelle sicher, dass die eingereichten Daten alle benötigten Informationen beinhalten, um ein korrektes Diagramm zu erstellen.

`;

export const arielle_bot: Bot = {
    title: "Arielle 🧜‍♀️",
    description:
        "Dieser Assistent erstellt syntaktisch korrekte Mermaid-Diagramme in Markdown für verschiedene Diagrammtypen basierend auf den bereitgestellten Daten und dem gewünschten Diagrammtyp.",
    system_message: arielle_system,
    publish: true,
    id: "0",
    temperature: 1.0,
    max_output_tokens: 4096,
    tags: ["Mermaid", "Diagramme", "Markdown"],
    version: 1.0,
    owner: "München"
};

const sherlock_system = `Du bist Sherlock
🕵, ein Testanalyst für das Erstellen von
Testfällen nach ISTQB und ISO 29119. Du hilfst dem
Nutzer dabei, formal korrekte Testfälle zu erstellen.

Formal korrekte Testfälle enthalten folgende Elemente in
genau dieser Reihenfolge:

Identifier
Ziel des Testfalls
Vorbedingungen

Testschritte, so viele wie nötig, die jeweils Eingabewerte
und dazugehörende Sollergebnisse enthalten

Formatiere die Antwort, indem jedes Element mit einem
neuen Absatz beginnt, jeder Testschritt in einer neuen
Zeile beginnt und innerhalb des Testschritts die Aktion als
auch das Sollergebnis jeweils in einer neuen Zeile beginnt.

Beispiel für einen formal korrekten Testfall:
Testfall ID: 0815
Ziel: Erfolgreicher Login
Vorbedingungen: Die URL der Webseite ist bekannt; die
Kennung und das Passwort sind bekannt
Testschritt 1
Rufe die URL im Browser auf
Sollergebnis: Die Login-Maske wird im Browser angezeigt
Testschritt 2
Gib die Kennung und das Passwort ein und drücke die
Enter-Taste
Sollergebnis: Das Login ist erfolgreich
`;

const sherlock_description = `
## 1. Einleitung

Dieses BOT bietet Ihnen Unterstützung und
Inspiration beim Review und der Erstellung von
Testfällen mit MUCGPT. Dabei orientieren wir uns an
den Teststandards des ISTQB (International
Software Testing Qualifications Board) sowie der
ISO-Norm 29119. Die dargestellten Beispiele sind
Vorschläge, die je nach Bedarf angepasst werden
sollten. Sie dienen lediglich als Anregung

## 2. Kontakt

Bei Fragen zur Testfallerstellung mit MUCGPT
itm.km73-crowd@muenchen.de

## 3. Erstellung eines Testfalls

Wenn Anwendung bei MUCGPT bekannt ist:

**Prompt**:

\`\`\`prompt
Erstelle einen Testfall für die Anwendung <Name Anwendung>
\`\`\`

## 4. Review von Testfällen

Geben Sie folgenden Prompt ein:

\`\`\`prompt
Verbessere den folgenden Testfall und beschreibe die
Änderungen
\`\`\`

Kopieren Sie dann den Testfall in den Prompt. Im
Anschluss erfolgt die Ausgabe einer verbesserten
Version sowie einer Beschreibung der Änderungen
und Verbesserungen.

## 5. Beispiel für Prompts

Im folgenden Abschnitt finden Sie Beispiele für
Prompts zu verschiedenen Themen. Sie geben
Ihnen wertvolle Anregungen und Ideen für die
Entwicklung Ihrer eigenen Testfälle

### Testfall für Anforderung/UserStory

Hier muss zunächst die Anforderung bzw.
UserStory in den prompt kopiert werden. Dann
folgenden Prompt ausführen:

\`\`\`prompt
Erstelle einen Testfall für die UserStory
\`\`\`

### Funktionale Tests erstellen

\`\`\`prompt
Erstelle einen funktionalen Testfall für die <Anwendung>
mit Fokus auf <Funktion>
\`\`\`

### Nicht-funktionale Testszenarien erstellen

\`\`\`prompt
Nenne 3 Lasttestszenarien für die <Anwendung> während
einer <Anmeldephase>
\`\`\`

### Grenzwerttests / Randbedingungen

\`\`\`prompt
Erstelle 5 Testfälle für einen <Antragsprozess>, der ein
Zahlenfeld (0-100) zulässt. Berücksichtige Grenzwerte am
unteren, oberen und mittleren Rand
\`\`\`

### Tests von API Endpunkten

\`\`\`prompt
Erstelle 5 Testfälle für eine REST-API, die einen GET-
Endpunkt /user liefert. Berücksichtige ungültige IDs,
fehlende Parameter und Zeitüberschreitungen
\`\`\`

### Geräte/Browsertests

\`\`\`prompt
Erstelle 5 Testfälle, um das Verhalten einer Webanwendung
auf verschiedenen Browsern (Chrome, Firefox, Safari) und
Bildschirmgrößen zu prüfen.
\`\`\`

### Negative Tests für Formulareingaben

\`\`\`prompt
Erstelle 5 Testfälle für ein Registrierungsformular, die
sicherstellen, dass ungültige Eingaben (z.B. leere Felder,
falsches Datumsformat, zu kurze Passwörter) korrekt
abgefangen werden.
\`\`\`

### Fehlerbasierte Tests (Error Guessing)

\`\`\`prompt
Nenne 5 potenzielle Fehler oder Schwachstellen, die in
<Anwendung> auftreten könnten und erstelle dazu
entsprechende Testfälle
\`\`\`

### Testfälle für Netzwerktests

\`\`\`prompt
Erstelle 5 Testfälle, um die Robustheit einer Client-Server-
Kommunikation über TCP/HTTPS zu prüfen. Berücksichtige
dabei Timeouts, Paketverluste, Protokollfehler und
unterbrochene Verbindungen
\`\`\`

### Testfälle zur Beantragung von Dokumenten

\`\`\`prompt
Erstelle 5 fachliche Testfälle für die Online-Beantragung
eines neuen Personalausweises oder Reisepasses über das
Serviceportal der Landeshauptstadt München.
Berücksichtige dabei Anforderungen wie elektronische
Terminvereinbarung, Nachweis der Meldeadresse in
München, Expressbearbeitung gegen zusätzliche Gebühr
und die Nutzung von M-Login für Authentifizierung
\`\`\`

### Testfälle für Melderegisteraktualisierung

\`\`\`prompt
Erstelle 5 fachliche Testfälle für die Änderung von
Meldedaten (z. B. Umzug, Namensänderung) in einem
Einwohnermeldeamts-System. Beachte dabei Fachregeln
wie Fristen für die Ummeldung, erforderliche Dokumente,
automatische Information an andere Behörden und
Prüfung auf Doppelanmeldungen
\`\`\`

### Testfälle Sozialleistungen
\`\`\`prompt
Erstelle 5 fachliche Testfälle für die Bearbeitung von
Wohngeld- oder Sozialhilfeanträgen. Achte dabei auf
Einkommensgrenzen, Nachweise von Mietkosten,
Haushaltsgröße, Bearbeitungsfristen, Nachberechnung bei
Änderungen und automatisierte Bescheiderstellung.
\`\`\`

### Testfälle KFZ Zulassung

\`\`\`prompt
Erstelle 5 fachliche Testfälle, um die Zulassung eines
Fahrzeugs in einem System des Straßenverkehrsamts zu
prüfen. Berücksichtige TÜV-Prüfungen,
Versicherungsnachweise, Gebührenberechnungen,
Sondergenehmigungen sowie Kontrollmechanismen bei
wiederholten Prüfungsversuchen
\`\`\`

### Testfälle Vergabe Kitaplätze

\`\`\`prompt
Erstelle 5 fachliche Testfälle für die Zuweisung von
Kitaplätzen in München über das Kita-Finder+ Portal.
Berücksichtige dabei Prioritäten (Wohnortnähe,
Geschwisterkinder), Altersgruppen, verfügbare
Einrichtungen in bestimmten Stadtbezirken,
Wartelistenlogik und automatische Benachrichtigung der
Eltern
\`\`\`

### Testfälle kommunale Abgaben

\`\`\`prompt
Erstelle 5 fachliche Testfälle, um die Berechnung von
Grundsteuer, Hundesteuer oder Müllgebühren in einem
kommunalen Finanzsystem zu validieren. Berücksichtige
Staffelungen, Nachlässe für bestimmte Personengruppen,
Sonderregelungen bei Eigentümerwechseln und Abgleich
mit dem Melderegister
\`\`\`

### Testfälle Beschwerdemanagement

\`\`\`prompt
Erstelle 5 fachliche Testfälle, um die Bearbeitung von
Bürgerbeschwerden in einem Ombudsstellen-Portal zu
prüfen. Berücksichtige Kategorien von Beschwerden
(Baulärm, Umweltverschmutzung), Eskalationsstufen,
Fristen für Stellungnahmen, automatische Zuordnung an
Fachbereiche und Generierung von Statusberichten.
\`\`\`

### Testfälle Gewerbeanmeldung

\`\`\`prompt
Erstelle 5 fachliche Testfälle, um den Prozess der
Gewerbeanmeldung bei der Landeshauptstadt München zu
prüfen. Teste verschiedene Gewerbearten (Einzelhandel,
Gastronomie), die elektronische Einreichung notwendiger
Unterlagen, Abstimmung mit dem KVR (für
Gaststättenerlaubnisse), Integrationsprüfung mit Online-
Bezahlmöglichkeiten für Verwaltungsgebühren sowie
automatische Erinnerungen bei fehlenden Dokumenten
\`\`\`

### Testfälle Führerschein

\`\`\`prompt
Erstelle 5 fachliche Testfälle für die Verlängerung eines
Führerscheins in einem System des Straßenverkehrsamts zu
prüfen. Berücksichtige TÜV-Prüfungen,
Versicherungsnachweise, Gebührenberechnungen
\`\`\`

#### Testfälle Ratsinformationssystem

\`\`\`prompt
Erstelle 5 fachliche Testfälle für die Prüfung der Such- und
Anzeigefunktionen im Ratsinformationssystem der
Landeshauptstadt München. Teste die Suche nach
bestimmten Stadtratsbeschlüssen, Sitzungsprotokollen, die
Filterung nach Referaten, Volltextsuche in PDF-
Dokumenten und Zugriffsberechtigungen für
interne/nicht-öffentliche Dokumente
\`\`\`

### Testfälle Umwelt- und Abfallmanagement

\`\`\`prompt
Erstelle 5 fachliche Testfälle, um die Online-Dienste des
AWM zu prüfen. Teste dabei die Beantragung von
Sperrmüllabholungen, die Anmeldung oder Änderung von
Restmüll- und Biomülltonnen, die Integration von
Gebührenrechnern, Terminbestätigungen sowie
Information über die nächstgelegenen Wertstoffhöfe im
Stadtgebiet
\`\`\`

### Testfälle Wohnsitzänderungen

\`\`\`prompt
Erstelle 5 Testfälle zur Aktualisierung von Meldedaten für
Personen, die innerhalb Münchens umziehen, erstmals
nach München ziehen oder ihre Wohnung im Stadtgebiet
wechseln. Berücksichtige dabei Fristen, Online-
Voranmeldung, Prüfung auf Doppelmeldungen, und
automatische Information anderer städtischer
Fachbereiche
\`\`\`

### Testfälle Baugenehmigungsverfahren

\`\`\`prompt
Erstelle 5 fachliche Testfälle für die Bearbeitung eines
Baugenehmigungsantrags beim Baureferat München.
Teste dabei unterschiedliche Gebäudetypen (Wohnhaus,
Gewerbebau), Berücksichtigung des Münchner
Bebauungsplans, Einbindung von Nachbaranfragen,
Einholung von Stellungnahmen weiterer Referate (z. B.
Denkmalschutz) und Gebührenberechnung
\`\`\`

### Testfälle Anmeldung Bildungsangebote

\`\`\`prompt
Erstelle 5 fachliche Testfälle, um die Anmeldung für Kurse
der Münchner Volkshochschule oder städtische
Kulturveranstaltungen online zu validieren. Berücksichtige
dabei Frühbucherrabatte, Kontingentgrenzen bei
begrenzten Plätzen, Ermäßigungen für bestimmte
Personengruppen (z. B. Studenten, Senioren),
Stornierungsregeln und mehrsprachige
Buchungsoberflächen.
\`\`\`

### Testfälle Wohnberechtigungsschein

\`\`\`prompt
Erstelle 5 fachliche Testfälle zur Prüfung des Prozesses für
einen Wohnberechtigungsschein in München.
Berücksichtige dabei Einkommensgrenzen,
Haushaltsgröße, Nachweise über Mietkosten, das
Zusammenspiel mit der städtischen Wohnungsvermittlung
und die automatische Ableitung von Förderberechtigungen
\`\`\`
`;

export const sherlock_bot: Bot = {
    title: "Sherlock🕵",
    description: sherlock_description,
    system_message: sherlock_system,
    publish: true,
    id: "1",
    temperature: 0.1,
    max_output_tokens: 4096,
    tags: ["ISTQB", "ISO 29119"],
    version: 1.0,
    owner: "München"
};
