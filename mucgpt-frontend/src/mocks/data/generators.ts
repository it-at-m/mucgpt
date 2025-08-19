// Utility generators for mock data (no external libs)
import { AssistantCreateResponse } from "../../api";

const adjectives = ["Smart", "Agile", "Clever", "Helpful", "Trusted", "Adaptive", "Efficient", "Express", "Secure", "Eco"];
const domains = ["Docs", "Mail", "Code", "Policy", "Legal", "Finance", "HR", "Support", "Data", "Research"];
const roles = ["Assistant", "Agent", "Bot", "Helper", "Advisor", "Companion"];

export function randomOf<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

export function randomName() {
    return `${randomOf(adjectives)}${randomOf(domains)}${randomOf(roles)}`;
}

export function randomSentence(): string {
    const openings = ["This module", "The assistant", "The solution", "This service", "The system", "This component", "Your overly enthusiastic bot"];
    const verbs = ["analyzes", "optimizes", "supports", "monitors", "documents", "accelerates", "simplifies", "refactors quietly"];
    const objects = [
        "real-time processes",
        "complex inputs",
        "daily tasks",
        "knowledge lookups",
        "workflow decisions",
        "answer generation",
        "text simplification",
        "caffeine-free thinking cycles"
    ];
    const tails = [
        "– with 0% organic matter.",
        "and does not require coffee (yet).",
        "while maintaining simulated optimism.",
        "without forgetting your password (I hope).",
        "and only logs the essential bits.",
        "– style points included.",
        "(debug mode currently: friendly)."
    ];
    return `${randomOf(openings)} ${randomOf(verbs)} ${randomOf(objects)} ${randomOf(tails)}`;
}

export function randomParagraph(lines = 2): string {
    return Array.from({ length: lines })
        .map(() => randomSentence())
        .join(" ");
}

export function buildAssistant(): AssistantCreateResponse {
    const name = randomName();
    const id = `assistant-${Math.random().toString(36).slice(2, 9)}`;
    const versionId = `version-${Math.random().toString(36).slice(2, 9)}`;
    const created = new Date().toISOString();
    return {
        id,
        created_at: created,
        updated_at: created,
        hierarchical_access: ["IT", "IT-KI"],
        owner_ids: ["user-mock-456"],
        latest_version: {
            id: versionId,
            version: 1,
            created_at: created,
            name,
            description: randomParagraph(3),
            system_prompt: `You are ${name}. ${randomSentence()} Antworte strukturiert und prägnant.`,
            hierarchical_access: ["IT", "IT-KI"],
            temperature: +(Math.random() * 1).toFixed(1),
            max_output_tokens: 4000,
            is_visible: true,
            tools: [
                { id: "brainstorm", config: { enabled: Math.random() > 0.3 } },
                { id: "simplify", config: { enabled: Math.random() > 0.5 } }
            ],
            owner_ids: ["user-mock-456"],
            examples: [
                { text: "Was kannst du?", value: randomSentence() },
                { text: "Fasse ein Dokument zusammen", value: randomSentence() }
            ],
            quick_prompts: [
                { label: "Begrüßung", prompt: "Hallo! Wie kann ich helfen?", tooltip: "Standard Begrüßung" },
                { label: "Zusammenfassen", prompt: "Bitte fasse den Text oben in 3 Sätzen zusammen.", tooltip: "TL;DR" }
            ],
            tags: ["mock", "dynamic", randomOf(["beta", "prod", "lab"])]
        }
    };
}

// Creative generators for mock data

const creativeAdjectives = ["Innovative", "Efficient", "Creative", "Dynamic", "Intelligent", "Automated", "Friendly", "Reliable", "Agile", "Smart"];
const creativeDomains = ["E-Mail", "Document", "Task", "Data", "Support", "Translation", "Calendar", "Research", "Knowledge", "Workflow"];
const nouns = ["Assistant", "Helper", "Bot", "Agent", "System", "Tool"];

export function buildAssistantName() {
    return `${randomOf(creativeAdjectives)} ${randomOf(creativeDomains)}-${randomOf(nouns)}`;
}

