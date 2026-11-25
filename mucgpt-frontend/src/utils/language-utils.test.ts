import { describe, expect, it } from "vitest";
import { mapContextToBackendLang, mapUILanguageToWhisper } from "./language-utils";

describe("mapUILanguageToWhisper", () => {
    it.each([
        ["de", "de"],
        ["Deutsch", "de"],
        ["german", "de"],
        ["bairisch", "de"],
        ["Bavarian", "de"],
        ["bayerisch", "de"],
        ["en", "en"],
        ["English", "en"],
        ["fr", "fr"],
        ["français", "fr"],
        ["french", "fr"],
        ["uk", "uk"],
        ["українська", "uk"],
        ["Ukrainisch", "uk"]
    ])("maps %s to %s", (input, expected) => {
        expect(mapUILanguageToWhisper(input)).toBe(expected);
    });

    it("returns undefined for unknown languages so Whisper auto-detects", () => {
        expect(mapUILanguageToWhisper("spanish")).toBeUndefined();
        expect(mapUILanguageToWhisper("")).toBeUndefined();
    });
});

describe("mapContextToBackendLang", () => {
    it.each([
        ["en", "english"],
        ["English", "english"],
        ["fr", "français"],
        ["francais", "français"],
        ["French", "français"],
        ["bairisch", "bairisch"],
        ["bayerisch", "bairisch"],
        ["uk", "українська"],
        ["Ukrainian", "українська"],
        ["de", "deutsch"],
        ["Deutsch", "deutsch"],
        ["german", "deutsch"],
        ["unknown", "deutsch"]
    ])("maps %s to %s", (input, expected) => {
        expect(mapContextToBackendLang(input)).toBe(expected);
    });
});
