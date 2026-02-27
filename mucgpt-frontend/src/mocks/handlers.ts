// mocks/handlers.js
import { http, HttpResponse, delay } from "msw";
import { ApplicationConfig, AssistantCreateResponse, AssistantUpdateInput } from "../api";
import {
    buildAssistantCreateResponse,
    buildAssistantList,
    buildChatMessage,
    generateChatStreamChunks,
    generateMindmapStreamChunks,
    generateSimplifyStreamChunks
} from "./data/generators";
import { CREATIVITY_HIGH } from "../constants";

const DIRECTORY_TREE = [
    {
        shortname: null,
        name: "Landeshauptstadt München",
        children: [
            {
                shortname: "BAU",
                name: "Baureferat",
                children: [
                    {
                        shortname: "BAU-BEURL",
                        name: "Beurlaubte des Baureferates",
                        children: [
                            { shortname: "BAU-BEURL-TECH", name: "Technik", children: [] },
                            { shortname: null, name: "Allgemein", children: [] }
                        ]
                    },
                    { shortname: "BAU-G", name: "HA Gartenbau", children: [] }
                ]
            },
            {
                shortname: "RIT",
                name: "IT-Referat",
                children: [
                    { shortname: "RIT-AI", name: "Ur future AI Overlords ", children: [] },
                    {
                        shortname: "ITM",
                        name: "IT@M",
                        children: [{ shortname: "ITM-KM-DI", name: "Data & Innovation", children: [] }]
                    }
                ]
            },
            {
                shortname: "POR",
                name: "Personal- und Organisationsreferat",
                children: [
                    { shortname: "POR-P", name: "Personalbereich", children: [] },
                    { shortname: "POR-O", name: "Organisationsbereich", children: [] }
                ]
            }
        ]
    }
];

function normalize(value: string | null) {
    return value?.trim().toLowerCase() || null;
}

function matchNode(segment: string, node: any) {
    const target = normalize(segment);
    if (!target) return false;
    return target === normalize(node.shortname) || target === normalize(node.name);
}

function findNode(pathSegments: string[]) {
    let currentList: any[] = DIRECTORY_TREE;
    let current: any | null = null;
    for (const segment of pathSegments) {
        current = currentList.find(node => matchNode(segment, node)) || null;
        if (!current) return null;
        currentList = current.children || [];
    }
    return current;
}

const CONFIG_RESPONSE: ApplicationConfig = {
    models: [
        {
            llm_name: "KICCGPT",
            max_input_tokens: 128000,
            max_output_tokens: 12000,
            description: "GPT build by KICC",
            knowledge_cut_off: "2024-07-01",
            input_cost_per_token: 3e-7,
            output_cost_per_token: 9e-7,
            supports_function_calling: true,
            supports_reasoning: true,
            supports_vision: false,
            litellm_provider: "azure_openai",
            inference_location: "westeurope"
        },
        {
            llm_name: "UnknownGPT",
            max_input_tokens: 128000,
            max_output_tokens: 128000,
            description: "A young model that has to earn it's name, but with a lot of potential.",
            knowledge_cut_off: "2024-07-01",
            input_cost_per_token: 1.71e-6,
            output_cost_per_token: 6.84e-6,
            supports_function_calling: true,
            supports_reasoning: false,
            supports_vision: false,
            litellm_provider: "openai",
            inference_location: "us-east-1"
        },
        {
            llm_name: "AnnonymGPT",
            max_input_tokens: 500000,
            max_output_tokens: 12000,
            description: "A GPT that tends to write reddit comments",
            knowledge_cut_off: "2023-07-01",
            input_cost_per_token: 3.5e-7,
            output_cost_per_token: 1.37e-6,
            supports_function_calling: false,
            supports_reasoning: false,
            supports_vision: false,
            litellm_provider: "ollama"
        }
    ],
    env_name: "MUCGPT",
    alternative_logo: false,
    core_version: "0.0.1",
    frontend_version: "0.0.1",
    assistant_version: "0.0.1"
};

