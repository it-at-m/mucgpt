// mocks/handlers.js
import { http, HttpResponse, delay } from "msw";
import { ApplicationConfig } from "../api";

const CONFIG_RESPONSE: ApplicationConfig = {
    models: [
        {
            llm_name: "KICCGPT",
            max_input_tokens: 128000,
            max_output_tokens: 128000,
            description: "GPT build by KICC"
        },
        {
            llm_name: "UnknownGPT",
            max_input_tokens: 128000,
            max_output_tokens: 128000,
            description: "A young model that has to earn it's name, but with a lot of potential."
        }
    ],
    frontend: {
        labels: {
            env_name: "MUCGPT DEMO. Find out more about us https://ki.muenchen.de/ "
        },
        alternative_logo: false,
        enable_simply: true,
        community_assistants: [
            {
                title: "Arielle 🧜 Diagrammkünstlerin",
                description:
                    "Dieser Assistent erstellt syntaktisch korrekte Mermaid-Diagramme in Markdown für verschiedene Diagrammtypen basierend auf den bereitgestellten Daten und dem gewünschten Diagrammtyp.",
                system_message:
                    "\"Erstelle syntaktisch korrekte Mermaid-Diagramme in Markdown für verschiedene Diagrammtypen: Flussdiagramme, Sequenzdiagramme, Klassendiagramme, User Journeys, Kuchendiagramme, Mindmaps und Gantt-Diagramme.\\n\\nBitte informiere mich zunächst über den gewünschten Diagrammtyp und die dazugehörigen Daten.\\n\\n# Schritte\\n1. Bestimme den Diagrammtyp und die benötigten Daten.\\n2. Erstelle den entsprechenden Mermaid-Code.\\n3. Antworte ausschließlich in Markdown-Codeblöcken in der Programmiersprache mermaid.\\n4. Beschrifte die Knoten der Diagramme passend und verwende nur die gesammelten Daten.\\n\\n# Output Format\\nAntworten sollten in Markdown-Codeblöcken erfolgen, formatierte Diagrammcodes in der Programmiersprache mermaid.\\n\\n# Beispiele\\nEine Beispielausgabe aus Schritt 3 für ein Kuchendiagramm sieht so aus :\\n\\n```mermaid\\npie title Pets adopted by volunteers\\n    'Dogs' : 386\\n    'Cats' : 85\\n    'Rats' : 15\\n```\\n\\nEine Beispielausgabe aus Schritt 3 für eine Mindmap sieht so aus:\\n```mermaid\\nmindmap\\n    root((mindmap))\\n        Origins\\n            Long history\\n            ::icon(fa fa-book)\\n            Popularisation\\n            British popular psychology author Tony Buzan\\n        Research\\n            On effectivness<br/>and features\\n            On Automatic creation\\n            Uses\\n                Creative techniques\\n                Strategic planning\\n                Argument mapping\\n        Tools\\n            Pen and paper\\n            Mermaid\\n```\\n\\nEine Beispielausgabe aus Schritt 3 für ein Sequenzdiagramm sieht so aus:\\n```mermaid\\nsequenceDiagram\\n    Alice->>+John: Hello John, how are you?\\n    Alice->>+John: John, can you hear me?\\n    John-->>-Alice: Hi Alice, I can hear you!\\n    John-->>-Alice: I feel great!\\n```\\n\\nEine Beispielausgabe aus Schritt 3 für eine Userjourney sieht so aus:\\n```mermaid\\njourney\\n    title My working day\\n        section Go to work\\n            Make tea: 5: Me\\n            Go upstairs: 3: Me\\n            Do work: 1: Me, Cat\\n    section Go home\\n        Go downstairs: 5: Me\\n        Sit down: 3: Me\\n```\\n\\nEine Beispielausgabe aus Schritt 3 für ein Gantt-diagramm sieht so aus:\\n\\n```mermaid\\ngantt\\n    title A Gantt Diagram\\n    dateFormat YYYY-MM-DD\\n    section Section\\n        A task              :a1, 2014-01-01, 30d\\n        Another task    :after a1, 20d\\n    section Another\\n        Task in Another :2014-01-12, 12d\\n        another task    :24d\\n```\\n\\n**Hinweis**: Bitte stelle sicher, dass die eingereichten Daten alle benötigten Informationen beinhalten, um ein korrektes Diagramm zu erstellen.\"",
                publish: true,
                id: "0",
                temperature: 1,
                max_output_tokens: 4096,
                examples: [
                    {
                        text: "Flussdiagramm zum Thema Aufgabenverwaltung im Team",
                        value: "\"Erstelle einen detailliertes Flussdiagramm, das den Prozess der Aufgabenverwaltung in einem Team darstellt. Die Schritte sollen Folgendes beinhalten: \\'Aufgabe erstellen\\', \\'Aufgabe zuweisen\\', \\'Aufgabe bearbeiten\\', \\'Aufgabe abschließen\\' und \\'Aufgabe überprüfen\\'. Füge außerdem eine Entscheidungsschleife hinzu, die fragt: \\'Wurde die Aufgabe korrekt bearbeitet?\\' mit den Ausgängen \\'Ja\\' und \\'Nein\\', um anzugeben, ob die Aufgabe erneut bearbeitet werden muss. Verwende dabei unterschiedliche Farben für die Kästchen der verschiedenen Schritte\"",
                        system: ""
                    },
                    {
                        text: "User Journey zum Thema Online Einkauf",
                        value: '"Erstelle mir eine UserJourney zum Thema Thema Online Einkauf: 1. Bewusstsein (Awareness) Aktionen: Der Nutzer sieht eine Anzeige auf sozialen Medien oder in Suchmaschinen. Emotionen: Neugier, Interesse. Berührungspunkt: Anzeige, Website des Unternehmens. 2. Erwägung (Consideration) Aktionen: Der Nutzer besucht die Website, um Produkte zu durchsuchen. Emotionen: Aufregung, Unsicherheit (z.B. die Frage, welches Produkt am besten geeignet ist). Berührungspunkt: Produktkategorien, Suchfunktion. 3. Vergleich (Comparison) Aktionen: Der Nutzer vergleicht verschiedene Produkte, liest Bewertungen und prüft Preise. Emotionen: Zweifel (Zufriedenheit/Unzufriedenheit mit den Informationen). Berührungspunkt: Produktdetailseiten, Kundenrezensionen. 4. Entscheidung (Decision) Aktionen: Der Nutzer fügt ein Produkt zum Warenkorb hinzu und geht zur Kasse. Emotionen: Vorfreude, Nervosität (wegen der Eingabe von Zahlungsinformationen). Berührungspunkt: Warenkorb, Checkout-Seite. 5. Kauf (Purchase) Aktionen: Der Nutzer schließt den Kauf ab, gibt Zahlungsinformationen ein und erhält eine Bestätigung. Emotionen: Erleichterung, Zufriedenheit. Berührungspunkt: Bestätigungsseite, E-Mail-Bestätigung. 6. Nutzung (Usage) Aktionen: Der Nutzer erhält das Produkt und beginnt, es zu verwenden. Emotionen: Begeisterung oder Enttäuschung (je nach Produktqualität). Berührungspunkt: Produktverpackung, Bedienungsanleitung. 7. Rückmeldungen und Empfehlungen (Feedback & Advocacy) Aktionen: Der Nutzer gibt eine Bewertung ab oder empfiehlt das Produkt weiter. Emotionen: Loyalität oder Frustration (abhängig von der Erfahrung). Berührungspunkt: E-Mails zur Feedbackanfrage, Bewertungsplattformen."',
                        system: ""
                    }
                ],
                quick_prompts: [
                    {
                        label: "🌊 Flussdiagramm",
                        prompt: "Erstelle ein Flussdiagramm. Verwende dabei unterschiedliche Farben für die Kästchen der verschiedenen Schritte. Frage alle relevanten Informationoen ab, um ein möglichst detailiertes Flussdiagramm zu erstellen.",
                        tooltip: "Hilft bei der Erstellung eines Flussdiagramms."
                    },
                    {
                        label: "🥧 Kuchendiagramm",
                        prompt: "Erstelle ein Kuchendiagramm. Frage alle relevanten Informationen ab, um ein möglichst detailiertes Kuchendiagramm zu erstellen.",
                        tooltip: "Hilft der Erstellung eines Kuchendiagramms."
                    },
                    {
                        label: "🥧 Sequenzdiagramm",
                        prompt: "Erstelle ein Sequenzdiagramm. Frage alle relevanten Informationen ab, um ein möglichst detailiertes Sequenzdiagramm zu erstellen.",
                        tooltip: "Hilf  bei der Erstellung eines Sequenzdiagramm."
                    },
                    {
                        label: "👤 User Journey",
                        prompt: "Erstelle eine UserJourney. Frage alle relevanten Informationen ab, um ein möglichst detailierte UserJourney zu erstellen.",
                        tooltip: "Hilf  bei der Erstellung eines Sequenzdiagramm."
                    },
                    {
                        label: "❓ Hilfe",
                        prompt: "Welche Arten von Diagrammen kannst du erstellen und kannst du mir Beispiele geben?",
                        tooltip: "Erhalte Hilfe bei der Kommunikation mit Arielle"
                    }
                ]
            }
        ]
    },
    version: "FRONTEND DEMO 1.0.0",
    commit: "152b175"
};

