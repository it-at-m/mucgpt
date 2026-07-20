import { IconButton } from "@fluentui/react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { dark, duotoneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import styles from "./CodeBlockRenderer.module.css";
import { STORAGE_KEYS } from "../../pages/layout/LayoutHelper";

export const getCodeBlockLightThemePreference = (): boolean => {
    const storedTheme = localStorage.getItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME);
    return storedTheme === null ? true : storedTheme === "true";
};

export type HighlightedCodeBlockProps = {
    text: string;
    language: string;
    lightTheme?: boolean;
    copyIcon?: string;
    onCopy?: () => void;
};

/** Shared Prism code block used by CodeBlockRenderer and diagram error fallbacks. */
export function HighlightedCodeBlock({ text, language, lightTheme, copyIcon, onCopy }: HighlightedCodeBlockProps) {
    const resolvedLightTheme = lightTheme ?? getCodeBlockLightThemePreference();

    return (
        <div className={styles.codeContainer}>
            <SyntaxHighlighter
                children={text.replace(/\n$/, "")}
                style={resolvedLightTheme ? duotoneLight : dark}
                language={language}
                PreTag="div"
                showLineNumbers={false}
                wrapLongLines={true}
                codeTagProps={{ style: { fontSize: "var(--fontSizeBase400)" } }}
            />
            <div className={styles.copyContainer}>
                {language}
                {onCopy && copyIcon ? <IconButton style={{ color: "black" }} iconProps={{ iconName: copyIcon }} onClick={onCopy} /> : null}
            </div>
        </div>
    );
}
