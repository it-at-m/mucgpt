import type { NemoVocab } from "./types";

/**
 * istupakov-style NeMo vocabulary file: one `"<token> <id>"` pair per line,
 * SentencePiece word-boundary marker ▁ (U+2581) decodes to a literal space.
 * Duplicate token strings resolve to the LAST id, matching the Python reference
 * `{token: id for id, token in vocab.items()}` (onnx-asr) — e.g. " " maps to 5072,
 * not the earlier duplicate 1151/2023/3050/4089. The canary decoder prompt is
 * conditioned on the " " id, so a wrong choice silently degrades transcripts.
 */
export function parseNemoVocab(text: string): NemoVocab {
    const idToToken: string[] = [];
    const tokenToId = new Map<string, number>();
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const separator = trimmed.lastIndexOf(" ");
        if (separator <= 0) continue;
        const token = trimmed.slice(0, separator).replaceAll("\u2581", " ");
        const id = Number(trimmed.slice(separator + 1));
        if (!Number.isInteger(id) || id < 0) continue;
        idToToken[id] = token;
        tokenToId.set(token, id);
    }
    return { idToToken, tokenToId };
}

function isSpecialToken(token: string): boolean {
    return token.startsWith("<|") || token === "<unk>" || token === "<pad>" || token === "<blk>";
}

export function nemoDetokenize(ids: number[], vocab: NemoVocab): string {
    let text = "";
    for (const id of ids) {
        const token = vocab.idToToken[id];
        if (token === undefined || isSpecialToken(token)) continue;
        text += token;
    }
    // Strip the leading boundary space and collapse whitespace runs, matching onnx-asr's
    // `re.sub(r"\A\s|\s\B|(\s)\b", lambda m: " " if m.group(1) else "", text)`.
    return text.replace(/^\s/, "").replace(/\s\B|(\s)\b/g, (_match, spaceGroup: string | undefined) => (spaceGroup ? " " : ""));
}
