/**
 * Reduces a chat answer (GFM markdown, possibly with LaTeX, mermaid blocks and
 * tables) to the prose that should be read aloud. Code, tables and formulas
 * are dropped entirely — synthesizing them produces unintelligible output —
 * while links keep their label and headings/list items keep their text.
 */
export function markdownToSpeechText(markdown: string): string {
    if (!markdown) return "";

    let text = markdown;

    // Fenced code blocks (``` ... ```) are not spoken. The closing fence may be
    // missing while an answer is truncated — drop until end of text then.
    text = text.replace(/```[\s\S]*?(?:```|$)/g, " ");
    // Display math: $$...$$ and the \[...\] form the renderer receives.
    text = text.replace(/\\\[([\s\S]*?)\\\]/g, " ");
    text = text.replace(/\$\$[\s\S]*?\$\$/g, " ");
    // Inline math: \(...\) and $...$ on one line.
    text = text.replace(/\\\(([\s\S]*?)\\\)/g, " ");
    text = text.replace(/\$[^$\n]+\$/g, " ");
    // Images are pure URL noise when spoken.
    text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
    // Links keep their label, drop the target.
    text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
    // Raw HTML tags (canvas allowlist etc.) are dropped.
    text = text.replace(/<[^>]+>/g, " ");
    // Tables: every line with a leading pipe goes, separator rows included.
    text = text.replace(/^[ \t]*\|.*$/gm, " ");
    // Headings, blockquotes and list markers keep their text.
    text = text.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "");
    text = text.replace(/^[ \t]{0,3}>[ \t]?/gm, "");
    text = text.replace(/^[ \t]*[-*+][ \t]+/gm, "");
    text = text.replace(/^[ \t]*\d+[.)][ \t]+/gm, "");
    // Emphasis and inline code keep their text.
    text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
    text = text.replace(/__([^_]+)__/g, "$1");
    text = text.replace(/~~([^~]+)~~/g, "$1");
    text = text.replace(/\*([^*\n]+)\*/g, "$1");
    text = text.replace(/`([^`\n]+)`/g, "$1");
    // Mermaid/drawio leftovers inside paragraphs are none — collapse all
    // whitespace (line structure is irrelevant for synthesis).
    text = text.replace(/\s+/g, " ").trim();

    return text;
}
