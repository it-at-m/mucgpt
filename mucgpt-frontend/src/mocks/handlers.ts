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
        enable_simply: true
    },
    version: "FRONTEND DEMO 1.0.0",
    commit: "152b175"
};

const SUM_RESPONSE = {
    answer: [
        "Eine Umfrage von YouGov zeigt, dass 57 % der Deutschen ein Tempolimit von 130 km/h unterstützen. Zu den Befürwortern gehört unter anderem der bekannten Formel-1-Fahrer Sebastian Vettel. Auf der anderen Seite steht der Verkehrsminister Volker Wissing von der FDP, der gegen Tempolimits ist, da er das Fahren als eine Form der Freiheit betrachtet. Die unbeschränkten Geschwindigkeiten auf den Autobahnen in Deutschland gehen auf eine Deregulierung aus dem Jahr 1953 unter Kanzler Konrad Adenauer zurück, die das Mythos der Autobahn geprägt hat.\n\nHistorisch gesehen haben der ADAC und die Automobilindustrie, einschließlich Daimler, sich gegen Tempolimits gewehrt. Dennoch haben steigende Verkehrstoten dazu geführt, dass in städtischen Gebieten ein Tempolimit von 50 km/h eingeführt wurde. In diesem Zusammenhang wird die laufende Debatte über Tempolimits in Deutschland beleuchtet, insbesondere im Hinblick auf die Verkehrstoten und das frühere Tempolimit von 100 km/h. Die Kampagne des ADAC für unbeschränktes Fahren verdeutlicht den Konflikt zwischen Freiheit und Sicherheit.\n\nEine aktuelle Studie legt nahe, dass ein Tempolimit von 120 km/h die Emissionen jährlich um 4,2 % senken könnte. Zudem zeigen Daten, dass Abschnitte mit Tempolimit eine niedrigere Todesfallrate pro einer Milliarde gefahrenen Kilometern aufweisen. In diesem Artikel wird die deutsche Vorliebe für schnelles Fahren untersucht, die oft mit dem Konzept der Freiheit in Verbindung gebracht wird. Eine Studie aus dem Jahr 2021 zeigt, dass 77 % der Fahrer auf Autobahnabschnitten ohne Tempolimit unter 130 km/h fahren, während 12 % zwischen 130 und 140 km/h und nur 2 % über 160 km/h fahren.\n\nVerkehrspsychologen weisen darauf hin, dass das kollektive Bewusstsein dieses Verhalten beeinflusst. Während die Mehrheit des ADAC ein Tempolimit befürwortet, stehen die Automobilindustrie und die FDP dem entgegen.",
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
    id: "chatcmpl-mock-123",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "KICCGPT",
    choices: [
        {
            index: 0,
            message: {
                role: "assistant",
                content: "Hello from MUCGPT! How can i help you? ⚠ This is a Mock Response! No real AI here, sorry!"
            },
            finish_reason: "stop"
        }
    ],
    usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
    }
};