const DYNAMIC_ASSISTANTS: AssistantCreateResponse[] = buildAssistantList(6);

// Add a specific assistant with a default model
DYNAMIC_ASSISTANTS.push(
    buildAssistantCreateResponse({
        id: "assistant-with-default-model",
        latest_version: {
            id: "version-default-model-1",
            version: 1,
            created_at: new Date().toISOString(),
            name: "KICC Research Assistant",
            description: "A specialized research assistant that always uses the KICCGPT model for consistent, high-quality responses.",
            system_prompt: "You are the KICC Research Assistant. Provide detailed, well-researched answers with citations when possible.",
            hierarchical_access: ["RIT-AI", "ITM-KM-DI"],
            creativity: "low",
            default_model: "KICCGPT",
            is_visible: true,
            tools: [
                { id: "Brainstorming", config: { enabled: true } },
                { id: "Vereinfachen", config: { enabled: false } }
            ],
            owner_ids: ["user-mock-123"],
            examples: [
                {
                    text: "What are the latest developments in AI?",
                    value: "I can help you research recent AI developments. Let me provide a comprehensive overview..."
                }
            ],
            quick_prompts: [
                { label: "Research Topic", prompt: "Please research this topic in detail:", tooltip: "Deep research" },
                { label: "Summarize Paper", prompt: "Summarize this research paper:", tooltip: "Academic summary" }
            ],
            tags: ["research", "academic", "kiccgpt"]
        }
    })
);

// Add an assistant with a deprecated/unavailable default model
DYNAMIC_ASSISTANTS.push(
    buildAssistantCreateResponse({
        id: "assistant-with-deprecated-model",
        latest_version: {
            id: "version-deprecated-model-1",
            version: 1,
            created_at: new Date().toISOString(),
            name: "Legacy Document Assistant",
            description: "An older assistant configured to use GPT-3.5-Turbo, which has been deprecated and is no longer available in the system.",
            system_prompt: "You are a document processing assistant. Help users analyze, summarize, and extract information from documents.",
            hierarchical_access: ["BAU", "POR"],
            creativity: CREATIVITY_HIGH,
            default_model: "gpt-3.5-turbo",
            is_visible: true,
            tools: [
                { id: "Brainstorming", config: { enabled: false } },
                { id: "Vereinfachen", config: { enabled: true } }
            ],
            owner_ids: ["user-mock-456"],
            examples: [
                {
                    text: "How can you help with documents?",
                    value: "I can help you summarize documents, extract key information, and answer questions about their content."
                }
            ],
            quick_prompts: [
                { label: "Summarize", prompt: "Please summarize this document:", tooltip: "Quick summary" },
                { label: "Key Points", prompt: "Extract the key points from this text:", tooltip: "Main ideas" }
            ],
            tags: ["documents", "legacy", "deprecated"]
        }
    })
);

// Add assistants with longer names, descriptions, and system prompts
DYNAMIC_ASSISTANTS.push(
    buildAssistantCreateResponse({
        id: "assistant-email-composer",
        latest_version: {
            id: "v-email-1",
            version: 1,
            created_at: new Date().toISOString(),
            name: "Professional E-Mail Drafting Assistant",
            description:
                "This assistant helps you compose clear, professional e-mails for a variety of workplace scenarios. Whether you need to write a follow-up to a meeting, respond to a client inquiry, or draft an internal announcement, it adapts tone and structure to your audience. It also suggests subject lines and can rewrite existing drafts to improve clarity and politeness.",
            system_prompt:
                "You are a professional e-mail drafting assistant for employees of the City of Munich. Your task is to help users compose, edit, and improve e-mails. Always match the formality level to the intended audience — formal for external partners, semi-formal for cross-department communication, and friendly-professional for team-internal messages. Offer alternative phrasings when the user's draft could be misunderstood. Include a clear subject-line suggestion with every draft. Avoid jargon unless the user explicitly requests it. If the user provides bullet points, convert them into well-structured paragraphs. Always end with an appropriate closing.",
            hierarchical_access: ["ITM-KM-DI"],
            creativity: "medium",
            is_visible: true,
            tools: [
                { id: "Brainstorming", config: { enabled: false } },
                { id: "Vereinfachen", config: { enabled: true } }
            ],
            owner_ids: ["user-mock-001"],
            examples: [
                {
                    text: "Draft a follow-up e-mail after a project kickoff meeting",
                    value: "Sure! I'll draft a concise follow-up summarizing action items and next steps."
                },
                {
                    text: "Make this e-mail sound more polite",
                    value: "I can soften the tone while keeping the message clear. Paste your draft and I'll revise it."
                }
            ],
            quick_prompts: [
                { label: "Follow-up", prompt: "Draft a follow-up e-mail for a meeting that took place yesterday.", tooltip: "Post-meeting follow-up" },
                { label: "Apology", prompt: "Write a professional apology e-mail for a delayed response.", tooltip: "Apologize for delay" }
            ],
            tags: ["e-mail", "communication", "writing"]
        }
    })
);

