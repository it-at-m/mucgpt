import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { dark, duotoneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useContext } from "react";
import styles from "./CodeBlockRenderer.module.css";
import { AppThemeContext } from "../../ui/theme/AppThemeContext";

export type HighlightedCodeBlockProps = {
    text: string;
    language: string;
    lightTheme?: boolean;
};

/** Shared Prism code block used by CodeBlockRenderer and diagram error fallbacks. */
export function HighlightedCodeBlock({ text, language, lightTheme }: HighlightedCodeBlockProps) {
    const { isLight } = useContext(AppThemeContext);
    const resolvedLightTheme = lightTheme ?? isLight;

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
            <div className={styles.copyContainer}>{language}</div>
        </div>
    );
}
