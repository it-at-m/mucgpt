import { IconButton } from "@fluentui/react";
import { ClassAttributes, HTMLAttributes, useState, useCallback } from "react";
import { ExtraProps } from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { dark, duotoneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import styles from "./CodeBlockRenderer.module.css";
import { Mermaid, MermaidProps } from "./Mermaid";
import { Mindmap } from "../Mindmap/Mindmap";
import { STORAGE_KEYS } from "../../pages/layout/LayoutHelper";

// Constants
const LANGUAGE_PATTERN = /language-(\w+)/;
const COPY_FEEDBACK_TIMEOUT = 1000;
const MERMAID_MIN_TEXT_LENGTH = 30;

const MERMAID_DIAGRAM_TYPES = ["flowchart", "classDiagram", "sequenceDiagram", "stateDiagram", "pie", "mindmap", "journey", "erDiagram", "gantt"] as const;

const BRAINSTORMING_TOOLS = ["mucgptbrainstorming", "mucgpt-brainstorming"] as const;

const COPY_ICONS = {
    DEFAULT: "Copy",
    SUCCESS: "Checkmark"
} as const;

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

const isBrainstormingTool = (language: string): boolean => {
    const normalizedLanguage = language.toLowerCase();
    return BRAINSTORMING_TOOLS.some(lang => normalizedLanguage === lang);
};

const isMermaidDiagram = (language: string, text: string): boolean => {
    if (language === "mermaid") return true;

    return language === "" && text.length > MERMAID_MIN_TEXT_LENGTH && MERMAID_DIAGRAM_TYPES.some(type => text.indexOf(type) !== -1);
};

export default function CodeBlockRenderer(props: CodeBlockRendererProps) {
    const { children, className, ...rest } = props;
    const [icon, setIcon] = useState<string>(COPY_ICONS.DEFAULT);
    const language = getLanguageFromClassName(className);
    const text = String(children);
    const lightThemePref = getThemePreference();

    const onCopy = useCallback(() => {
        navigator.clipboard.writeText(text);
        setIcon(COPY_ICONS.SUCCESS);
        setTimeout(() => {
            setIcon(COPY_ICONS.DEFAULT);
        }, COPY_FEEDBACK_TIMEOUT);
    }, [text]);

    // Check if this is a brainstorming tool result that should be rendered as a mindmap
    if (isBrainstormingTool(language)) {
        return (
            <div className={styles.mindmapContainer}>
                <Mindmap markdown={text} />
            </div>
        );
    }

    // Check if this is a Mermaid diagram
    if (isMermaidDiagram(language, text)) {
        const mermaidProps: MermaidProps = {
            text: text,
            darkTheme: !lightThemePref
        };
        return <Mermaid {...mermaidProps} />;
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
                    <IconButton style={{ color: "black" }} iconProps={{ iconName: icon }} onClick={onCopy} />
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