DYNAMIC_ASSISTANTS.push(
    buildAssistantCreateResponse({
        id: "assistant-meeting-minutes",
        latest_version: {
            id: "v-meeting-1",
            version: 2,
            created_at: new Date().toISOString(),
            name: "Meeting Minutes & Action Item Tracker",
            description:
                "Paste your rough meeting notes or a transcript, and this assistant will transform them into well-structured meeting minutes. It identifies participants, key discussion points, decisions made, and open action items with owners and deadlines. The output is formatted in a clean, ready-to-share document style that can be sent directly to attendees.",
            system_prompt:
                "You are a meeting-minutes assistant. When the user provides raw notes, a transcript, or bullet points from a meeting, you must produce structured meeting minutes. Include the following sections: 1) Meeting Title & Date, 2) Attendees, 3) Agenda Items Discussed (with brief summaries), 4) Decisions Made, 5) Action Items (formatted as a table with columns: Action, Owner, Deadline, Status). If information is missing, ask the user to fill in the gaps rather than guessing. Use formal but readable language. Keep summaries concise — no longer than two sentences per agenda item. Always end with a 'Next Steps' section.",
            hierarchical_access: ["POR-O"],
            creativity: "low",
            is_visible: true,
            tools: [
                { id: "Brainstorming", config: { enabled: false } },
                { id: "Vereinfachen", config: { enabled: false } }
            ],
            owner_ids: ["user-mock-002"],
            examples: [{ text: "Here are my rough notes from today's standup…", value: "I'll organize these into clean meeting minutes with action items." }],
            quick_prompts: [
                { label: "Format Notes", prompt: "Please format the following rough meeting notes into structured minutes:", tooltip: "Structure raw notes" },
                { label: "Extract Actions", prompt: "Extract all action items from the following meeting transcript:", tooltip: "Find action items" }
            ],
            tags: ["meetings", "productivity", "documentation"]
        }
    })
);

DYNAMIC_ASSISTANTS.push(
    buildAssistantCreateResponse({
        id: "assistant-policy-explainer",
        latest_version: {
            id: "v-policy-1",
            version: 1,
            created_at: new Date().toISOString(),
            name: "Municipal Policy & Regulation Explainer",
            description:
                "Understanding internal policies and municipal regulations can be overwhelming. This assistant breaks down complex administrative guidelines, city ordinances, and internal procedures into plain language. It can compare different regulation versions, highlight what changed, and explain how a policy affects day-to-day work. Ideal for onboarding new employees or clarifying compliance questions.",
            system_prompt:
                "You are a municipal policy explainer for the city administration of Munich. Your role is to translate complex legal and administrative texts into clear, accessible language. When a user pastes a regulation or policy excerpt, summarize its key points in plain language, highlight who is affected, what actions are required, and any deadlines. If the user asks about differences between two versions of a policy, create a comparison highlighting additions, removals, and changes. Never provide legal advice — always recommend consulting the legal department for binding interpretations. Use bullet points and numbered lists for clarity. If a term is technical, provide a brief definition in parentheses.",
            hierarchical_access: ["POR-P", "BAU"],
            creativity: "low",
            is_visible: true,
            tools: [
                { id: "Brainstorming", config: { enabled: false } },
                { id: "Vereinfachen", config: { enabled: true } }
            ],
            owner_ids: ["user-mock-003"],
            examples: [
                { text: "Explain the new travel expense policy in simple terms", value: "I'll break it down into the key points that affect your daily work." },
                {
                    text: "What changed between v2 and v3 of the data protection guideline?",
                    value: "I can create a side-by-side comparison highlighting the differences."
                }
            ],
            quick_prompts: [
                { label: "Summarize Policy", prompt: "Summarize the following policy document in plain language:", tooltip: "Plain-language summary" },
                { label: "Compare Versions", prompt: "Compare these two versions of the regulation and highlight what changed:", tooltip: "Version comparison" }
            ],
            tags: ["policy", "legal", "compliance", "onboarding"]
        }
    })
);

