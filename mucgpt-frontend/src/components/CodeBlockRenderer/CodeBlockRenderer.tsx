import { IconButton } from "@fluentui/react";
import { ClassAttributes, HTMLAttributes, useState, useCallback } from "react";
import { ExtraProps } from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { dark, duotoneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import styles from "./CodeBlockRenderer.module.css";
import { Mermaid, MermaidProps } from "./Mermaid";
import { STORAGE_KEYS } from "../../pages/layout/LayoutHelper";

export default function CodeBlockRenderer(props: ClassAttributes<HTMLElement> & HTMLAttributes<HTMLElement> & ExtraProps) {
    const { children, className, ...rest } = props;
    const match = /language-(\w+)/.exec(className || "");
    const [, setCopied] = useState<boolean>(false);
    const [icon, setIcon] = useState<string>("Copy");
    const ligth_theme_pref =
        localStorage.getItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME) === null ? true : localStorage.getItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME) == "true";

    const oncopy = useCallback(() => {
        setCopied(true);
        navigator.clipboard.writeText(children);
        setIcon("Checkmark");
        setTimeout(() => {
            setIcon("Copy");
            setCopied(false);
        }, 1000);
    }, [navigator.clipboard, children]);

    const language = match ? match[1] : "";
    const text = String(children);
    const diagrams = ["flowchart", "classDiagram", "sequenceDiagram", "stateDiagram", "pie", "mindmap", "journey", "erDiagram", "gantt"];

    //check if mermaid diagramm is at the start
    if (language === "mermaid" || (language === "" && text.length > 30 && diagrams.some(type => text.indexOf(type) !== -1))) {
        const mermaidProps: MermaidProps = {
            text: text,
            darkTheme: !ligth_theme_pref
        };

        return <Mermaid {...mermaidProps} />;
    } else {
        const isMultiline = String(children).includes("\n");
        return isMultiline ? (
            <div className={styles.codeContainer}>
                <SyntaxHighlighter
                    {...rest}
                    children={String(children).replace(/\n$/, "")}
                    style={ligth_theme_pref ? duotoneLight : dark}
                    language={language}
                    PreTag="div"
                    showLineNumbers={false}
                    wrapLongLines={true}
                    codeTagProps={{ style: { fontSize: "var(--fontSizeBase400)" } }}
                />
                <div className={styles.copyContainer}>
                    {language}
                    <IconButton
                        style={{ color: "black" }}
                        iconProps={{ iconName: icon }}
                        onClick={() => {
                            oncopy();
                        }}
                    ></IconButton>
                </div>
            </div>
        ) : (
            <code {...rest} className={className}>
                {children}
            </code>
        );
    }
}
