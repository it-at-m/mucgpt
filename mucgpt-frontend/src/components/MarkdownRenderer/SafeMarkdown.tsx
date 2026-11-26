import type { Components } from "react-markdown";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeExternalLinks from "rehype-external-links";
import CodeBlockRenderer from "../CodeBlockRenderer/CodeBlockRenderer";
import TableRenderer from "../TableRenderer/TableRenderer";
import { safeMarkdownComponents } from "./markdownLinkPolicy";

interface SafeMarkdownProps {
    children: string;
    /** Render LaTeX math via KaTeX. */
    math?: boolean;
    /** Render fenced code with the shared code block renderer. */
    code?: boolean;
    /** Render tables with the shared table renderer. */
    tables?: boolean;
    /** Merged on top of the safe link/image policy. */
    components?: Components;
}

// Defense in depth: the `a`/`img` component overrides already apply the link
// policy; this plugin only matters if that override is ever removed.
const externalLinksOptions = {
    target: "_blank",
    rel: ["nofollow", "noopener", "noreferrer"]
};

/**
 * The shared markdown rendering surface: the safe link/image policy always
 * applies, the feature renderers (math, code, tables) opt in per surface.
 */
export const SafeMarkdown = ({ children, math = false, code = false, tables = false, components }: SafeMarkdownProps) => (
    <Markdown
        remarkPlugins={math ? [[remarkMath, { singleDollarTextMath: false }], remarkGfm] : [remarkGfm]}
        rehypePlugins={
            math
                ? [
                      [rehypeKatex, { output: "mathml" }],
                      [rehypeExternalLinks, externalLinksOptions]
                  ]
                : [[rehypeExternalLinks, externalLinksOptions]]
        }
        components={{
            ...safeMarkdownComponents,
            ...(code ? { code: CodeBlockRenderer } : {}),
            ...(tables ? { table: TableRenderer } : {}),
            ...components
        }}
    >
        {children}
    </Markdown>
);
