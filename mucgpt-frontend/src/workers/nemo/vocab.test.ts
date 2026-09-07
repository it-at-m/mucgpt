/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { nemoDetokenize, parseNemoVocab } from "./vocab";

const vocab = parseNemoVocab(readFileSync(new URL("./fixtures/canary-vocab.txt", import.meta.url), "utf8"));

/**
 * (input → output) pairs verified against the Python reference
 * `re.sub(r"\A\s|\s\B|(\s)\b", lambda m: " " if m.group(1) else "", text)`.
 * Includes non-ASCII cases to pin the Unicode-aware word-boundary port.
 */
const REGEX_REFERENCE: readonly (readonly [string, string])[] = [
    [" hello world !", "hello world!"],
    ["  double  spaces  here ", " double spaces here"],
    [" Hallo, wie geht's? ", "Hallo, wie geht's?"],
    [" H über", "H über"],
    ["München über überall", "München über überall"],
    ["Monaco ( Ville ) ", "Monaco( Ville)"],
    ["e.g. U.S.A. today", "e.g. U.S.A. today"]
];

function idOf(token: string): number {
    const id = vocab.tokenToId.get(token);
    if (id === undefined) throw new Error(`token ${JSON.stringify(token)} not found in vocabulary`);
    return id;
}

/** Greedy longest-match segmentation of raw text into vocabulary tokens. */
function textToIds(text: string): number[] {
    const ids: number[] = [];
    let pos = 0;
    while (pos < text.length) {
        let matched = 0;
        for (const token of vocab.tokenToId.keys()) {
            if (token.length > matched && text.startsWith(token, pos)) matched = token.length;
        }
        if (matched === 0) throw new Error(`no vocabulary token matches ${JSON.stringify(text.slice(pos, pos + 10))}`);
        ids.push(vocab.tokenToId.get(text.slice(pos, pos + matched)) as number);
        pos += matched;
    }
    return ids;
}

function detokenize(tokens: string[]): string {
    return nemoDetokenize(tokens.map(idOf), vocab);
}

describe("parseNemoVocab", () => {
    it("parses all 5248 entries into contiguous ids", () => {
        expect(vocab.idToToken.length).toBe(5248);
        for (let id = 0; id < 5248; id++) expect(typeof vocab.idToToken[id]).toBe("string");
    });

    it("maps the control and language tokens to their documented ids", () => {
        // Duplicate tokens (<unk>, " ", many subwords) resolve to their LAST id, matching the
        // Python reference `{token: id for id, token in vocab.items()}` (onnx-asr). All canary
        // control/language tokens are unique.
        expect(vocab.idToToken[0]).toBe("<unk>");
        expect(vocab.tokenToId.get("<unk>")).toBe(4224);
        expect(vocab.tokenToId.get("<|endoftext|>")).toBe(3);
        expect(vocab.tokenToId.get("<|startoftranscript|>")).toBe(4);
        expect(vocab.tokenToId.get("<|pnc|>")).toBe(5);
        expect(vocab.tokenToId.get("<|en|>")).toBe(62);
        expect(vocab.tokenToId.get("<|fr|>")).toBe(69);
        expect(vocab.tokenToId.get("<|de|>")).toBe(76);
        expect(vocab.tokenToId.get("<|es|>")).toBe(169);
    });

    it("replaces the SentencePiece word-boundary marker ▁ with a space", () => {
        expect(vocab.idToToken[1151]).toBe(" ");
        // " " is a duplicate token (ids 1151/2023/3050/4089/5072); last-wins matches the
        // Python reference `{token: id for id, token in vocab.items()}` (onnx-asr), and the
        // canary decoder prompt is conditioned on this id — verified end-to-end vs onnx-asr.
        expect(vocab.tokenToId.get(" ")).toBe(5072);
        expect(vocab.idToToken[idOf(" ,")]).toBe(" ,");
    });
});

describe("nemoDetokenize", () => {
    it("reproduces the Python-verified whitespace-collapse reference pairs", () => {
        for (const [input, expected] of REGEX_REFERENCE) {
            expect(nemoDetokenize(textToIds(input), vocab), `input ${JSON.stringify(input)}`).toBe(expected);
        }
    });

    it("strips the leading word-boundary space and keeps single separators", () => {
        expect(detokenize([" her", " wor", " tod"])).toBe("her wor tod");
    });

    it("removes the space before punctuation, as in ' hello world !' → 'hello world!'", () => {
        expect(detokenize([" wor", " s", "!"])).toBe("wor s!");
    });

    it("collapses double spaces, keeps one leading space and drops the trailing one", () => {
        expect(detokenize([" ", " dou", " ", " tod", " "])).toBe(" dou tod");
    });

    it("attaches punctuation to the preceding word and starts the next one spaced", () => {
        expect(detokenize([" H", ",", " w", "?"])).toBe("H, w?");
    });

    it("keeps separators before non-ASCII word characters (Unicode word boundaries, unlike JS \\b)", () => {
        expect(detokenize([" H", " ", "über"])).toBe("H über");
        expect(nemoDetokenize([idOf(" H"), idOf(" "), idOf("über"), idOf("über")], vocab)).toBe("H überüber");
    });

    it("drops the space before an opening bracket, as in 'Monaco ( Ville ) ' → 'Monaco( Ville)'", () => {
        expect(detokenize([" M", "(", " V", ")"])).toBe("M( V)");
    });

    it("keeps spacing around word-initial pieces, as in 'e.g. U.S.A. today' (unchanged apart from leading space)", () => {
        expect(detokenize([" U", ".", "S", ".", "A", ".", " tod"])).toBe("U.S.A. tod");
    });

    it("filters special tokens out of the decoded text", () => {
        expect(detokenize([" her", "<|endoftext|>", "<unk>", " wor"])).toBe("her wor");
    });

    it("returns the empty string when only special tokens are emitted", () => {
        expect(nemoDetokenize([0, 3, 4, 5, 62], vocab)).toBe("");
    });

    it("ignores ids without a vocabulary entry", () => {
        expect(nemoDetokenize([99999], vocab)).toBe("");
    });
});
