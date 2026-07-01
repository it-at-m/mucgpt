import { ReactNode, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Button } from "@fluentui/react-components";
import { ArrowDown24Regular } from "@fluentui/react-icons";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import styles from "./ChatLayout.module.css";
import { LLMSelector } from "../LLMSelector/LLMSelector";
import { Model } from "../../api";

interface Props {
    starterPrompts: ReactNode;
    answers: ReactNode;
    input: ReactNode;
    showStarterPrompts: boolean;
    header: string;
    welcomeMessage: string;
    header_as_markdown: boolean;
    messages_description: string;
    onHeaderClick?: () => void;
    infoDrawerOpen?: boolean;
    onLLMSelectionChange: (nextLLM: string) => void;
    llmOptions?: Model[];
    defaultLLM?: string;
    actions?: ReactNode;
}

export const ChatLayout = ({
    starterPrompts,
    answers,
    input,
    showStarterPrompts,
    header,
    welcomeMessage,
    header_as_markdown,
    messages_description,
    llmOptions,
    defaultLLM,
    onLLMSelectionChange,
    onHeaderClick,
    infoDrawerOpen,
    actions
}: Props) => {
    const chatInputRef = useRef<HTMLDivElement | null>(null);
    const chatMessagesRef = useRef<HTMLUListElement | null>(null);
    const [chatInputHeight, setChatInputHeight] = useState(0);
    const [showScrollToBottom, setShowScrollToBottom] = useState(false);
    const [isCompact, setIsCompact] = useState(() =>
        typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 640px)").matches : false
    );

    useEffect(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
        const mq = window.matchMedia("(max-width: 640px)");
        const handler = (e: MediaQueryListEvent) => setIsCompact(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    useEffect(() => {
        const element = chatInputRef.current;
        if (!element || typeof window === "undefined") return;

        const updateInputHeight = () => {
            const nextHeight = Math.ceil(element.getBoundingClientRect().height);
            setChatInputHeight(previousHeight => (previousHeight === nextHeight ? previousHeight : nextHeight));
        };

        updateInputHeight();
        window.addEventListener("resize", updateInputHeight);

        if (typeof ResizeObserver === "undefined") {
            return () => window.removeEventListener("resize", updateInputHeight);
        }

        const observer = new ResizeObserver(updateInputHeight);
        observer.observe(element);

        return () => {
            window.removeEventListener("resize", updateInputHeight);
            observer.disconnect();
        };
    }, []);

    const updateScrollToBottomVisibility = useCallback(() => {
        const element = chatMessagesRef.current;
        if (!element || showStarterPrompts) {
            setShowScrollToBottom(false);
            return;
        }

        const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
        const hasScrollableContent = element.scrollHeight > element.clientHeight + 1;
        setShowScrollToBottom(hasScrollableContent && distanceFromBottom > 32);
    }, [showStarterPrompts]);

    useEffect(() => {
        const element = chatMessagesRef.current;
        if (!element || showStarterPrompts || typeof window === "undefined") {
            setShowScrollToBottom(false);
            return;
        }

        updateScrollToBottomVisibility();
        const updateOnNextFrame = () => requestAnimationFrame(updateScrollToBottomVisibility);

        element.addEventListener("scroll", updateScrollToBottomVisibility, { passive: true });
        window.addEventListener("resize", updateOnNextFrame);

        const resizeObserver = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(updateOnNextFrame);
        resizeObserver?.observe(element);

        const mutationObserver = typeof MutationObserver === "undefined" ? undefined : new MutationObserver(updateOnNextFrame);
        mutationObserver?.observe(element, { childList: true, subtree: true, characterData: true });

        return () => {
            element.removeEventListener("scroll", updateScrollToBottomVisibility);
            window.removeEventListener("resize", updateOnNextFrame);
            resizeObserver?.disconnect();
            mutationObserver?.disconnect();
        };
    }, [answers, chatInputHeight, showStarterPrompts, updateScrollToBottomVisibility]);

    const scrollToBottom = useCallback(() => {
        const element = chatMessagesRef.current;
        if (!element) {
            return;
        }

        element.scrollTo({
            top: element.scrollHeight,
            behavior: "smooth"
        });
        requestAnimationFrame(updateScrollToBottomVisibility);
    }, [updateScrollToBottomVisibility]);

    const containerStyle = { "--chatInputHeight": `${chatInputHeight}px` } as CSSProperties;

    return (
        <div className={styles.container} data-info-open={infoDrawerOpen ?? false} style={containerStyle}>
            <header className={styles.headerBar}>
                <div className={styles.leftGroup}>
                    <h1 className={styles.headerTitle}>
                        {onHeaderClick ? (
                            <Button appearance="transparent" className={styles.headerTitleButton} onClick={onHeaderClick}>
                                {header}
                            </Button>
                        ) : (
                            header
                        )}
                    </h1>
                </div>

                <div className={styles.controlsContainer}>
                    {llmOptions && defaultLLM && onLLMSelectionChange && (
                        <div aria-label="LLM selector container" role="group">
                            <LLMSelector onSelectionChange={onLLMSelectionChange} defaultLLM={defaultLLM} options={llmOptions} compact={isCompact} />
                        </div>
                    )}
                    {actions}
                </div>
            </header>

            <div className={styles.chatRoot}>
                <div className={styles.chatContainer}>
                    {showStarterPrompts ? (
                        <div className={styles.chatEmptyState} tabIndex={0}>
                            <div className={styles.welcomeMessageContainer}>
                                {header_as_markdown ? (
                                    <div className={styles.chatEmptyStateSubtitleMarkdown}>
                                        <div className={styles.answerText}>
                                            <Markdown remarkPlugins={[remarkGfm]}>{welcomeMessage}</Markdown>
                                        </div>
                                    </div>
                                ) : (
                                    <h2 className={styles.chatEmptyStateSubtitle}>{welcomeMessage}</h2>
                                )}
                            </div>
                            {starterPrompts}
                        </div>
                    ) : (
                        <ul className={styles.allChatMessages} aria-description={messages_description} ref={chatMessagesRef}>
                            {answers}
                        </ul>
                    )}
                    {showScrollToBottom && (
                        <div className={styles.scrollToBottomWrapper}>
                            <Button
                                appearance="secondary"
                                shape="circular"
                                size="medium"
                                className={styles.scrollToBottomButton}
                                icon={<ArrowDown24Regular />}
                                onClick={scrollToBottom}
                                aria-label="Zum Ende des Chats springen"
                            />
                        </div>
                    )}
                    <div className={styles.chatInput} ref={chatInputRef}>
                        {input}
                    </div>
                </div>
            </div>
        </div>
    );
};