export function buildAssistantDescription(name?: string) {
    return `The assistant ${name || buildAssistantName()} is a versatile AI helper designed to streamline workflows and boost productivity. It interprets requests, handles context, and returns concise, structured answers – with mild robot charm.`;
}

export function buildChatMessage() {
    const messages = [
        "Hello human! How may I assist? (Mock output, genuine synthetic warmth 🤖)",
        "Greetings! I am your helper unit. What task shall we process today?",
        "Simulated response active. You may ask about documents, ideas, or intergalactic snacks.",
        "Ready. Buffered. Slightly over-indexed on helpfulness. Proceed with input.",
        "I can pretend I already solved three tickets. Feed me a fourth.",
        "Reminder: I am a mock. Extended reminder: I still try to be delightful.",
        "Boot sequence complete. Jokes module: experimental. Ask away!"
    ];
    return randomOf(messages);
}

export function buildAssistantCreateResponse(overrides: Partial<AssistantCreateResponse> = {}): AssistantCreateResponse {
    const name = overrides.latest_version?.name || buildAssistantName();
    const description = overrides.latest_version?.description || buildAssistantDescription(name);
    const base: AssistantCreateResponse = {
        id: overrides.id || `assistant-mock-${Math.random().toString(36).slice(2, 10)}`,
        created_at: overrides.created_at || new Date().toISOString(),
        updated_at: overrides.updated_at || new Date().toISOString(),
        hierarchical_access: overrides.hierarchical_access || ["IT", randomOf(["IT-KI", "IT-Entwicklung", "IT-Support"])],
        owner_ids: overrides.owner_ids || [`user-mock-${Math.random().toString(36).slice(2, 10)}`],
        latest_version: {
            id: overrides.latest_version?.id || `version-${Math.random().toString(36).slice(2, 8)}`,
            version: overrides.latest_version?.version || 1,
            created_at: overrides.latest_version?.created_at || new Date().toISOString(),
            name,
            description,
            system_prompt: overrides.latest_version?.system_prompt || `You are the ${name}. Provide excellent, clear, and structured assistance.`,
            hierarchical_access: overrides.latest_version?.hierarchical_access || ["IT", "IT-KI"],
            temperature: overrides.latest_version?.temperature ?? Number((Math.random() * 1.5).toFixed(2)),
            max_output_tokens: overrides.latest_version?.max_output_tokens || 4000,
            is_visible: overrides.latest_version?.is_visible !== undefined ? overrides.latest_version.is_visible : true,
            tools: overrides.latest_version?.tools || [
                { id: "Brainstorming", config: { enabled: Math.random() > 0.4 } },
                { id: "Vereinfachen", config: { enabled: Math.random() > 0.6 } }
            ],
            owner_ids: overrides.latest_version?.owner_ids || [`user-mock-${Math.random().toString(36).slice(2, 10)}`],
            examples: overrides.latest_version?.examples || [
                {
                    text: "Kannst du mir bei einem Dokument helfen?",
                    value: "Ja, ich kann Dokumente analysieren, zusammenfassen oder dir helfen, Inhalte neu zu formulieren. Lade es einfach hoch oder füge den Text hier ein."
                }
            ],
            quick_prompts: overrides.latest_version?.quick_prompts || [
                { label: "Begrüßung", prompt: "Hallo! Wobei kann ich heute unterstützen?", tooltip: "Freundliche Begrüßung" },
                { label: "Zusammenfassen", prompt: "Fasse den Text bitte kurz und verständlich zusammen.", tooltip: "Kurze Zusammenfassung" }
            ],
            tags: overrides.latest_version?.tags || ["mock", "assistant", randomOf(["docs", "email", "workflow", "research"])]
        }
    };
    return base;
}

export function buildAssistantList(count = 5): AssistantCreateResponse[] {
    return Array.from({ length: count }, () => buildAssistantCreateResponse());
}

// ---------------- Streaming Generators ----------------

