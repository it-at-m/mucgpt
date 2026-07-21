import { Button } from "@fluentui/react-components";
import { Copy24Regular, CheckmarkSquare24Regular } from "@fluentui/react-icons";
import { ClassAttributes, HTMLAttributes, useState, useCallback } from "react";
import { ExtraProps } from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { dark, duotoneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import styles from "./CodeBlockRenderer.module.css";
import { Mermaid, MermaidProps } from "./Mermaid";
import { DrawIO, DrawIOProps } from "./DrawIO";
import { STORAGE_KEYS } from "../../pages/layout/LayoutHelper";
import { FragmentManager } from "../Fragments/FragmentManager/FragmentManager";
import { useAllowDrawioRender } from "./drawioRenderContext";

// Constants
const LANGUAGE_PATTERN = /language-(\w+)/;
const COPY_FEEDBACK_TIMEOUT = 1000;
const MERMAID_MIN_TEXT_LENGTH = 30;

const MERMAID_DIAGRAM_TYPES = ["flowchart", "classDiagram", "sequenceDiagram", "stateDiagram", "pie", "mindmap", "journey", "erDiagram", "gantt"] as const;

const FRAGMENT_LANGUAGES = ["mucgptbrainstorming", "mucgpt-brainstorming", "mucgptsimplify", "mucgpt-simplify"] as const;

type CodeBlockRendererProps = ClassAttributes<HTMLElement> & HTMLAttributes<HTMLElement> & ExtraProps;

// Utility functions
const getLanguageFromClassName = (className?: string): string => {
    const match = LANGUAGE_PATTERN.exec(className || "");
    return match ? match[1] : "";
};

const getThemePreference = (): boolean => {
    const storedTheme = localStorage.getItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME);
    return storedTheme === null ? true : storedTheme === "true";
};

const isFragmentLanguage = (language?: string): boolean => {
    const normalizedLanguage = language?.toLowerCase();
    return FRAGMENT_LANGUAGES.some(lang => normalizedLanguage === lang);
};

const isMermaidDiagram = (language: string, text: string): boolean => {
    if (language === "mermaid") return true;

    return language === "" && text.length > MERMAID_MIN_TEXT_LENGTH && MERMAID_DIAGRAM_TYPES.some(type => text.indexOf(type) !== -1);
};

const isDrawioDiagram = (language: string): boolean => {
    return language.toLowerCase() === "drawio";
};

export default function CodeBlockRenderer(props: CodeBlockRendererProps) {
    const { children, className, ...rest } = props;
    const [copied, setCopied] = useState<boolean>(false);
    const language = getLanguageFromClassName(className);
    const text = String(children);
    const lightThemePref = getThemePreference();
    const allowDrawioRender = useAllowDrawioRender();

    // Debug logging
    if (language && (language.toLowerCase().includes("mucgpt") || language.toLowerCase().includes("brainstorm"))) {
        console.log("CodeBlockRenderer debug:", { language, className, isFragment: isFragmentLanguage(language) });
    }

    const onCopy = useCallback(() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => {
            setCopied(false);
        }, COPY_FEEDBACK_TIMEOUT);
    }, [text]);

    // Check if this is a special fragment that should be rendered by FragmentManager
    if (isFragmentLanguage(language)) {
        console.log("Fragment detected:", { language, text: text.substring(0, 100) + "..." });
        return <FragmentManager content={text} fragmentType={language} />;
    }

    // Check if this is a Mermaid diagram
    if (isMermaidDiagram(language, text)) {
        const mermaidProps: MermaidProps = {
            text: text,
            darkTheme: !lightThemePref
        };
        return <Mermaid {...mermaidProps} />;
    }

    // draw.io diagrams only in assistant answers (allowDrawio on MarkdownRenderer)
    if (isDrawioDiagram(language) && allowDrawioRender) {
        const drawioProps: DrawIOProps = {
            text: text,
            darkTheme: !lightThemePref
        };
        return <DrawIO {...drawioProps} />;
    }

    // Render code block with syntax highlighting
    const isMultiline = text.includes("\n");

    if (isMultiline) {
        return (
            <div className={styles.codeContainer}>
                <SyntaxHighlighter
                    {...(rest as any)}
                    children={text.replace(/\n$/, "")}
                    style={lightThemePref ? duotoneLight : dark}
                    language={language}
                    PreTag="div"
                    showLineNumbers={false}
                    wrapLongLines={true}
                    codeTagProps={{ style: { fontSize: "var(--fontSizeBase400)" } }}
                />
                <div className={styles.copyContainer}>
                    {language}
                    <Button
                        appearance="transparent"
                        aria-label="Copy code"
                        icon={copied ? <CheckmarkSquare24Regular /> : <Copy24Regular />}
                        onClick={onCopy}
                    />
                </div>
            </div>
        );
    }

    return (
        <code {...rest} className={className}>
            {children}
        </code>
    );
}