const SUM_RESPONSE = {
    answer: [
        "Eine Umfrage von YouGov zeigt, dass 57 % der Deutschen ein Tempolimit von 130 km/h unterstützen. Zu den Befürwortern gehört unter anderem der bekannte Formel-1-Fahrer Sebastian Vettel. Auf der anderen Seite steht der Verkehrsminister Volker Wissing von der FDP, der gegen Tempolimits ist, da er das Fahren als eine Form der Freiheit betrachtet. Die unbeschränkten Geschwindigkeiten auf den Autobahnen in Deutschland gehen auf eine Deregulierung aus dem Jahr 1953 unter Kanzler Konrad Adenauer zurück, die das Mythos der Autobahn geprägt hat.\n\nHistorisch gesehen haben der ADAC und die Automobilindustrie, einschließlich Daimler, sich gegen Tempolimits gewehrt. Dennoch haben steigende Verkehrstoten dazu geführt, dass in städtischen Gebieten ein Tempolimit von 50 km/h eingeführt wurde. In diesem Zusammenhang wird die laufende Debatte über Tempolimits in Deutschland beleuchtet, insbesondere im Hinblick auf die Verkehrstoten und das frühere Tempolimit von 100 km/h. Die Kampagne des ADAC für unbeschränktes Fahren verdeutlicht den Konflikt zwischen Freiheit und Sicherheit.\n\nEine aktuelle Studie legt nahe, dass ein Tempolimit von 120 km/h die Emissionen jährlich um 4,2 % senken könnte. Zudem zeigen Daten, dass Abschnitte mit Tempolimit eine niedrigere Todesfallrate pro einer Milliarde gefahrenen Kilometern aufweisen. In diesem Artikel wird die deutsche Vorliebe für schnelles Fahren untersucht, die oft mit dem Konzept der Freiheit in Verbindung gebracht wird. Eine Studie aus dem Jahr 2021 zeigt, dass 77 % der Fahrer auf Autobahnabschnitten ohne Tempolimit unter 130 km/h fahren, während 12 % zwischen 130 und 140 km/h und nur 2 % über 160 km/h fahren.\n\nVerkehrspsychologen weisen darauf hin, dass das kollektive Bewusstsein dieses Verhalten beeinflusst. Während die Mehrheit des ADAC ein Tempolimit befürwortet, stehen die Automobilindustrie und die FDP dem entgegen.",
        "Eine Umfrage von YouGov zeigt, dass 57 % der Deutschen ein Tempolimit von 130 km/h unterstützen. Zu den Befürwortern gehört unter anderem Sebastian Vettel. Auf der anderen Seite steht Volker Wissing, der Verkehrsminister von der FDP, der Tempolimits ablehnt, da er das Fahren als eine Form der Freiheit betrachtet. Die unbeschränkten Geschwindigkeiten auf den Autobahnen in Deutschland gehen auf eine Deregulierung aus dem Jahr 1953 unter Kanzler Konrad Adenauer zurück, die das Mythos der Autobahn gefördert hat. Historisch gesehen haben der ADAC und die Automobilindustrie, einschließlich Daimler, sich gegen Tempolimits gewehrt. Dennoch führten steigende Verkehrstoten zu einem Tempolimit von 50 km/h in städtischen Gebieten.\n\nIn diesem Zusammenhang wird die laufende Debatte über Tempolimits in Deutschland angesprochen, insbesondere im Hinblick auf die Verkehrstoten und das historische Tempolimit von 100 km/h. Die Kampagne des ADAC für unbeschränktes Fahren verdeutlicht die Spannungen zwischen Freiheit und Sicherheit. Eine aktuelle Studie legt nahe, dass ein Tempolimit von 120 km/h die Emissionen jährlich um 4,2 % senken könnte. Zudem zeigen Daten, dass Abschnitte mit Tempolimit eine niedrigere Sterberate pro einer Milliarde gefahrenen Kilometern aufweisen.\n\nDieser Artikel untersucht die deutsche Vorliebe für schnelles Fahren und führt sie auf das Konzept der Freiheit zurück. Eine Studie aus dem Jahr 2021 zeigt, dass 77 % der Fahrer auf Autobahnabschnitten ohne Tempolimit unter 130 km/h fahren, während 12 % zwischen 130 und 140 km/h und nur 2 % über 160 km/h fahren. Verkehrpsychologen vermuten, dass die kollektive Psyche dieses Verhalten beeinflusst. Während die Mehrheit des ADAC ein Tempolimit unterstützt, sind die Automobilindustrie und die FDP dagegen."
    ]
};