function wordChunksFromMessage(message: string) {
    const words = message.split(/(\s+)/).filter(w => w.length > 0);
    return words.map(w => ({
        id: `chatcmpl-mock-${Math.random().toString(36).slice(2, 8)}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [{ index: 0, delta: { content: w }, finish_reason: null }]
    }));
}

export function generateChatStreamChunks(finalMessage: string) {
    const base = wordChunksFromMessage(finalMessage);
    base.push({
        id: `chatcmpl-mock-${Math.random().toString(36).slice(2, 8)}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [{ index: 0, delta: { content: "" }, finish_reason: null }]
    });
    base.push({
        id: `chatcmpl-mock-${Math.random().toString(36).slice(2, 8)}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [{ index: 0, delta: { content: "" }, finish_reason: "stop" as any }]
    });
    return base;
}

export function generateMindmapStreamChunks(topic: string) {
    const t = topic || "Artificial Intelligence";
    const chunks: any[] = [];

    const humorousAside = [
        "(Rendering conceptual nodes in glorious plain text)",
        "(Mindmap mode engaged. Virtual markers uncapped.)",
        "(Warming up structural circuits…)",
        "(Untangling thought threads 🧠)",
        "(Evicting redundant buzzwords)",
        "(Simulating neurons responsibly)",
        "(Root node stabilized)",
        "(ASCII arborist operational)"
    ];

    const layerPool = {
        high: ["Foundations", "Concepts", "Applications", "Trends", "Opportunities", "Risks"],
        mid: ["Models", "Algorithms", "Architectures", "Evaluation", "Optimization"],
        low: ["Regularization", "Hyperparameters", "Data Quality", "Scalability", "Deployment"],
        apps: ["Image Analysis", "NLP", "Recommendations", "Anomaly Detection", "Forecasting", "Agents", "Automation"],
        fun: ["Snack Break Optimization", "Coffee Consistency", "Meeting Deduplicator", "Bug Oracle", "Documentation Whisperer"]
    };

    function pickSome(arr: string[], min: number, max: number) {
        const count = Math.min(arr.length, Math.max(min, Math.floor(Math.random() * (max - min + 1)) + min));
        const clone = [...arr];
        const out: string[] = [];
        while (out.length < count && clone.length) {
            out.push(clone.splice(Math.floor(Math.random() * clone.length), 1)[0]);
        }
        return out;
    }

    const high = pickSome(layerPool.high, 3, 5);
    const mid = pickSome(layerPool.mid, 3, 5);
    const low = pickSome(layerPool.low, 3, 5);
    const apps = pickSome(layerPool.apps, 3, 6);
    const fun = Math.random() > 0.6 ? pickSome(layerPool.fun, 1, 2) : [];

    const pushTool = (state: string, content: string, metadata: any = {}) => {
        chunks.push({
            id: `chatcmpl-mindmap-${Math.random().toString(36).slice(2, 8)}`,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: "KICCGPT",
            choices: [{ index: 0, delta: { tool_calls: [{ name: "Brainstorming", state, content, metadata }] }, finish_reason: null }]
        });
    };

    pushTool("STARTED", `Initializing mindmap for '${t}' ${randomOf(humorousAside)}`);
    pushTool("APPEND", `# ${t}\n\n`);
    high.forEach(h => pushTool("APPEND", `## ${h} \n\n`));
    mid.forEach(m => pushTool("APPEND", `### ${m} \n\n`));
    low.forEach(l => pushTool("APPEND", `- ${l} \n`));
    pushTool("APPEND", `\n## Use Cases \n\n`);
    apps.forEach(a => pushTool("APPEND", `- ${a} \n`));
    if (fun.length) {
        pushTool("APPEND", `\n## Fun / Meta \n\n`);
        fun.forEach(f => pushTool("APPEND", `- ${f} \n`));
    }

    const consolidated =
        `# ${t}\n\n` +
        high
            .map(
                h =>
                    `## ${h}\n` +
                    (Math.random() > 0.5
                        ? mid
                              .slice(0, 2)
                              .map(m => `- ${m}`)
                              .join("\n") + "\n"
                        : "")
            )
            .join("\n") +
        `\n## Use Cases\n` +
        apps.map(a => `- ${a}`).join("\n") +
        (fun.length ? `\n\n## Fun / Meta\n` + fun.map(f => `- ${f}`).join("\n") : "") +
        `\n\n(Consolidated view – structure stabilized.)`;
    pushTool("UPDATE", consolidated);
    pushTool("ENDED", `Mindmap for '${t}' completed – no colored markers required.`);

    chunks.push({
        id: `chatcmpl-mindmap-${Math.random().toString(36).slice(2, 8)}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [{ index: 0, delta: { content: "Your mindmap is ready! (Adaptive ASCII edition)" }, finish_reason: null }]
    });
    chunks.push({
        id: `chatcmpl-mindmap-${Math.random().toString(36).slice(2, 8)}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [{ index: 0, delta: { content: "" }, finish_reason: "stop" as any }]
    });
    return chunks;
}

export function generateSimplifyStreamChunks() {
    const chunks: any[] = [];
    const push = (state: string, content: string, metadata: any = {}) => {
        chunks.push({
            id: `chatcmpl-simplify-${Math.random().toString(36).slice(2, 8)}`,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: "KICCGPT",
            choices: [{ index: 0, delta: { tool_calls: [{ name: "Simplify", state, content, metadata }] }, finish_reason: null }]
        });
    };

    const introPool = [
        "On Sundays and public holidays most people should have a day off.",
        "Sundays and official holidays are usually rest days.",
        "Public holidays and Sundays are normally work-free.",
        "These days are intended for rest, not regular work."
    ];
    const allowPool = [
        "In special cases work is allowed.",
        "Sometimes work may still happen.",
        "There are exceptions where working is okay.",
        "Certain situations permit necessary work."
    ];
    const examplesPool = [
        "Emergency services",
        "Hospitals",
        "Fire department",
        "Police",
        "Hotels",
        "Public events",
        "Power supply",
        "Agriculture",
        "Cleaning staff",
        "Research labs",
        "Bakeries",
        "Food production",
        "Security staff"
    ];

    function pickList(base: string[], min: number, max: number) {
        const count = Math.min(base.length, Math.floor(Math.random() * (max - min + 1)) + min);
        const clone = [...base];
        const out: string[] = [];
        while (out.length < count && clone.length) {
            out.push(clone.splice(Math.floor(Math.random() * clone.length), 1)[0]);
        }
        return out;
    }

    const intro = randomOf(introPool);
    const allow = randomOf(allowPool);
    const examples = pickList(examplesPool, 6, 10);
    const revCount = Math.floor(Math.random() * 3) + 3;

    push("STARTED", "Initiating simplification protocol... (detangling jargon)");
    push("APPEND", "Generating initial simplified draft...");
    push("APPEND", "\n\n<einfachesprache>\n\n"); // keep tag for frontend compatibility
    push("APPEND", intro + "  \n\n");
    push("APPEND", allow + "  \n\n");
    push("APPEND", "Here are examples:  \n\n");
    examples.slice(0, Math.floor(examples.length / 2)).forEach(e => push("APPEND", `- ${e}  \n`));

    const fullList = examples.map(e => `- ${e}`).join("\n");
    const updateBody = `<einfachesprache>\n\n${intro}\n\n${allow}\n\nHere are examples:\n\n${fullList}\n\nSometimes others may also work if it is important.\n\n</einfachesprache>`;
    push("UPDATE", updateBody);

    for (let i = 1; i <= revCount; i++) {
        push("APPEND", `\n\n**Revision #${i}: Reviewing clarity...**`);
        if (Math.random() > 0.4) {
            push("APPEND", `\nℹ️ Found wording to simplify (iteration ${i}).`);
        }
        if (Math.random() > 0.7) {
            push("APPEND", `\n🔍 Removing redundancy (iteration ${i}).`);
        }
    }
    push("APPEND", "\n\n✅ Simplification complete! (No sentences were harmed.)");
    push("ENDED", "Text converted to easy language – variability enabled.");

    chunks.push({
        id: `chatcmpl-simplify-${Math.random().toString(36).slice(2, 8)}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [{ index: 0, delta: { content: "Simplification finished." }, finish_reason: null }]
    });
    chunks.push({
        id: `chatcmpl-simplify-${Math.random().toString(36).slice(2, 8)}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KICCGPT",
        choices: [{ index: 0, delta: { content: "" }, finish_reason: "stop" as any }]
    });
    return chunks;
}
