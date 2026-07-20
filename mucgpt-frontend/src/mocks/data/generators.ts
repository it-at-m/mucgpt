// Utility generators for mock data (no external libs)
import { AssistantCreateResponse, OwnerDetailsResponse } from "../../api";
import { CREATIVITY_HIGH, CREATIVITY_LOW, CREATIVITY_MEDIUM } from "../../constants";

const adjectives = ["Smart", "Agile", "Clever", "Helpful", "Trusted", "Adaptive", "Efficient", "Express", "Secure", "Eco"];
const domains = ["Docs", "Mail", "Code", "Policy", "Legal", "Finance", "HR", "Support", "Data", "Research"];
const roles = ["Assistant", "Agent", "Bot", "Helper", "Advisor", "Companion"];

const MOCK_OWNER_DIRECTORY: Record<string, OwnerDetailsResponse> = {
    "111160470": {
        user_id: "111160470",
        username: "Michael Jaumann",
        contact_address: "michael.jaumann@muenchen.de",
        givenName: "Michael",
        sn: "Jaumann",
        mail: "michael.jaumann@muenchen.de",
        organizationalunit: "ITM-SLP43"
    },
    "user-mock-001": {
        user_id: "user-mock-001",
        username: "Mia Sommer",
        contact_address: "mia.sommer@muenchen.de",
        givenName: "Mia",
        sn: "Sommer",
        mail: "mia.sommer@muenchen.de",
        organizationalunit: "ITM-KM-DI"
    },
    "user-mock-002": {
        user_id: "user-mock-002",
        username: "Lukas Winter",
        contact_address: "lukas.winter@muenchen.de",
        givenName: "Lukas",
        sn: "Winter",
        mail: "lukas.winter@muenchen.de",
        organizationalunit: "POR-O"
    },
    "user-mock-003": {
        user_id: "user-mock-003",
        username: "Sara Neumann",
        contact_address: "sara.neumann@muenchen.de",
        givenName: "Sara",
        sn: "Neumann",
        mail: "sara.neumann@muenchen.de",
        organizationalunit: "POR-P"
    },
    "user-mock-123": {
        user_id: "user-mock-123",
        username: "Max Mustermann",
        contact_address: "max.mustermann@muenchen.de",
        givenName: "Max",
        sn: "Mustermann",
        mail: "max.mustermann@muenchen.de",
        organizationalunit: "RIT-AI"
    }
};

export function randomOf<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

