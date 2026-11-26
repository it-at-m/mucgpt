/**
 * Mindmap link/image neutralization on the token level: markmap renders node
 * content from the parsed markdown (issue #228), so link and image tokens are
 * rewritten to inert text nodes — regardless of which markdown geometry
 * produced them (shortcut references, multiline destinations, unbalanced
 * code spans). Real inline code stays untouched; raw HTML is already escaped
 * by the html: false setting.
 */
interface InlineToken {
    type: string;
    tag: string;
    content: string;
    children: InlineToken[] | null;
}

interface BlockToken {
    type: string;
    children?: InlineToken[] | null;
}

interface MarkdownItLike {
    core: {
        ruler: { push(name: string, rule: (state: { tokens: BlockToken[] }) => void): void };
    };
}

export function neutralizeImageAndLinkTokens(md: MarkdownItLike): void {
    md.core.ruler.push("mucgpt_neutralize_links", state => {
        for (const token of state.tokens) {
            if (token.type !== "inline" || !token.children) continue;
            for (const child of token.children) {
                if (child.type === "image") {
                    child.type = "text";
                    child.tag = "";
                    child.content = (child.children ?? []).map(part => part.content).join("");
                    child.children = null;
                } else if (child.type === "link_open" || child.type === "link_close") {
                    child.type = "text";
                    child.tag = "";
                    child.content = "";
                    child.children = null;
                }
            }
        }
    });
}
