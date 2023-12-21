import { ApplicationConfig, AskRequest, AskResponse, BrainstormRequest, ChatRequest, SumRequest, SumResponse } from "./models";

export async function chatApi(options: ChatRequest): Promise<Response> {
    const url = options.shouldStream ? "/chat_stream" : "/chat";
    return await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            history: options.history,
            overrides: {
                temperature: options.overrides?.temperature,
                language: options.overrides?.language,
                system_message: options.overrides?.system_message,
                max_tokens: options.overrides?.max_tokens
            }
        })
    });
}

export async function sumApi(options: SumRequest): Promise<SumResponse> {
    const response = await fetch("/sum", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            text: options.text,
            overrides: {
                temperature: options.overrides?.temperature,
                language: options.overrides?.language
            }
        })
    });

    const parsedResponse: SumResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }

    return parsedResponse;
}

export async function configApi(): Promise<ApplicationConfig> {
    const response = await fetch("/config", {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });
    const parsedResponse: ApplicationConfig = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error("Unknown error");
    }
    return parsedResponse;
}

export async function brainstormApi(options: BrainstormRequest): Promise<AskResponse> {
    const response = await fetch("/brainstorm", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            topic: options.topic,
            overrides: {
                temperature: options.overrides?.temperature,
                language: options.overrides?.language
            }
        })
    });
    const parsedResponse: AskResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }

    return parsedResponse;
}

export function getCitationFilePath(citation: string): string {
    return `/content/${citation}`;
}