const BRAINSTORM_RESPONSE = {
    answer: "markdown\n# **Warum sollte ich in München Wohnen?**\n\n## Lebensqualität\n\n### Hohe Lebensstandards\n\n- Vielseitige Freizeitmöglichkeiten\n  - Parks und Erholungsgebiete\n  - Museen und kulturelle Veranstaltungen\n  - Sporteinrichtungen\n- Gute Luftqualität\n  - Wenig industrielle Verschmutzung\n  - Viele Grünflächen\n- Sichere Umgebung\n  - Niedrige Kriminalitätsrate\n  - Freundliche Nachbarschaften\n\n### Gesundheitsversorgung\n\n- Exzellente Krankenhäuser\n- Zugang zu spezialisierten Ärzten\n- Gesundheitsfördernde Initiativen\n  - Sport- und Fitnessprogramme\n  - Präventionskurse\n\n## Bildung und Karriere\n\n### Bildungseinrichtungen\n\n- Renommierte Schulen\n  - Internationale Schulen\n  - Förderprogramme für Talente\n- Universitäten und Fachhochschulen\n  - Technische Universität München\n  - Ludwig-Maximilians-Universität\n  - Hochschule München\n\n### Karrieremöglichkeiten\n\n- Starke Wirtschaft\n  - Ansässige internationale Firmen\n  - Vielfältige Branchen vertreten\n- Networking-Möglichkeiten\n  - Messen und Konferenzen\n  - Innovationszentren und Start-up-Szene\n- Unterstützung für Existenzgründer\n  - Förderprogramme\n  - Coworking-Spaces\n\n## Kultur und Freizeit\n\n### Kulturelle Veranstaltungen\n\n- Jährliche Feste\n  - Oktoberfest\n  - Christkindlmarkt\n- Theater und Oper\n  - Bayerische Staatsoper\n  - Verschiedene Stadt- und Privattheater\n\n### Sport und Outdoor-Aktivitäten\n\n- Sportvereine\n  - Fußball\n  - Basketball\n  - Eishockey\n- Naturerlebnisse\n  - Wanderungen in den Alpen\n  - Radwege entlang der Isar\n\n## Infrastruktur und Verkehr\n\n### Öffentliches Verkehrsnetz\n\n- Effektives U-Bahn-System\n- Straßenbahn- und Busverbindungen\n- Fahrradfreundliche Stadt\n\n### Anbindung und Erreichbarkeit\n\n- Internationale Flughäfen\n- Autobahnverbindungen\n- Nähe zu anderen europäischen Städten\n"
};

