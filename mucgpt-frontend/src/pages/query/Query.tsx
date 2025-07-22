import styles from "./Query.module.css";
import { useTranslation } from "react-i18next";
import { ChatCompletionChunk, ChatCompletionChunkChoice, ChatRequest } from "../../api/models";
import { useContext, useEffect, useState } from "react";
import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { chatApi } from "../../api/api";
import { handleRedirect } from "../../api/fetch-utils";
import CodeBlockRenderer from "../../components/CodeBlockRenderer/CodeBlockRenderer";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

const Query = () => {
    const { t } = useTranslation();
    const { LLM } = useContext(LLMContext);

    const [response, setResponse] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);

    const currentPath = window.location.pathname + window.location.search;
    const [decoded_query, setDecodedQuery] = useState<string>("");

    const remarkMathOptions = {
        singleDollarTextMath: false
    };
    const rehypeKatexOptions = {
        output: "mathml"
    };

    useEffect(() => {
        const makeApiRequest = async (query: string) => {
            setLoading(true);
            // Create history for the request
            const request: ChatRequest = {
                history: [{ user: query, bot: undefined }],
                shouldStream: true,
                language: "",
                temperature: 0,
                system_message: "",
                max_output_tokens: 3000,
                model: LLM.llm_name,
                enabled_tools: undefined
            };

            const response = await chatApi(request);
            handleRedirect(response);

            if (!response.body) {
                throw Error("No response body");
            }

            // Initialize response variables
            let user_tokens = 0;
            let streamed_tokens = 0;

            // Buffer for updates to reduce re-renders
            let buffer = "";

            // Process the SSE stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let streamBuffer = "";

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    streamBuffer += decoder.decode(value, { stream: true });
                    const lines = streamBuffer.split("\n");

                    // Keep the last incomplete line in the buffer
                    streamBuffer = lines.pop() || "";

                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            const data = line.slice(6).trim();
                            if (data === "[DONE]") {
                                break;
                            }

                            try {
                                const chunk = JSON.parse(data) as ChatCompletionChunk;
                                const choice: ChatCompletionChunkChoice | undefined = chunk.choices?.[0];
                                if (!choice) continue;

                                // Stream end
                                if (choice.finish_reason === "stop") {
                                    break;
                                }

                                // Handle token usage if available
                                const chunkWithUsage = chunk as ChatCompletionChunk & {
                                    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
                                };
                                if (chunkWithUsage.usage) {
                                    user_tokens = user_tokens + (chunkWithUsage.usage.prompt_tokens || 0);
                                    streamed_tokens = streamed_tokens + (chunkWithUsage.usage.completion_tokens || 0);
                                }

                                // Append partial content
                                const content = choice.delta?.content;
                                if (content) {
                                    buffer += content;
                                    setResponse(buffer);
                                }
                            } catch (parseError) {
                                console.warn("Failed to parse SSE data:", data, parseError);
                            }
                        }
                    }
                }
            } finally {
                reader.releaseLock();
                setLoading(false);
            }
            setResponse(buffer);
        };
        if (currentPath) {
            if (currentPath.startsWith("/?q=")) {
                const query = currentPath.slice(4, currentPath.length - 1);
                const decoded_query = decodeURIComponent(query).replaceAll("+", " ");
                setDecodedQuery(decoded_query);
                makeApiRequest(decoded_query);
            }
        } else console.error("No query!");
    }, [currentPath, LLM.llm_name]);

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <span className={styles.label}>{t("Der Feuerfuchs frägt nach folgendem 🦊")}:</span>
                    <div className={styles.query}>
                        <i>Aktueller Pfad:</i> {currentPath}
                    </div>
                    <div className={styles.query}>
                        <i>🕵️ dekodiert zu:</i>
                        {decoded_query || t("Keine Anfrage")}
                    </div>
                </div>
                <div className={styles.divider} />
                <div className={styles.responseBlock}>
                    <span className={styles.label}>{t("🤖 MUCGPT hilft seinem Fuchsbuddy:")}</span>
                    <div>
                        {loading ? (
                            <div className={styles.foxLoader}>
                                <span role="img" aria-label="firefox">
                                    🦊
                                </span>
                                <span className={styles.loading}>{t("Antwort wird geladen...")}</span>
                            </div>
                        ) : response ? (
                            <Markdown
                                className={styles.answerText}
                                remarkPlugins={[[remarkMath, remarkMathOptions], remarkGfm]}
                                rehypePlugins={[rehypeRaw, [rehypeKatex, rehypeKatexOptions]]}
                                components={{
                                    code: CodeBlockRenderer
                                }}
                            >
                                {response}
                            </Markdown>
                        ) : (
                            <span className={styles.noResponse}>{t("Tut mir Leid Fuchsfreund. Ich weiß nicht was du willst.")}</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Query;