const CREATE_BOT_RESPONSE = {
    title: "E-Mail-Assistent",
    description:
        "Dieser Assistent beantwortet eingehende E-Mails höflich und individuell, indem er die spezifischen Anliegen der Absender versteht und detaillierte, klare Antworten formuliert.",
    system_prompt:
        "Bitte beantworten Sie eingehende E-Mails höflich und individuell, indem Sie auf die spezifischen Anliegen der Absender eingehen.\n\nBerücksichtigen Sie die jeweilige Anfrage und zeigen Sie Verständnis für die Anliegen der Bürger.\n\n# Schritte\n\n- Lesen Sie die E-Mail sorgfältig durch und identifizieren Sie die Hauptanliegen des Absenders.\n- Formulieren Sie eine höfliche Anrede.\n- Beantworten Sie die Anfrage detailliert und individuell, basierend auf dem spezifischen Anliegen.\n- Schließen Sie mit einer freundlichen Grußformel.\n\n# Output Format\n\nDie Antwort sollte in Form einer formellen E-Mail verfasst werden, die klar und strukturiert ist. Verwenden Sie vollständige Sätze und achten Sie darauf, dass die Antwort ein angemessenes Maß an Höflichkeit und Professionalität aufweist.\n\n# Beispiele\n\n**Beispiel 1:**\n*Eingang:*\n„Ich habe eine Frage zu den Öffnungszeiten des Rathauses.“\n\n*Ausgang:*\n„Sehr geehrte/r [Name],  \nvielen Dank für Ihre Anfrage. Die Öffnungszeiten des Rathauses sind von Montag bis Freitag, 8:00 bis 18:00 Uhr. Bei weiteren Fragen stehe ich Ihnen gerne zur Verfügung.   \nMit freundlichen Grüßen,  \n[Ihr Name]“\n\n**Beispiel 2:**\n*Eingang:*\n„Ich benötige Informationen zu einem Bauantrag.“\n\n*Ausgang:*\n„Sehr geehrte/r [Name],  \nich danke Ihnen für Ihre E-Mail. Für Informationen bezüglich Ihres Bauantrags empfehle ich, die Plattform [Link zur Plattform] zu besuchen oder uns direkt zu kontaktieren. Gerne unterstütze ich Sie dabei!  \nMit besten Grüßen,  \n[Ihr Name]“\n\n# Notes\n\nAchten Sie darauf, dass jede Antwort individuell angepasst wird und die Anliegen der Bürger ernst genommen werden."
};

const CHAT_STREAM_RESPONSE = [
    {
        id: "chatcmpl-mock-stream-123",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: { content: "Hello" },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-123",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: { content: "!" },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-123",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: { content: " How" },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-123",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: { content: " can" },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-123",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: { content: " MUCGPT" },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-123",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: { content: " assist" },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-123",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: { content: " you" },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-123",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: { content: " today" },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-123",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: { content: "?" },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-123",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: { content: " ⚠ This" },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-123",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: { content: " is" },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-123",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: { content: " a" },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-123",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: { content: " mock" },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-123",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: { content: " response" },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-123",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: { content: "!" },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-123",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: { content: " No" },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-123",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: { content: " real" },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-123",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: { content: " AI" },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-123",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: { content: " here" },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-123",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: { content: "," },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-123",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: { content: " sorry!" },
                finish_reason: null
            }
        ]
    },

    {
        id: "chatcmpl-mock-stream-123",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {},
                finish_reason: null
            }
        ],
        usage: {
            prompt_tokens: 15,
            completion_tokens: 25,
            total_tokens: 40
        }
    },
    {
        id: "chatcmpl-mock-stream-123",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {},
                finish_reason: "stop"
            }
        ]
    }
];

// Mindmap streaming example chunks
const MINDMAP_STREAM_RESPONSE = [
    // Tool started chunk
    {
        id: "chatcmpl-mock-stream-mindmap-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Brainstorming",
                            state: "STARTED",
                            content: "Starte Mindmap-Generierung zum Thema 'Künstliche Intelligenz'",
                            metadata: {}
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    },
    // Tool update chunk (partial mindmap)
    {
        id: "chatcmpl-mock-stream-mindmap-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Brainstorming",
                            state: "APPEND",
                            content: "# Künstliche Intelligenz \n\n"
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-mindmap-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Brainstorming",
                            state: "APPEND",
                            content: "## Deep Learning \n\n"
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-mindmap-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Brainstorming",
                            state: "APPEND",
                            content: "### Supervised Learning \n\n"
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-mindmap-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Brainstorming",
                            state: "APPEND",
                            content: "#### Classification \n\n"
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-mindmap-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Brainstorming",
                            state: "APPEND",
                            content: "#### Regression \n\n"
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-mindmap-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Brainstorming",
                            state: "APPEND",
                            content: "- Neural Networks \n\n"
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-mindmap-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Brainstorming",
                            state: "APPEND",
                            content: "## Machine Learning \n\n"
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-mindmap-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Brainstorming",
                            state: "APPEND",
                            content: "### SVM \n\n"
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-mindmap-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Brainstorming",
                            state: "APPEND",
                            content: "### Decision Trees \n\n"
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-mindmap-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Brainstorming",
                            state: "UPDATE",
                            content:
                                "# Artifical Intelligence \n\n## Deep Learning\n- Supervised Learning\n  - Classification\n  - Regression\n- Neural Networks\n\n## Machine Learning\n- SVM\n- Decision Trees"
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    }, // Tool ended chunk (final mindmap)
    {
        id: "chatcmpl-mock-stream-mindmap-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Brainstorming",
                            state: "ENDED",
                            content: "Erfolgreich Mindmap zum Thema 'Künstliche Intelligenz' erstellt."
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    },
    // Normal message content after tool
    {
        id: "chatcmpl-mock-stream-mindmap-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: { content: "Hier ist Ihre Mindmap!" },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-mindmap-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {},
                finish_reason: "stop"
            }
        ]
    }
];