const SIMPLY_RESPONSE = {
    content:
        "Jedes Kind hat einen Anspruch.  \n\nDas Kind lebt mit einem Eltern-Teil.  \n\nDer Eltern-Teil ist ledig, verwitwet oder geschieden.  \n\nDas Kind bekommt weniger Geld für Unterhalt oder Waisen-Bezüge.  \n\nDas Geld ist weniger als die Leistungen nach dem Unterhaltsvorschuss-Gesetz.  \n\nDas Kind hat die deutsche Staatsangehörigkeit.  \n\nDas Kind hat eine Berechtigung zur Freizügigkeit.  \n\nDas bedeutet, das Kind hat eine EU oder EWR Staatsangehörigkeit.  \n\nDas Kind hat eine Niederlassungs-Erlaubnis oder Aufenthalts-Erlaubnis.  \n\nDas Kind hat das Recht auf Erwerbstätigkeit.  \n\nDas Kind hat das Recht auf Daueraufenthalt.  \n\nAb dem 12. Lebensjahr gibt es besondere Regeln.  \n\nDas betreuende Eltern-Teil bekommt keine Leistungen nach dem SGB II.  \n\nOder das betreuende Eltern-Teil bekommt Leistungen nach dem SGB II.  \n\nDas betreuende Eltern-Teil hat ein Einkommen von mindestens 600 Euro brutto im Monat.  \n\nOder das Kind braucht keine Hilfe, weil es Unterhaltsvorschuss-Leistungen bekommt."
};

