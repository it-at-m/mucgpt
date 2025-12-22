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

const DIRECTORY_TREE = [
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
        children: [{ shortname: "RIT-AI", name: "KI-Team", children: [] }]
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
        const path = url.searchParams.getAll("path");
        if (path.length === 0) {
            return HttpResponse.json(DIRECTORY_TREE);
        }
        const node = findNode(path);
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
                        const reply = buildChatMessage();
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
                temperature: body.temperature ?? current.latest_version.temperature,
                max_output_tokens: body.max_output_tokens || current.latest_version.max_output_tokens,
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
    })
];
