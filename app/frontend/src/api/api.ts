import {
    ApplicationConfig,
    AskResponse,
    Bot,
    BrainstormRequest,
    ChatRequest,
    CountTokenRequest,
    CountTokenResponse,
    CreateBotRequest,
    GenerateTagsRequest,
    SimplyRequest,
    SimplyResponse,
    SumRequest,
    SumResponse
} from "./models";

export async function chatApi(options: ChatRequest): Promise<Response> {
    const url = options.shouldStream ? "/api/chat_stream" : "/api/chat";
    return await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        mode: "cors",
        redirect: "manual",
        body: JSON.stringify({
            history: options.history,
            temperature: options.temperature,
            language: options.language,
            system_message: options.system_message,
            max_output_tokens: options.max_output_tokens,
            model: options.model
        })
    });
}

export async function sumApi(options: SumRequest, file?: File): Promise<SumResponse> {
    const formData = new FormData();
    formData.append(
        "body",
        JSON.stringify({
            text: options.text,
            detaillevel: options.detaillevel,
            language: options.language,
            model: options.model
        })
    );
    if (file) formData.append("file", file);

    const response = await fetch("/api/sum", {
        method: "POST",
        headers: {},
        mode: "cors",
        redirect: "manual",
        body: formData
    });

    const parsedResponse: SumResponse = await handleResponse(response);

    return parsedResponse;
}

export function handleRedirect(response: Response, reload = true) {
    if (response.type === "opaqueredirect") {
        if (reload) {
            console.log("reloading shortly");
            setTimeout(() => {
                location.reload();
            }, 5000);
            throw Error("Die Authentifizierungsinformationen sind abgelaufen. Die Seite wird in wenigen Sekunden neu geladen.");
        } else {
            const redirectUrl = response.url;
            if (redirectUrl) {
                window.location.href = redirectUrl; // Manually redirect
            } else {
                throw new Error("Redirect URL not found");
            }
        }
    }
}

export async function handleResponse(response: Response) {
    const parsedResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }
    return parsedResponse;
}

export async function configApi(): Promise<ApplicationConfig> {
    return await fetch("/api/config", {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        },
        mode: "cors",
        redirect: "manual"
    }).then(async response => {
        handleRedirect(response, false);
        const parsedResponse = await handleResponse(response);
        return parsedResponse;
    });
}

export async function brainstormApi(options: BrainstormRequest): Promise<AskResponse> {
    const response = await fetch("/api/brainstorm", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        mode: "cors",
        redirect: "manual",
        body: JSON.stringify({
            topic: options.topic,
            temperature: options.temperature,
            language: options.language,
            model: options.model
        })
    });

    handleRedirect(response, true);
    const parsedResponse: AskResponse = await handleResponse(response);
    return parsedResponse;
}

export async function simplyApi(options: SimplyRequest): Promise<SimplyResponse> {
    const response = await fetch("/api/simply", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        mode: "cors",
        redirect: "manual",
        body: JSON.stringify({
            topic: options.topic,
            temperature: options.temperature,
            model: options.model,
            output_type: options.output_type
        })
    });
    handleRedirect(response);
    const parsedResponse: SimplyResponse = await handleResponse(response);
    return parsedResponse;
}

export async function countTokensAPI(options: CountTokenRequest): Promise<CountTokenResponse> {
    const response = await fetch("/api/counttokens", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        mode: "cors",
        redirect: "manual",
        body: JSON.stringify({
            text: options.text,
            model: options.model.llm_name
        })
    });

    handleRedirect(response, true);
    const parsedResponse: CountTokenResponse = await handleResponse(response);
    return parsedResponse;
}

export async function createBotApi(options: CreateBotRequest): Promise<Response> {
    return await fetch("/api/create_bot", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        mode: "cors",
        redirect: "manual",
        body: JSON.stringify({
            input: options.input,
            model: options.model,
            max_output_tokens: options.max_output_tokens
        })
    });
}

export async function getCommunityBots(): Promise<any[]> {
    return await fetch("/api/community_bots", {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        },
        mode: "cors",
        redirect: "manual"
    }).then(async response => {
        const parsedResponse = await handleResponse(response);
        return parsedResponse.bots;
    });
}

export async function addCommunityBot(bot: Bot): Promise<string> {
    return await fetch("/api/add_community_bot", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        mode: "cors",
        redirect: "manual",
        body: JSON.stringify({
            title: bot.title,
            description: bot.description,
            system_message: bot.system_message,
            publish: bot.publish,
            id: bot.id,
            temperature: bot.temperature,
            max_output_tokens: bot.max_output_tokens,
            tags: bot.tags,
            version: bot.version,
            owner: bot.owner
        })
    }).then(async response => {
        const parsedResponse = await handleResponse(response);
        return parsedResponse.id;
    });
}

export async function updateCommunityBot(bot: Bot): Promise<void> {
    await fetch("/api/update_community_bot", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        mode: "cors",
        redirect: "manual",
        body: JSON.stringify({
            title: bot.title,
            description: bot.description,
            system_message: bot.system_message,
            publish: bot.publish,
            id: bot.id,
            temperature: bot.temperature,
            max_output_tokens: bot.max_output_tokens,
            tags: bot.tags,
            version: bot.version,
            owner: bot.owner
        })
    });
}

export async function generateTags(options: GenerateTagsRequest): Promise<string[]> {
    return await fetch("/api/generate_tags", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        mode: "cors",
        redirect: "manual",
        body: JSON.stringify({
            bot: options.bot,
            model: options.model,
            max_output_tokens: options.max_output_tokens
        })
    }).then(async response => {
        const parsedResponse = await handleResponse(response);
        return [parsedResponse.tag1, parsedResponse.tag2, parsedResponse.tag3].filter(tag => tag !== "");
    });
}