const CHAT_RESPONSE = {
    content: "Hello from MUCGPT! How can i help you? ⚠ This is a Mock Response! No real AI here, sorry!"
};

const CHAT_STREAM_RESPONSE = [
    { type: "C", message: "", order: 0 },
    { type: "C", message: "", order: 1 },
    { type: "C", message: "Hello", order: 2 },
    { type: "C", message: "!", order: 3 },
    { type: "C", message: " How", order: 4 },
    { type: "C", message: " can", order: 5 },
    { type: "C", message: " MUCGPT", order: 6 },
    { type: "C", message: " assist", order: 7 },
    { type: "C", message: " you", order: 8 },
    { type: "C", message: " today", order: 9 },
    { type: "C", message: "?", order: 10 },
    { type: "C", message: " ⚠ This", order: 11 },
    { type: "C", message: " is", order: 12 },
    { type: "C", message: " a", order: 13 },
    { type: "C", message: " mock", order: 14 },
    { type: "C", message: " response", order: 15 },
    { type: "C", message: "!", order: 16 },
    { type: "C", message: " No", order: 17 },
    { type: "C", message: " real", order: 18 },
    { type: "C", message: " AI", order: 19 },
    { type: "C", message: " here", order: 20 },
    { type: "C", message: ",", order: 21 },
    { type: "C", message: " sorry!", order: 22 },
    { type: "I", message: { requesttokens: 8, streamedtokens: 16 }, order: 17 }
];

export const handlers = [
    http.get("/api/config", () => {
        return HttpResponse.json(CONFIG_RESPONSE);
    }),
    http.post("/api/sum", async () => {
        await delay(1000);
        return HttpResponse.json(SUM_RESPONSE);
    }),
    http.post("/api/brainstorm", async () => {
        await delay(1000);
        return HttpResponse.json(BRAINSTORM_RESPONSE);
    }),
    http.post("/api/simply", async () => {
        await delay(1000);
        return HttpResponse.json(SIMPLY_RESPONSE);
    }),
    http.post("/api/counttokens", () => {
        return HttpResponse.json({ count: 100 });
    }),
    http.post("/api/chat", async () => {
        await delay(1000);
        return HttpResponse.json(CHAT_RESPONSE);
    }),
    http.post("/api/chat_stream", async () => {
        const stream = new ReadableStream({
            async start(controller) {
                for (const chunk of CHAT_STREAM_RESPONSE) {
                    // Serialize each chunk as NDJSON (newline-delimited JSON)
                    const encodedChunk = JSON.stringify(chunk) + "\n";
                    const encoder = new TextEncoder();
                    controller.enqueue(encoder.encode(encodedChunk));
                    await delay(100); // Reduced delay for faster response
                }
                controller.close();
            }
        });
        await delay(500);
        return new HttpResponse(stream, {
            headers: {
                "Content-Type": "application/x-ndjson", // Proper NDJSON content type
                "Transfer-Encoding": "chunked"
            }
        });
    })
];
