import {
    ApplicationConfig,
    AskResponse,
    BrainstormRequest,
    ChatRequest,
    CountTokenRequest,
    CountTokenResponse,
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

export function handleRedirect(response: Response) {
    if (response.type === "opaqueredirect") {
        console.log("reloading shortly");
        setTimeout(() => {
            location.reload();
        }, 5000);
        throw Error("Die Authentifizierungsinformationen sind abgelaufen. Die Seite wird in wenigen Sekunden neu geladen.");
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
    const response = await fetch("/api/config", {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        },
        mode: "cors",
        redirect: "manual"
    });

    const parsedResponse: ApplicationConfig = await handleResponse(response);
    return parsedResponse;
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

    handleRedirect(response);
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
            max_output_tokens: options.max_output_tokens,
            output_type: options.output_type,
            completeness: options.completeness
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
            model: options.model
        })
    });

    handleRedirect(response);
    const parsedResponse: CountTokenResponse = await handleResponse(response);
    return parsedResponse;
}