export const handlers = [
    http.get("/api/backend/config", () => {
        return HttpResponse.json(CONFIG_RESPONSE);
    }),
    http.post("/api/backend/sum", async () => {
        await delay(1000);
        return HttpResponse.json(SUM_RESPONSE);
    }),
    http.post("/api/backend/brainstorm", async () => {
        await delay(1000);
        return HttpResponse.json(BRAINSTORM_RESPONSE);
    }),
    http.post("/api/backend/simply", async () => {
        await delay(1000);
        return HttpResponse.json(SIMPLY_RESPONSE);
    }),
    http.post("/api/backend/counttokens", () => {
        return HttpResponse.json({ count: 100 });
    }),
    http.post("api/backend/create_bot", async () => {
        await delay(1000);
        return HttpResponse.json(CREATE_BOT_RESPONSE);
    }),
    http.post("/api/backend/v1/chat/completions", async ({ request }) => {
        // Check if streaming is requested
        const body = (await request.json()) as { stream?: boolean };
        if (body?.stream) {
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                async start(controller) {
                    //random use mindmap or normal stream (CHAT_STREAM_RESPONSE)
                    const responseChunks = [...MINDMAP_STREAM_RESPONSE, ...CHAT_STREAM_RESPONSE];
                    for (const chunk of responseChunks) {
                        const data = `data: ${JSON.stringify(chunk)}\n\n`;
                        controller.enqueue(encoder.encode(data));
                        await delay(300);
                    }
                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                    controller.close();
                }
            });
            return new HttpResponse(stream, {
                headers: {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    Connection: "keep-alive"
                }
            });
        } else {
            await delay(1000);
            return HttpResponse.json(CHAT_RESPONSE);
        }
    }),
    http.get("/api/backend/v1/tools", () => {
        return HttpResponse.json({
            tools: [
                { name: "PDF-Entfessler 3000", description: "Zähmt wilde PDFs und extrahiert ihren Text – garantiert ohne Papierstau!" },
                { name: "Super-Summarizer", description: "Komprimiert lange Texte auf Espresso-Länge. Koffein für Ihre Dokumente!" },
                { name: "Excel-Exorzist", description: "Vertreibt böse Formelfehler und bannt Geisterzellen – jetzt mit heiligem Wasser in der Cloud!" },
                {
                    name: "Bild-Beschwörer",
                    description: "Verwandelt kryptische Bilddateien in verständliche Kunstwerke – inklusive moderner Hieroglyphen-Übersetzung!"
                },
                { name: "Daten-Dompteur", description: "Zähmt wilde Datensätze und bringt Ordnung ins Zahlenchaos – garantiert ohne Peitsche!" },
                { name: "Mail-Magier", description: "Sortiert, filtert und zaubert Übersicht in Ihren Posteingang – Spam verschwindet wie von Geisterhand!" },
                { name: "Formular-Fuchs", description: "Füllt Formulare blitzschnell aus und findet jedes versteckte Kästchen – nie wieder Papierkrieg!" }
            ]
        });
    })
];
