// mocks/handlers.js
import { http, HttpResponse } from "msw";
import { ApplicationConfig } from "../api";

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
            env_name: "MUCGPT DEMO"
        },
        alternative_logo: false,
        enable_simply: true,
        community_assistants: []
    },
    version: "DEV 1.0.0",
    commit: "152b175"
};

export const handlers = [
    http.get("/api/config", () => {
        return HttpResponse.json(CONFIG_RESPONSE);
    })
];
