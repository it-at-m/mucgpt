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
    env_name: "MUCGPT",
    alternative_logo: false,
    version: "FRONTEND DEMO 1.0.0",
    commit: "152b175"
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
    http.post("/api/assistant/create", async ({ request }) => {
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
    })
];
