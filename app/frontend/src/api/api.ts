import { ApplicationConfig, AskRequest, AskResponse, BrainstormRequest, ChatRequest, SumRequest, SumResponse } from "./models";
import { setmessage } from "../store/messageSlice";

import { useDispatch } from "react-redux";
import { Dispatch } from "@reduxjs/toolkit";

const dispatch: Dispatch = useDispatch();

export async function chatApi(options: ChatRequest): Promise<Response> {
    const url = options.shouldStream ? "/chat_stream" : "/chat";
    return await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "ssotest.muenchen.de"
        },
        mode: "cors",
        redirect: "manual",
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

export async function sumApi(options: SumRequest, file?: File): Promise<SumResponse> {
    const formData = new FormData();
    formData.append(
        "body",
        JSON.stringify({
            text: options.text,
            overrides: {
                temperature: options.overrides?.temperature,
                language: options.overrides?.language
            }
        })
    );
    if (file) formData.append("file", file);

    const response = await fetch("/sum", {
        method: "POST",
        headers: {
            "Access-Control-Allow-Origin": "ssotest.muenchen.de"
        },
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
    const response = await fetch("/config", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "ssotest.muenchen.de"
        },
        mode: "cors",
        redirect: "manual"
    });

    const parsedResponse: ApplicationConfig = await handleResponse(response);
    return parsedResponse;
}

export async function brainstormApi(options: BrainstormRequest): Promise<AskResponse> {
    const response = await fetch("/brainstorm", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "ssotest.muenchen.de"
        },
        mode: "cors",
        redirect: "manual",
        body: JSON.stringify({
            topic: options.topic,
            overrides: {
                temperature: options.overrides?.temperature,
                language: options.overrides?.language
            }
        })
    });

    handleRedirect(response);
    const parsedResponse: AskResponse = await handleResponse(response);
    return parsedResponse;
}

export function getCitationFilePath(citation: string): string {
    return `/content/${citation}`;
}
