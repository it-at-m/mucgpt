// mocks/handlers.js
import { http, HttpResponse, delay } from "msw";
import { ApplicationConfig, AssistantCreateResponse, AssistantUpdateInput } from "../api";

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
            env_name: "MUCGPT"
        },
        alternative_logo: false,
        enable_simply: true
    },
    version: "FRONTEND DEMO 1.0.0",
    commit: "152b175"
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

const CREATE_ASSISTANT_RESPONSE: AssistantCreateResponse = {
    id: "assistant-mock-123",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    hierarchical_access: ["IT", "IT-KI"],
    owner_ids: ["user-mock-456"],
    latest_version: {
        id: "version-mock-789",
        version: 1,
        created_at: new Date().toISOString(),
        name: "Mock Assistant",
        description: "This is a mock assistant created for testing purposes",
        system_prompt: "You are a helpful assistant created for testing. Respond politely and professionally.",
        hierarchical_access: ["IT", "IT-KI"],
        temperature: 0.7,
        max_output_tokens: 4000,
        is_visible: true,
        tools: [
            { id: "tool-1", config: { enabled: true } },
            { id: "tool-2", config: { enabled: false } }
        ],
        owner_ids: ["user-mock-456"],
        examples: [
            { text: "How can I help you?", value: "I can help you with various tasks including document analysis, summarization, and general assistance." }
        ],
        quick_prompts: [
            { label: "Greeting", prompt: "Hello! How can I assist you today?", tooltip: "Start with a friendly greeting" },
            { label: "Help", prompt: "I'm here to help. What would you like to know?", tooltip: "Offer general assistance" }
        ],
        tags: ["test", "mock", "assistant"]
    }
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

// Simplify streaming example chunks
const SIMPLIFY_STREAM_RESPONSE = [
    // Tool started chunk
    {
        id: "chatcmpl-mock-stream-simplify-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Simplify",
                            state: "STARTED",
                            content: "Starte Vereinfachungsprozess...",
                            metadata: {}
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    },
    // Tool generating initial simplified text
    {
        id: "chatcmpl-mock-stream-simplify-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Simplify",
                            state: "APPEND",
                            content: "Erzeuge initiale vereinfachte Version..."
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-simplify-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Simplify",
                            state: "APPEND",
                            content: "\n\n<einfachesprache>\n\n"
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-simplify-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Simplify",
                            state: "APPEND",
                            content: "Am Sonntag und an Feiertagen dürfen die Menschen nicht arbeiten.  \n\n"
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-simplify-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Simplify",
                            state: "APPEND",
                            content: "Nur in besonderen Fällen ist Arbeit erlaubt.  \n\n"
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-simplify-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Simplify",
                            state: "APPEND",
                            content: "Hier sind die Beispiele:  \n\n"
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-simplify-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Simplify",
                            state: "APPEND",
                            content: "- Rettungsdienste (Notruf, Rettung) dürfen arbeiten.  \n"
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-simplify-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Simplify",
                            state: "APPEND",
                            content: "- Krankenhäuser dürfen offen sein.  \n"
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-simplify-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Simplify",
                            state: "APPEND",
                            content: "- Hotels dürfen öffnen.  \n\n"
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    },
    // Complete text update
    {
        id: "chatcmpl-mock-stream-simplify-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Simplify",
                            state: "UPDATE",
                            content: `<einfachesprache>

Am Sonntag und an Feiertagen dürfen die Menschen nicht arbeiten.

Nur in besonderen Fällen ist Arbeit erlaubt.

Hier sind die Beispiele:

- Rettungsdienste (Notruf, Rettung) dürfen arbeiten.
- Krankenhäuser dürfen offen sein.
- Polizei darf arbeiten.
- Feuerwehr darf arbeiten.
- Hotels dürfen öffnen.
- Veranstaltungen sind erlaubt.
- Der Verkehr (Autos, Busse) darf laufen.
- Stromversorgung ist erlaubt.
- In der Landwirtschaft darf man arbeiten.
- Wachleute passen auf.
- Reinigung ist erlaubt.
- In der Forschung darf man arbeiten.

Einige Geschäfte dürfen an Feiertagen öffnen.

Man darf manchmal auch an Feiertagen arbeiten.

Das ist zum Beispiel, wenn etwas Wichtiges gemacht werden muss.

Zum Beispiel:

- Bei der Herstellung von Sachen in Fabriken.
- In bestimmten Geschäften, wie Bäckereien.

</einfachesprache>`
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    },
    // First revision analysis
    {
        id: "chatcmpl-mock-stream-simplify-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Simplify",
                            state: "APPEND",
                            content: "\n\n**Überarbeitung #1: Textqualität wird analysiert...**"
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-simplify-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Simplify",
                            state: "APPEND",
                            content: "\n⚠️ Qualitätsprobleme erkannt. Text wird überarbeitet..."
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    },
    // Second revision analysis
    {
        id: "chatcmpl-mock-stream-simplify-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Simplify",
                            state: "APPEND",
                            content: "\n\n**Überarbeitung #2: Textqualität wird analysiert...**"
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-simplify-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Simplify",
                            state: "APPEND",
                            content: "\n⚠️ Qualitätsprobleme erkannt. Text wird überarbeitet..."
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    },
    // Third revision analysis
    {
        id: "chatcmpl-mock-stream-simplify-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Simplify",
                            state: "APPEND",
                            content: "\n\n**Überarbeitung #3: Textqualität wird analysiert...**"
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    },
    {
        id: "chatcmpl-mock-stream-simplify-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Simplify",
                            state: "APPEND",
                            content: "\n⚠️ Qualitätsprobleme erkannt. Text wird überarbeitet..."
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    },
    // Max revisions reached
    {
        id: "chatcmpl-mock-stream-simplify-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Simplify",
                            state: "APPEND",
                            content: "\n\nℹ️ Maximale Anzahl an Überarbeitungen (5) erreicht. Text wird finalisiert."
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    },
    // Tool completion
    {
        id: "chatcmpl-mock-stream-simplify-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Simplify",
                            state: "APPEND",
                            content: "\n\n✅ Textvereinfachung abgeschlossen!"
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    },
    // Tool ended chunk
    {
        id: "chatcmpl-mock-stream-simplify-1",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [
            {
                index: 0,
                delta: {
                    tool_calls: [
                        {
                            name: "Simplify",
                            state: "ENDED",
                            content: "Text erfolgreich in Leichte Sprache übersetzt."
                        }
                    ]
                },
                finish_reason: null
            }
        ]
    }
];

// Mock community assistants data
const MOCK_ASSISTANTS: AssistantCreateResponse[] = [
    {
        ...CREATE_ASSISTANT_RESPONSE,
        id: "assistant-1",
        latest_version: {
            ...CREATE_ASSISTANT_RESPONSE.latest_version,
            id: "version-1",
            name: "Code Helper",
            description: "Helps with coding questions and debugging",
            tags: ["coding", "programming", "debug"]
        }
    },
    {
        ...CREATE_ASSISTANT_RESPONSE,
        id: "assistant-2",
        latest_version: {
            ...CREATE_ASSISTANT_RESPONSE.latest_version,
            id: "version-2",
            name: "Document Analyzer",
            description: "Analyzes and summarizes documents",
            tags: ["documents", "analysis", "summary"]
        }
    },
    {
        ...CREATE_ASSISTANT_RESPONSE,
        id: "assistant-3",
        latest_version: {
            ...CREATE_ASSISTANT_RESPONSE.latest_version,
            id: "version-3",
            name: "Email Assistant",
            description: "Helps with email composition and management",
            tags: ["email", "communication", "management"]
        }
    }
];

export const handlers = [
    http.get("/api/backend/config", () => {
        return HttpResponse.json(CONFIG_RESPONSE);
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
                    // Random use mindmap, simplify, or normal stream
                    const streamType = Math.random();
                    let responseChunks;

                    if (streamType < 0.33) {
                        responseChunks = [...MINDMAP_STREAM_RESPONSE];
                    } else if (streamType < 0.66) {
                        responseChunks = [...SIMPLIFY_STREAM_RESPONSE];
                    } else {
                        responseChunks = [...CHAT_STREAM_RESPONSE];
                    }

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
    http.get("/api/backend/v1/tools", ({ request }) => {
        const url = new URL(request.url);
        const lang = url.searchParams.get("lang") || "deutsch";

        // Mock tools in different languages
        const toolsByLanguage = {
            deutsch: [
                { id: "Brainstorming", name: "Brainstorming", description: "Erstellt eine detaillierte Mindmap zu einem Thema im Markdown-Format." },
                {
                    id: "Vereinfachen",
                    name: "Vereinfachen",
                    description: "Vereinfacht komplexe deutsche Texte auf A2-Niveau nach Prinzipien der Leichten Sprache."
                }
            ],
            english: [
                { id: "Brainstorming", name: "Brainstorming", description: "Generates a detailed mind map for a given topic in markdown format." },
                { id: "Vereinfachen", name: "Simplify", description: "Simplifies complex German text to A2 level using Easy Language principles." }
            ],
            français: [
                { id: "Brainstorming", name: "Remue-méninges", description: "Génère une carte mentale détaillée pour un sujet donné au format markdown." },
                {
                    id: "Vereinfachen",
                    name: "Simplifier",
                    description: "Simplifie les textes allemands complexes au niveau A2 selon les principes du langage facile."
                }
            ],
            bairisch: [
                { id: "Brainstorming", name: "Hirngspinst", description: "Macht a genaue Mindmap zu am Thema im Markdown-Format." },
                { id: "Vereinfachen", name: "Eifacher machen", description: "Macht schwere deutsche Text eifacher auf A2-Level mit da Leichten Sprach." }
            ],
            українська: [
                { id: "Brainstorming", name: "Мозковий штурм", description: "Створює детальну ментальну карту для заданої теми у форматі markdown." },
                { id: "Vereinfachen", name: "Спростити", description: "Спрощує складні німецькі тексти до рівня A2 за принципами простої мови." }
            ]
        };

        const tools = toolsByLanguage[lang as keyof typeof toolsByLanguage] || toolsByLanguage.deutsch;

        return HttpResponse.json({
            tools: tools
        });
    }),
    http.get("/api/backend/departements", () => {
        return HttpResponse.json(["IT", "IT-KI", "IT-KI-AGI", "STAMMTISCH-BREZN-SALZER", "STAMMTISCH"]);
    }),
    http.post("/api/bot/create", async ({ request }) => {
        await delay(1000);
        const body = (await request.json()) as any;

        // Create a dynamic response based on the input
        const response: AssistantCreateResponse = {
            ...CREATE_ASSISTANT_RESPONSE,
            latest_version: {
                ...CREATE_ASSISTANT_RESPONSE.latest_version,
                name: body?.name || "Mock Assistant",
                description: body?.description || "This is a mock assistant created for testing purposes",
                system_prompt: body?.system_prompt || "You are a helpful assistant.",
                temperature: body?.temperature || 0.7,
                max_output_tokens: body?.max_output_tokens || 4000,
                hierarchical_access: body?.hierarchical_access || ["IT"],
                tools: body?.tools || [],
                examples: body?.examples || [],
                quick_prompts: body?.quick_prompts || [],
                tags: body?.tags || []
            }
        };

        return HttpResponse.json(response);
    }),

    // Get all community assistants
    http.get("/api/bot", () => {
        return HttpResponse.json(MOCK_ASSISTANTS);
    }),

    // Get specific community assistant
    http.get("/api/bot/:id", ({ params }) => {
        const { id } = params;
        const assistant = MOCK_ASSISTANTS.find(a => a.id === id);

        if (!assistant) {
            return new HttpResponse(null, { status: 404 });
        }

        return HttpResponse.json(assistant);
    }),

    // Update community assistant
    http.post("/api/bot/:id/update", async ({ params, request }) => {
        await delay(500);
        const { id } = params;
        const body = (await request.json()) as AssistantUpdateInput;

        const assistant = MOCK_ASSISTANTS.find(a => a.id === id);

        if (!assistant) {
            return new HttpResponse(null, { status: 404 });
        }

        // Create updated response
        const updatedAssistant: AssistantCreateResponse = {
            ...assistant,
            updated_at: new Date().toISOString(),
            latest_version: {
                ...assistant.latest_version,
                version: body.version || assistant.latest_version.version + 1,
                name: body.name || assistant.latest_version.name,
                description: body.description || assistant.latest_version.description,
                system_prompt: body.system_prompt || assistant.latest_version.system_prompt,
                hierarchical_access: body.hierarchical_access || assistant.latest_version.hierarchical_access,
                temperature: body.temperature !== undefined ? body.temperature : assistant.latest_version.temperature,
                max_output_tokens: body.max_output_tokens || assistant.latest_version.max_output_tokens,
                tools: body.tools || assistant.latest_version.tools,
                owner_ids: body.owner_ids || assistant.latest_version.owner_ids,
                examples: body.examples || assistant.latest_version.examples,
                quick_prompts: body.quick_prompts || assistant.latest_version.quick_prompts,
                tags: body.tags || assistant.latest_version.tags,
                created_at: new Date().toISOString()
            }
        };

        // Update the mock data
        const index = MOCK_ASSISTANTS.findIndex(a => a.id === id);
        if (index !== -1) {
            MOCK_ASSISTANTS[index] = updatedAssistant;
        }

        return HttpResponse.json(updatedAssistant);
    }),

    // Delete community assistant
    http.post("/api/bot/:id/delete", async ({ params }) => {
        await delay(300);
        const { id } = params;
        const assistant = MOCK_ASSISTANTS.find(a => a.id === id);

        if (!assistant) {
            return new HttpResponse(null, { status: 404 });
        }

        // Remove from mock data
        const index = MOCK_ASSISTANTS.findIndex(a => a.id === id);
        if (index !== -1) {
            MOCK_ASSISTANTS.splice(index, 1);
        }

        return HttpResponse.json({ message: "Assistant deleted successfully" });
    }),

    // Get specific version of community assistant
    http.get("/api/bot/:id/version/:version", ({ params }) => {
        const { id, version } = params;
        const assistant = MOCK_ASSISTANTS.find(a => a.id === id);

        if (!assistant) {
            return new HttpResponse(null, { status: 404 });
        }

        // For mock purposes, return the latest version regardless of version param
        // In a real implementation, you'd fetch the specific version
        const botVersion = {
            id: assistant.latest_version.id,
            version: parseInt(version as string) || assistant.latest_version.version,
            created_at: assistant.latest_version.created_at,
            name: assistant.latest_version.name,
            description: assistant.latest_version.description,
            system_prompt: assistant.latest_version.system_prompt,
            hierarchical_access: assistant.latest_version.hierarchical_access,
            temperature: assistant.latest_version.temperature,
            max_output_tokens: assistant.latest_version.max_output_tokens,
            tools: assistant.latest_version.tools,
            owner_ids: assistant.latest_version.owner_ids,
            examples: assistant.latest_version.examples,
            quick_prompts: assistant.latest_version.quick_prompts,
            tags: assistant.latest_version.tags,
            title: assistant.latest_version.name // Bot interface uses title instead of name
        };

        return HttpResponse.json(botVersion);
    }),

    // Get owned community bots
    http.get("/api/user/bots", () => {
        // Return only the first two assistants as "owned" by the current user
        const ownedBots = MOCK_ASSISTANTS.slice(0, 2);
        return HttpResponse.json(ownedBots);
    }),

    http.get("/api/sso/userinfo", () => {
        return HttpResponse.json({
            sub: "mock-user-123",
            displayName: "Mucci",
            surname: "Maskottchen",
            telephoneNumber: "+49 89 1234567",
            email: "mucci.maskottchen@muc.de",
            username: "mucci.maskottchen",
            givenname: "Max",
            department: "IT-KI",
            lhmObjectID: "2232324224",
            preferred_username: "mucci.maskottchen@muc.de",
            memberof: ["IT", "IT-KI"],
            user_roles: ["lhm-ab-mucgpt-user"],
            authorities: []
        });
    })
];