export function buildOwnersDetailedFromOwnerIds(ownerIds: string[] | undefined): OwnerDetailsResponse[] {
    if (!ownerIds?.length) return [];

    // Match backend behavior: unresolved owners are omitted instead of returning UUID placeholders.
    return ownerIds.map(ownerId => MOCK_OWNER_DIRECTORY[ownerId]).filter((owner): owner is OwnerDetailsResponse => Boolean(owner));
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
    const ownerIds = ["user-mock-123"];
    return {
        id,
        created_at: created,
        updated_at: created,
        hierarchical_access: ["POR-O"],
        owner_ids: ownerIds,
        owners_detailed: buildOwnersDetailedFromOwnerIds(ownerIds),
        latest_version: {
            id: versionId,
            version: 1,
            created_at: created,
            name,
            description: randomParagraph(3),
            system_prompt: `You are ${name}. ${randomSentence()} Antworte strukturiert und prägnant.`,
            hierarchical_access: ["POR-O"],
            creativity: randomOf([CREATIVITY_LOW, CREATIVITY_MEDIUM, CREATIVITY_HIGH]),
            default_model: undefined,
            is_visible: true,
            tools: [
                { id: "brainstorm", config: { enabled: Math.random() > 0.3 } },
                { id: "simplify", config: { enabled: Math.random() > 0.5 } }
            ],
            owner_ids: ownerIds,
            owners_detailed: buildOwnersDetailedFromOwnerIds(ownerIds),
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

/** Assistant reply with a draw.io fence — E2E check for reviewers (no Mermaid equivalent exists). */
export function buildDrawioChatMessage() {
    return [
        "Hier ist ein Beispiel-Flowchart als draw.io-Diagramm (Mock):",
        "",
        "```drawio",
        '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" value="Start" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1"><mxGeometry x="120" y="40" width="120" height="40" as="geometry"/></mxCell><mxCell id="3" value="Decision?" style="rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;" vertex="1" parent="1"><mxGeometry x="120" y="120" width="120" height="80" as="geometry"/></mxCell><mxCell id="4" value="Yes" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="1"><mxGeometry x="40" y="240" width="100" height="40" as="geometry"/></mxCell><mxCell id="5" value="No" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;" vertex="1" parent="1"><mxGeometry x="220" y="240" width="100" height="40" as="geometry"/></mxCell><mxCell id="6" edge="1" parent="1" source="2" target="3"><mxGeometry relative="1" as="geometry"/></mxCell><mxCell id="7" value="Yes" edge="1" parent="1" source="3" target="4"><mxGeometry relative="1" as="geometry"/></mxCell><mxCell id="8" value="No" edge="1" parent="1" source="3" target="5"><mxGeometry relative="1" as="geometry"/></mxCell></root></mxGraphModel>',
        "```"
    ].join("\n");
}

export function buildAssistantCreateResponse(overrides: Partial<AssistantCreateResponse> = {}): AssistantCreateResponse {
    const name = overrides.latest_version?.name || buildAssistantName();
    const description = overrides.latest_version?.description || buildAssistantDescription(name);
    const ownerIds = overrides.owner_ids || [`user-mock-${Math.random().toString(36).slice(2, 10)}`];
    const versionOwnerIds = overrides.latest_version?.owner_ids || ownerIds;
    const base: AssistantCreateResponse = {
        id: overrides.id || `assistant-mock-${Math.random().toString(36).slice(2, 10)}`,
        created_at: overrides.created_at || new Date().toISOString(),
        updated_at: overrides.updated_at || new Date().toISOString(),
        hierarchical_access: overrides.hierarchical_access || ["BAU", randomOf(["ITM-KM", "ITM-KM-DI", "RIT"])],
        owner_ids: ownerIds,
        owners_detailed: overrides.owners_detailed || buildOwnersDetailedFromOwnerIds(ownerIds),
        latest_version: {
            id: overrides.latest_version?.id || `version-${Math.random().toString(36).slice(2, 8)}`,
            version: overrides.latest_version?.version || 1,
            created_at: overrides.latest_version?.created_at || new Date().toISOString(),
            name,
            description,
            system_prompt: overrides.latest_version?.system_prompt || `You are the ${name}. Provide excellent, clear, and structured assistance.`,
            hierarchical_access: overrides.latest_version?.hierarchical_access || ["ITM"],
            creativity: overrides.latest_version?.creativity ?? randomOf([CREATIVITY_LOW, CREATIVITY_MEDIUM, CREATIVITY_HIGH]),
            default_model: overrides.latest_version?.default_model,
            is_visible: overrides.latest_version?.is_visible !== undefined ? overrides.latest_version.is_visible : true,
            tools: overrides.latest_version?.tools || [
                { id: "Brainstorming", config: { enabled: Math.random() > 0.4 } },
                { id: "Vereinfachen", config: { enabled: Math.random() > 0.6 } }
            ],
            owner_ids: versionOwnerIds,
            owners_detailed: overrides.latest_version?.owners_detailed || buildOwnersDetailedFromOwnerIds(versionOwnerIds),
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
        model: "KIESGPT",
        choices: [{ index: 0, delta: { content: w }, finish_reason: null }]
    }));
}

export function generateChatStreamChunks(finalMessage: string) {
    const base = wordChunksFromMessage(finalMessage);
    base.push({
        id: `chatcmpl-mock-${Math.random().toString(36).slice(2, 8)}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KIESGPT",
        choices: [{ index: 0, delta: { content: "" }, finish_reason: null }]
    });
    base.push({
        id: `chatcmpl-mock-${Math.random().toString(36).slice(2, 8)}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KIESGPT",
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
            model: "KIESGPT",
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
        model: "KIESGPT",
        choices: [{ index: 0, delta: { content: "Your mindmap is ready! (Adaptive ASCII edition)" }, finish_reason: null }]
    });
    chunks.push({
        id: `chatcmpl-mindmap-${Math.random().toString(36).slice(2, 8)}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KIESGPT",
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
            model: "KIESGPT",
            choices: [{ index: 0, delta: { tool_calls: [{ name: "Simplify", state, content, metadata }] }, finish_reason: null }]
        });
    };

    // Align mock with backend: sections with content (Generate -> Critique -> [Refine -> Critique] x2)
    push("STARTED", "**Vereinfachungsprozess gestartet.**");

    const revisionTags = ["0", "1", "2"]; // match provided example revisions

    // Generate section with provided example text
    push(
        "APPEND",
        `<SIMPLIFY_GENERATE revision=${revisionTags[0]}>Ansprache an die Bürger und Mitarbeiter in München\n\nLiebe Bürger und Bürgerinnen von München.\n\nLiebe Mitarbeiter und Mitarbeiterinnen von der Stadt-Verwaltung.\n\nIch spreche heute zu Ihnen.\n\nIch freue mich sehr.\n\nIch bin Ihnen sehr dankbar.\n\nSie arbeiten jeden Tag sehr viel für München.\n\nSie geben sich viel Mühe.\n\nSie wollen immer alles sehr gut machen.\n\nDas ist sehr wichtig für uns alle.\n\nSo geht es München gut.\n\nSo gibt es in München viele schöne Dinge.\n\nSie machen München zu einer besonderen Stadt.\n\nMünchen ist lebendig und schön.\n\nMünchen hat eine gute Zukunft.\n\nIch bin sehr stolz auf Sie.\n\nIch finde Ihre Arbeit sehr gut.\n\nUnsere Schlösser in München sind sehr bekannt und schön.\n\nIch möchte, dass München noch schöner wird.\n\nIch wünsche mir ein neues, großes Schloss.\n\nDas Schloss soll sehr besonders sein.\n\nDas Schloss soll schöner als alle anderen sein.\n\nDas Schloss soll zeigen, wie schön München ist.\n\nDas Schloss soll zeigen, wie wichtig Kunst und Kultur für uns sind.\n\nDas neue Schloss soll auch für die Zukunft wichtig sein.\n\nWir bauen das Schloss zusammen.\n\nSie haben viel Erfahrung.\n\nSie sind begeistert von Ihrer Arbeit.\n\nIch weiß: Sie schaffen das.\n\nSo wird München noch schöner.\n\nIch danke Ihnen sehr für Ihre Arbeit.\n\nIch vertraue Ihnen.\n\nIch weiß, Sie können das Ziel erreichen.\n\nMit besten Grüßen,\n\nIhr Ludwig der Zweite</SIMPLIFY_GENERATE>`
    );

    // Initial critique
    push(
        "APPEND",
        `<SIMPLIFY_CRITIQUE revision=${revisionTags[0]}>Critique:\n\n1. Überschrift ist zu allgemein. Es fehlen klare, kurze Überschriften für Abschnitte (Regel 4).\n\n2. Es gibt keine inhaltliche Gliederung in sinnvolle Abschnitte mit eigenen Überschriften (Regel 4).\n\n3. Die Anrede „Liebe Bürger und Bürgerinnen von München. Liebe Mitarbeiter und Mitarbeiterinnen von der Stadt-Verwaltung.“ steht ohne erklärende Überschrift oder Einleitung (Regel 4).\n\n4. Einige Sätze sind unnötig inhaltlich doppelt:\n   - „Sie arbeiten jeden Tag sehr viel für München. Sie geben sich viel Mühe. Sie wollen immer alles sehr gut machen." \n   Diese Sätze könnten in einer Liste zusammengefasst werden (Regel 4: Listen nutzen).\n\n5. Der Satz „So gibt es in München viele schöne Dinge." ist inhaltlich vage und nicht anschaulich (Regel 2.1: anschauliche, konkrete Sprache).\n\n6. Die Formulierung „Sie machen München zu einer besonderen Stadt." und „München ist lebendig und schön." sind sprachlich zu abstrakt und wenig anschaulich (Regel 2.1).\n\n7. Der Satz „Unsere Schlösser in München sind sehr bekannt und schön." ist zwar einfach, aber „bekannt" ist kein Grundwortschatz und könnte erklärt werden (Regel 2.1 und 2.2).\n\n8. Der Satz „Das Schloss soll zeigen, wie wichtig Kunst und Kultur für uns sind." verwendet „Kunst" und „Kultur", beides sind keine Alltagswörter und sollten erklärt werden (Regel 2.1 und 2.2).\n\n9. „Das neue Schloss soll auch für die Zukunft wichtig sein." – „Zukunft" ist abstrakt und sollte ggf. erklärt werden (Regel 2.1 und 2.2).\n\n10. Der Satz „Sie sind begeistert von Ihrer Arbeit." verwendet „begeistert", was kein Grundwortschatz ist. Besser wäre: „Sie arbeiten sehr gern." (Regel 2.1).\n\n11. Der Satz „Ich weiß: Sie schaffen das." ist korrekt, aber „schaffen" kann im Kontext mehrdeutig sein und sollte ggf. erklärt werden (Regel 2.1 und 2.2).\n\n12. Die Sätze „Ich vertraue Ihnen." und „Ich weiß, Sie können das Ziel erreichen." verwenden „vertrauen" und „Ziel erreichen". Beide Begriffe sind abstrakt und sollten mit einfachen Worten erklärt werden (Regel 2.1 und 2.2).\n\n13. Die Abschlussformel „Ihr Ludwig der Zweite" verwendet keine arabische Ziffer wie vorgeschrieben („Ludwig 2.") (Regel 2.5).\n\n14. Es fehlen Hervorhebungen von wichtigen Begriffen oder Erklärungen (Regel 2.2, 5).\n\n15. Die Satzlänge ist meist korrekt, aber einige Sätze enthalten mehr als eine Aussage (z. B. „München ist lebendig und schön." → 2 Aussagen) (Regel 3).\n\n16. Es werden keine Aufzählungen oder Listen genutzt, obwohl sich der Inhalt dafür anbietet (Regel 4).\n\n17. Es werden keine Fettdruck-Hervorhebungen genutzt (Regel 5).\n\n18. Die Textstruktur ist ein reiner Fließtext und nicht optimal strukturiert für Leichte Sprache (Regel 4, 5).\n\n19. Die Begriffe „Stadt-Verwaltung" und „Schloss" werden nicht erklärt (Regel 2.2).\n\n20. „Kunst" und „Kultur" werden nicht erklärt (Regel 2.2).\n\nZusammenfassung: \nDer Text ist grundsätzlich einfach und verständlich. Es gibt jedoch viele kleinere Regelverstöße, insbesondere fehlende Erklärungen von schwierigen Wörtern, fehlende Abschnitte und Überschriften sowie das Fehlen von Listen und Hervorhebungen. Die Abschlussformel verwendet keine arabische Ziffer. Insgesamt ist der Text nicht ausreichend nach den Regeln für Leichte Sprache gestaltet.</SIMPLIFY_CRITIQUE>`
    );
    push("APPEND", "**Ergebnis:** Qualitätsprobleme erkannt. Text wird überarbeitet.");

    // First refine
    push(
        "APPEND",
        `<SIMPLIFY_REFINE revision=${revisionTags[1]}>**Ansprache von Ludwig 2.**\n\n---\n\n**An wen ist der Text?**\n\nAn alle Bürger und Bürgerinnen von München.\n\nAn alle Mitarbeiter und Mitarbeiterinnen von der Stadt-Verwaltung.\n\n*Stadt-Verwaltung* bedeutet:  \nDie Stadt-Verwaltung macht Regeln und organisiert viele Dinge in der Stadt.\n\n---\n\n**Dank an alle Menschen in München**\n\nIch spreche heute zu Ihnen.\n\nIch sage:  \nDanke an Sie alle.\n\nSie arbeiten jeden Tag für München.\n\nSie machen viele wichtige Dinge.  \nZum Beispiel:\n\n- Sie helfen anderen Menschen.  \n- Sie sorgen dafür, dass die Straßen sauber sind.  \n- Sie passen auf die Gebäude auf.  \n- Sie kümmern sich um die Parks.  \n- Sie beraten Menschen im Rathaus.\n\nIch finde Ihre Arbeit sehr gut.\n\nSie geben sich viel Mühe.\n\nDas ist wichtig für München.\n\n---\n\n**München ist eine besondere Stadt**\n\nDurch Ihre Arbeit geht es München gut.\n\nIn München gibt es viele schöne Dinge.  \nZum Beispiel:\n\n- große Parks  \n- alte Gebäude  \n- viele Veranstaltungen\n\nMünchen ist besonders.  \nDas heißt: München ist anders als andere Städte.\n\nMünchen ist lebendig.  \nDas heißt: In München ist viel los.  \nMenschen treffen sich und erleben viel.\n\nMünchen ist schön.  \nEs gibt viele Blumen, Bäume und schöne Häuser.\n\nIch bin stolz auf Sie alle.\n\n---\n\n**Die Schlösser in München**\n\nIn München gibt es mehrere Schlösser.\n\nEin *Schloss* ist ein großes, schönes Haus.  \nFrüher haben dort Könige und Königinnen gewohnt.\n\nDie Schlösser in München sind bekannt.  \nDas heißt: Viele Menschen kennen die Schlösser.  \nViele Menschen besuchen die Schlösser.\n\nDie Schlösser sind sehr schön.\n\n---\n\n**Ein neues Schloss für München**\n\nIch wünsche mir ein neues, großes Schloss.\n\nDas neue Schloss soll besonders schön sein.\n\nEs soll zeigen, wie schön München ist.\n\nDas Schloss soll zeigen, wie wichtig *Kunst* und *Kultur* für uns sind.\n\n*Kunst* ist zum Beispiel:  \n- Bilder  \n- Musik  \n- Theater\n\n*Kultur* ist zum Beispiel:  \n- Feste  \n- Traditionen  \n- besondere Bräuche in München\n\nDas neue Schloss soll auch für die Zukunft wichtig sein.\n\n*Zukunft* bedeutet: Die Zeit, die noch kommt.\n\n---\n\n**Gemeinsam das Schloss bauen**\n\nWir bauen das Schloss zusammen.\n\nSie haben viel Erfahrung.  \nDas heißt: Sie wissen, wie man gut arbeitet.\n\nSie arbeiten sehr gern.\n\nIch glaube an Sie.\n\nDas heißt: Ich bin mir sicher, Sie schaffen das.\n\n*schaffen* bedeutet: Sie können das gut machen.\n\nSo wird München noch schöner.\n\n---\n\n**Mein Dank am Schluss**\n\nDanke für Ihre Arbeit.\n\nIch glaube an Sie.\n\nDas heißt: Ich bin mir sicher, Sie schaffen unser Ziel.\n\n*Ziel* bedeutet:  \nDas, was wir gemeinsam erreichen wollen.\n\n---\n\nMit besten Grüßen\n\nIhr Ludwig 2.</SIMPLIFY_REFINE>`
    );

    // Critique after first refine
    push(
        "APPEND",
        `<SIMPLIFY_CRITIQUE revision=${revisionTags[1]}>**Kritikpunkt für den Text in Leichter Sprache:**\n\n1. **Zahlen und Zählweise**\n   - „Ludwig 2." sollte „Ludwig 2" geschrieben werden. Es ist korrekt, dass arabische Ziffern genutzt werden, aber „2." als Abkürzung für „Zweiter" ist nicht Leichte Sprache. Besser: „Ludwig der Zweite" (falls nötig, erklären).\n2. **Satzlänge**\n   - „Sie passen auf die Gebäude auf." und „Sie kümmern sich um die Parks." sind korrekt.\n   - Einige Sätze sind zu lang, zum Beispiel:  \n     - „Das heißt: Sie wissen, wie man gut arbeitet." (14 Wörter, noch akzeptabel, aber nah an der Grenze.)\n     - „Das heißt: Ich bin mir sicher, Sie schaffen das." (13 Wörter, noch akzeptabel, aber sehr lang.)\n     - „Das heißt: Das, was wir gemeinsam erreichen wollen." (8 Wörter, korrekt.)\n   - Die meisten Sätze sind kurz genug.\n3. **Satzstruktur**\n   - Keine Passiv-Konstruktionen gefunden.\n   - Nebensätze werden meist vermieden, Ausnahme:  \n     - „Das heißt: Die Zeit, die noch kommt." (Nebensatz, aber grammatisch einfach.)\n4. **Wortwahl**\n   - „Stadt-Verwaltung", „Kunst", „Kultur", „Traditionen", „Bräuche", „Zukunft", „Erfahrung", „Ziel" werden erklärt, was gut ist.\n   - „besonderes"/„besonders" wird mehrfach genutzt, aber ist allgemeinverständlich.\n   - „Meisterwerk" aus dem Original wurde korrekt vermieden.\n   - „Errungenschaften" aus dem Original wird nicht übernommen, das ist gut.\n   - „noble Ziel" aus dem Original wurde weggelassen, das ist in Leichter Sprache besser.\n   - Das Wort „Schloss" wird erklärt.\n5. **Metaphern/Bildsprache**\n   - Keine Metaphern, Ironien oder bildhafte Sprache im Text.\n6. **Abschnitte und Überschriften**\n   - Gute Gliederung mit vielen Überschriften.\n7. **Typografie**\n   - Gliederung ist übersichtlich.\n   - Fettdruck wird sparsam und korrekt eingesetzt.\n8. **Erklärung von Fachbegriffen**\n   - Alle schwierigen Begriffe werden erklärt.\n9. **Direkte Ansprache**\n   - Die Leser werden direkt angesprochen („Ich danke Ihnen.", „Sie arbeiten...").\n10. **Synonyme**\n    - Begriffe werden konsistent verwendet.\n11. **Reihenfolge der Informationen**\n    - Die Reihenfolge ist klar und folgt dem Originaltext.\n12. **Keine URLs oder Links**\n    - Es gibt keine Links im Text.\n\n**Fazit:**\n- Der Text hält sich fast vollständig an die Regeln der Leichten Sprache.\n- Die wenigen längeren Sätze liegen noch im erlaubten Rahmen, könnten aber notfalls noch weiter vereinfacht werden.\n- Die Formulierung „Ludwig 2." könnte für die Zielgruppe unklar sein. Besser: „Ludwig der Zweite".\n\n**Insgesamt:**  \nSehr wenige, kleine Verstöße. Der Text ist fast regelkonform.\n\n**Empfehlung:**  \n- „Ludwig 2." ersetzen durch „Ludwig der Zweite".\n- Lange Sätze, die nah an 15 Wörtern sind, überprüfen und ggf. weiter kürzen.\n\n**Ansonsten:**  \nKeine weiteren Probleme gefunden.</SIMPLIFY_CRITIQUE>`
    );
    push("APPEND", "**Ergebnis:** Qualitätsprobleme erkannt. Text wird überarbeitet.");

    // Second refine
    push(
        "APPEND",
        `<SIMPLIFY_REFINE revision=${revisionTags[2]}>**Ansprache von Ludwig der Zweite**\n\n---\n\n**An wen ist der Text?**\n\nAn alle Bürger und Bürgerinnen von München.\n\nAn alle Mitarbeiter und Mitarbeiterinnen von der Stadt-Verwaltung.\n\n*Stadt-Verwaltung* bedeutet:  \nDie Stadt-Verwaltung macht Regeln.  \nSie organisiert viele Dinge in der Stadt.\n\n---\n\n**Dank an alle Menschen in München**\n\nIch spreche heute zu Ihnen.\n\nIch sage:  \nDanke an Sie alle.\n\nSie arbeiten jeden Tag für München.\n\nSie machen viele wichtige Dinge.  \nZum Beispiel:\n\n- große Parks  \n- alte Gebäude  \n- viele Veranstaltungen\n\nMünchen ist besonders.  \nDas heißt: München ist anders als andere Städte.\n\nMünchen ist lebendig.  \nDas heißt: In München ist viel los.  \nMenschen treffen sich.  \nMenschen erleben viel.\n\nMünchen ist schön.  \nEs gibt viele Blumen und Bäume.  \nEs gibt auch viele schöne Häuser.\n\nIch bin stolz auf Sie alle.\n\n---\n\n**Die Schlösser in München**\n\nIn München gibt es mehrere Schlösser.\n\nEin *Schloss* ist ein großes, schönes Haus.  \nFrüher haben dort Könige und Königinnen gewohnt.\n\nDie Schlösser in München sind bekannt.  \nDas heißt: Viele Menschen kennen die Schlösser.  \nViele Menschen besuchen die Schlösser.\n\nDie Schlösser sind sehr schön.\n\n---\n\n**Ein neues Schloss für München**\n\nIch wünsche mir ein neues, großes Schloss.\n\nDas neue Schloss soll besonders schön sein.\n\nDas Schloss soll zeigen:  \nMünchen ist schön.\n\nDas Schloss soll auch zeigen:  \nKunst und Kultur sind wichtig für uns.\n\n*Kunst* ist zum Beispiel:  \n- Bilder  \n- Musik  \n- Theater\n\n*Kultur* ist zum Beispiel:  \n- Feste  \n- Traditionen  \n- besondere Bräuche in München\n\nDas neue Schloss soll auch für die Zukunft wichtig sein.\n\n*Zukunft* bedeutet: Die Zeit, die noch kommt.\n\n---\n\n**Gemeinsam das Schloss bauen**\n\nWir bauen das Schloss zusammen.\n\nSie haben viel Erfahrung.  \nDas heißt: Sie wissen viel über Ihre Arbeit.\n\nSie arbeiten sehr gern.\n\nIch glaube an Sie.\n\nDas heißt: Ich bin sicher, Sie können das gut machen.\n\nSo wird München noch schöner.\n\n---\n\n**Mein Dank am Schluss**\n\nDanke für Ihre Arbeit.\n\nIch glaube an Sie.\n\nDas heißt: Ich bin sicher, Sie schaffen unser Ziel.\n\n*Ziel* bedeutet:  \nDas, was wir gemeinsam erreichen wollen.\n\n---\n\nMit besten Grüßen\n\nIhr Ludwig der Zweite  \n(König von Bayern)</SIMPLIFY_REFINE>`
    );

    // Final critique
    push(
        "APPEND",
        `<SIMPLIFY_CRITIQUE revision=${revisionTags[2]}>Critique:\n\n1. **Satzlänge**  \n   - Mehrere Sätze sind länger als 15 Wörter. Beispiele:  \n     - „Die Stadt-Verwaltung macht Regeln. Sie organisiert viele Dinge in der Stadt." (Zwei Aussagen, aber korrekt getrennt. Kein Problem.)  \n     - „Das heißt: München ist anders als andere Städte." (14 Wörter, aber noch im Rahmen.)  \n     - „Das neue Schloss soll auch für die Zukunft wichtig sein." (9 Wörter, in Ordnung.)  \n   → Insgesamt halten die meisten Sätze die Längenregel ein. Nur wenige Sätze sind an der Grenze, überschreiten diese aber nicht deutlich.\n\n2. **Nebensätze und Satzstruktur**  \n   - Der Text verwendet an mehreren Stellen das Muster „Das heißt: ...", um Nebensätze zu vermeiden.  \n   - Die Satzstruktur ist einfach und korrekt.\n\n3. **Fremd- und Fachwörter**  \n   - Die Erklärung von „Stadt-Verwaltung", „Schloss", „Kunst", „Kultur", „Zukunft", und „Ziel" erfolgt direkt im Text und ist gut gelöst.\n   - Das Wort „Erfahrung" wird mit „Das heißt: Sie wissen viel über Ihre Arbeit." gut erklärt.\n   - Das Wort „Kompetenz" aus dem Original wird zu „Erfahrung"; das ist angemessen.\n   - Das Wort „Enthusiasmus" aus dem Original wird sinngemäß durch „Sie arbeiten sehr gern." ersetzt; das ist gut.\n\n4. **Gleiches gleich benennen**  \n   - Es wird meistens das gleiche Wort für gleiche Dinge genutzt. Beispiel: „Schloss", „München", „Arbeit".\n\n5. **Metaphern und bildhafte Sprache**  \n   - Der Text verzichtet auf Metaphern und bildhafte Sprache.\n\n6. **Abkürzungen**  \n   - Es werden keine unerklärten Abkürzungen verwendet.\n\n7. **Typographie und Layout**  \n   - Der Text ist in kurze Abschnitte mit Überschriften gegliedert.\n   - Listen werden eingesetzt.\n   - Es ist nicht zu erkennen, ob eine große, gut lesbare Schrift und ausreichender Kontrast verwendet werden, da es sich um einen reinen Text handelt.\n\n8. **Direkte Ansprache**  \n   - Die Leser werden direkt angesprochen („Ich glaube an Sie.").\n\n9. **Passiv und Konjunktiv**  \n   - Der Konjunktiv wird vermieden („Ich bin sicher, Sie können das gut machen." statt „Ich wäre sicher, Sie könnten das gut machen.").\n   - Passiv wird nicht verwendet.\n\n10. **Zahlen**  \n    - „Der Zweite" als Name ist korrekt ausgeschrieben; es werden keine anderen Zahlen verwendet.\n\n11. **Fehlende Informationen / Auslassungen**  \n    - Die inhaltliche Abdeckung ist vollständig, keine relevanten Informationen aus dem Original fehlen.\n\n12. **Link-Regeln**\n    - Keine Links im Text, daher kein Problem.\n\n13. **Absatzlänge und Lesbarkeit**  \n    - Die Absätze sind kurz und übersichtlich.\n    - Jeder Satz steht in einer eigenen Zeile.\n\n14. **Synonyme**\n    - „Mitarbeiter und Mitarbeiterinnen" und „Menschen" werden beide verwendet, sind aber im Kontext klar und verständlich.\n\n**Fazit:**  \nDer Text hält alle Regeln für Leichte Sprache ein.  \nKeine Regelverletzungen festgestellt.\n\nNo issues found.</SIMPLIFY_CRITIQUE>`
    );
    push("APPEND", "**Ergebnis:** Qualitätsprüfung ohne Beanstandungen.");

    push("ENDED", "**Textvereinfachung abgeschlossen.**");

    chunks.push({
        id: `chatcmpl-simplify-${Math.random().toString(36).slice(2, 8)}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KIESGPT",
        choices: [{ index: 0, delta: { content: "Simplification finished." }, finish_reason: null }]
    });
    chunks.push({
        id: `chatcmpl-simplify-${Math.random().toString(36).slice(2, 8)}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KIESGPT",
        choices: [
            {
                index: 0,
                delta: {
                    content:
                        "**Ansprache von Ludwig der Zweite**\n\nAn alle Bürger und Bürgerinnen von München. An alle Mitarbeiter und Mitarbeiterinnen von der Stadt-Verwaltung.\n\nDie Stadt-Verwaltung macht Regeln. Sie organisiert viele Dinge in der Stadt.\n\nIch sage: Danke an Sie alle. Sie arbeiten jeden Tag für München.\n\nIn München gibt es viele schöne Dinge. Zum Beispiel: große Parks, alte Gebäude, viele Veranstaltungen.\n\nMünchen ist lebendig und schön. Es gibt viele Blumen, Bäume und schöne Häuser.\n\nIch wünsche mir ein neues, großes Schloss. Das Schloss soll zeigen: München ist schön. Kunst und Kultur sind wichtig.\n\nKunst ist zum Beispiel Bilder, Musik, Theater. Kultur ist zum Beispiel Feste, Traditionen, besondere Bräuche in München.\n\nWir bauen das Schloss zusammen. Sie haben viel Erfahrung. Sie arbeiten sehr gern. Ich bin sicher, Sie können das gut machen.\n\nDanke für Ihre Arbeit. Ich bin sicher, Sie schaffen unser Ziel.\n\nMit besten Grüßen\nIhr Ludwig der Zweite"
                },
                finish_reason: null
            }
        ]
    });
    chunks.push({
        id: `chatcmpl-simplify-${Math.random().toString(36).slice(2, 8)}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "KIESGPT",
        choices: [{ index: 0, delta: { content: "" }, finish_reason: "stop" as any }]
    });
    return chunks;
}