// Helper to choose stream type basierend auf enabled_tools
function chooseStreamType(enabledTools?: string[]) {
    const options: Array<"mindmap" | "simplify"> = [];
    if (enabledTools?.includes("Brainstorming")) options.push("mindmap");
    if (enabledTools?.includes("Vereinfachen")) options.push("simplify");
    if (options.length === 0) return "chat" as const; // Kein Tool aktiv => normaler Chat
    return options[Math.floor(Math.random() * options.length)];
}

export const handlers = [
    http.get("/api/backend/config", () => {
        return HttpResponse.json(CONFIG_RESPONSE);
    }),
    http.get("/api/directory/children", ({ request }) => {
        const url = new URL(request.url);
        const pathParam = url.searchParams.get("path");
        let pathSegments: string[] = [];

        if (pathParam) {
            try {
                const parsed = JSON.parse(pathParam);
                if (Array.isArray(parsed)) {
                    pathSegments = parsed.map(String);
                } else {
                    pathSegments = [String(parsed)];
                }
            } catch {
                pathSegments = [pathParam];
            }
        }

        if (pathSegments.length === 0) {
            return HttpResponse.json(DIRECTORY_TREE);
        }
        const node = findNode(pathSegments);
        if (!node) {
            return new HttpResponse(null, { status: 404 });
        }
        return HttpResponse.json(node.children || []);
    }),
    http.get("/api/backend/v1/tools", ({ request }) => {
        const url = new URL(request.url);
        const lang = url.searchParams.get("lang") || "deutsch";
        const toolsByLanguage: Record<string, any[]> = {
            deutsch: [
                {
                    id: "Brainstorming",
                    name: "Brainstorming",
                    description: "Erstellt eine detaillierte Mindmap zu einem Thema im Markdown-Format.",
                    long_description: "Generiert schrittweise eine strukturierte Mindmap mit Hierarchieebenen (Markdown).",
                    lang: "deutsch",
                    config: { enabled: true }
                },
                {
                    id: "Vereinfachen",
                    name: "Vereinfachen",
                    description: "Vereinfacht komplexe deutsche Texte auf A2-Niveau nach Prinzipien der Leichten Sprache.",
                    long_description: "Analysiert juristische / komplexe Texte und überführt sie in eine leicht verständliche Version.",
                    lang: "deutsch",
                    config: { enabled: true }
                }
            ],
            english: [
                {
                    id: "Brainstorming",
                    name: "Brainstorming",
                    description: "Generates a detailed mind map for a given topic in markdown format.",
                    long_description: "Creates a hierarchical mind map representation with sections and subtopics.",
                    lang: "english",
                    config: { enabled: true }
                },
                {
                    id: "Vereinfachen",
                    name: "Simplify",
                    description: "Simplifies complex German text to A2 level using Easy Language principles.",
                    long_description: "Transforms dense German text into accessible language for wider audiences.",
                    lang: "english",
                    config: { enabled: true }
                }
            ],
            français: [
                {
                    id: "Brainstorming",
                    name: "Remue-méninges",
                    description: "Génère une carte mentale détaillée pour un sujet donné au format markdown.",
                    long_description: "Construit une carte mentale hiérarchique en plusieurs segments.",
                    lang: "français",
                    config: { enabled: true }
                },
                {
                    id: "Vereinfachen",
                    name: "Simplifier",
                    description: "Simplifie les textes allemands complexes au niveau A2 selon les principes du langage facile.",
                    long_description: "Réécrit des textes complexes en allemand dans une forme plus accessible.",
                    lang: "français",
                    config: { enabled: true }
                }
            ],
            bairisch: [
                {
                    id: "Brainstorming",
                    name: "Hirngspinst",
                    description: "Macht a genaue Mindmap zu am Thema im Markdown-Format.",
                    long_description: "Baut a hierarchische Mindmap Stufe für Stufe auf.",
                    lang: "bairisch",
                    config: { enabled: true }
                },
                {
                    id: "Vereinfachen",
                    name: "Eifacher machen",
                    description: "Macht schwere deutsche Text eifacher auf A2-Level mit da Leichten Sprach.",
                    long_description: "Wandelt formelle oder schwierige Text grob in eifache Sprache um.",
                    lang: "bairisch",
                    config: { enabled: true }
                }
            ],
            українська: [
                {
                    id: "Brainstorming",
                    name: "Мозковий штурм",
                    description: "Створює детальну ментальну карту для заданої теми у форматі markdown.",
                    long_description: "Генерує ієрархічну структуру теми по частинах.",
                    lang: "українська",
                    config: { enabled: true }
                },
                {
                    id: "Vereinfachen",
                    name: "Спростити",
                    description: "Спрощує складні німецькі тексти до рівня A2 за принципами простої мови.",
                    long_description: "Перетворює складні фрагменти тексту на зрозуміліші речення.",
                    lang: "українська",
                    config: { enabled: true }
                }
            ]
        };
        const tools = toolsByLanguage[lang] || toolsByLanguage.deutsch;
        return HttpResponse.json({ tools });
    }),
    http.post("/api/backend/v1/chat/completions", async ({ request }) => {
        const body = (await request.json()) as { stream?: boolean; messages?: { role: string; content: string }[]; enabled_tools?: string[] };
        if (body?.stream) {
            const encoder = new TextEncoder();
            const streamType = chooseStreamType(body.enabled_tools);
            const stream = new ReadableStream({
                async start(controller) {
                    let chunks: any[] = [];
                    if (streamType === "mindmap") {
                        const topic =
                            body.messages
                                ?.slice()
                                .reverse()
                                .find(m => m.role === "user")?.content || "Künstliche Intelligenz";
                        chunks = generateMindmapStreamChunks(topic);
                    } else if (streamType === "simplify") {
                        chunks = generateSimplifyStreamChunks();
                    } else {
                        let reply = buildChatMessage();
                        if (Math.random() > 0.7) {
                            reply +=
                                "\n\nHier ist eine beispielhafte Tabelle:\n\n| Name | Kategorie | Wert |\n| :--- | :---: | ---: |\n| Element A | Gruppe 1 | 123.45 |\n| Element B | Gruppe 2 | 67.89 |\n| Element C | Gruppe 1 | 99.99 |\n| Element D | Gruppe 3 | 10.00 |\n\n";
                        }
                        chunks = generateChatStreamChunks(reply);
                    }
                    for (const chunk of chunks) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                        await delay(200);
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
        }
        // Non-streaming fallback
        await delay(400);
        return HttpResponse.json({
            id: `chatcmpl-mock-${Math.random().toString(36).slice(2, 10)}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: "KICCGPT",
            choices: [{ index: 0, message: { role: "assistant", content: buildChatMessage() }, finish_reason: "stop" }],
            usage: { prompt_tokens: 12, completion_tokens: 28, total_tokens: 40 }
        });
    }),

    // Replace /api/assistant/create with dynamic builder
    http.post("/api/backend/v1/generate/assistant", async ({ request }) => {
        await delay(500);
        const raw = await request.json();
        const body = raw && typeof raw === "object" && (raw as any).latest_version ? (raw as any).latest_version : {};
        const assistant = buildAssistantCreateResponse({ latest_version: body });
        DYNAMIC_ASSISTANTS.push(assistant);
        return HttpResponse.json(assistant);
    }),

    http.get("/api/assistant", () => {
        return HttpResponse.json(DYNAMIC_ASSISTANTS);
    }),

    http.get("/api/assistant/:id", ({ params }) => {
        const a = DYNAMIC_ASSISTANTS.find(x => x.id === params.id);
        if (!a) return new HttpResponse(null, { status: 404 });
        return HttpResponse.json(a);
    }),

    http.post("/api/assistant/:id/update", async ({ params, request }) => {
        await delay(300);
        const body = (await request.json()) as AssistantUpdateInput;
        const idx = DYNAMIC_ASSISTANTS.findIndex(a => a.id === params.id);
        if (idx === -1) return new HttpResponse(null, { status: 404 });
        const current = DYNAMIC_ASSISTANTS[idx];
        const updated: AssistantCreateResponse = {
            ...current,
            updated_at: new Date().toISOString(),
            latest_version: {
                ...current.latest_version,
                version: body.version || current.latest_version.version + 1,
                name: body.name || current.latest_version.name,
                description: body.description || current.latest_version.description,
                system_prompt: body.system_prompt || current.latest_version.system_prompt,
                hierarchical_access: body.hierarchical_access || current.latest_version.hierarchical_access,
                creativity: body.creativity ?? current.latest_version.creativity,
                default_model:
                    body.default_model !== undefined ? (body.default_model === "" ? undefined : body.default_model) : current.latest_version.default_model,
                tools: body.tools || current.latest_version.tools,
                owner_ids: body.owner_ids || current.latest_version.owner_ids,
                examples: body.examples || current.latest_version.examples,
                quick_prompts: body.quick_prompts || current.latest_version.quick_prompts,
                tags: body.tags || current.latest_version.tags,
                created_at: new Date().toISOString()
            }
        };
        DYNAMIC_ASSISTANTS[idx] = updated;
        return HttpResponse.json(updated);
    }),

    http.post("/api/assistant/:id/delete", async ({ params }) => {
        await delay(250);
        const idx = DYNAMIC_ASSISTANTS.findIndex(a => a.id === params.id);
        if (idx === -1) return new HttpResponse(null, { status: 404 });
        DYNAMIC_ASSISTANTS.splice(idx, 1);
        return HttpResponse.json({ message: "Assistant deleted successfully" });
    }),

    http.get("/api/assistant/:id/version/:version", ({ params }) => {
        const a = DYNAMIC_ASSISTANTS.find(x => x.id === params.id);
        if (!a) return new HttpResponse(null, { status: 404 });
        return HttpResponse.json(a.latest_version);
    }),

    http.get("/api/user/assistants", () => {
        return HttpResponse.json(DYNAMIC_ASSISTANTS.slice(0, 3));
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
    }),

    http.get("/api/user/subscriptions", async () => {
        await delay(300);
        // Return a subset of assistants as subscriptions with simplified information
        // as defined in the SubscriptionResponse model
        const subscriptions = DYNAMIC_ASSISTANTS.slice(0, 2).map(assistant => ({
            id: assistant.id,
            title: assistant.latest_version.name,
            description: assistant.latest_version.description
        }));
        return HttpResponse.json(subscriptions);
    }),

    http.post("/api/user/subscriptions/:assistantId", async ({ params }) => {
        await delay(300);
        const assistant = DYNAMIC_ASSISTANTS.find(a => a.id === params.assistantId);
        if (!assistant) {
            return new HttpResponse(null, { status: 404 });
        }
        // In a real implementation, this would add the subscription to a database
        // For the mock, we just return success
        return HttpResponse.json({
            id: assistant.id,
            title: assistant.latest_version.name,
            description: assistant.latest_version.description
        });
    })
];
