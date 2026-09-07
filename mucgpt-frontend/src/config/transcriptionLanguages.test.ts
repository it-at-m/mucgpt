import { describe, expect, it } from "vitest";
import { localeToWhisperLang, modelSupportsLanguage } from "./transcriptionLanguages";

describe("localeToWhisperLang", () => {
    it("maps all app locales to whisper language tags", () => {
        expect(localeToWhisperLang("DE")).toBe("de");
        expect(localeToWhisperLang("EN")).toBe("en");
        expect(localeToWhisperLang("FR")).toBe("fr");
        expect(localeToWhisperLang("UK")).toBe("uk");
    });

    it("falls back from Bavarian to German", () => {
        expect(localeToWhisperLang("BA")).toBe("de");
    });

    it("is case-insensitive and strips regional subtags", () => {
        expect(localeToWhisperLang("de-DE")).toBe("de");
        expect(localeToWhisperLang("en-US")).toBe("en");
    });

    it("returns undefined for unknown locales", () => {
        expect(localeToWhisperLang("XX")).toBeUndefined();
        expect(localeToWhisperLang("")).toBeUndefined();
    });
});

describe("modelSupportsLanguage", () => {
    it("accepts everything when the model declares no restriction", () => {
        expect(modelSupportsLanguage(undefined, "de")).toBe(true);
        expect(modelSupportsLanguage([], "de")).toBe(true);
    });

    it("accepts everything when no language is selected", () => {
        expect(modelSupportsLanguage(["de", "en"], undefined)).toBe(true);
    });

    it("matches declared languages", () => {
        expect(modelSupportsLanguage(["de", "en"], "de")).toBe(true);
        expect(modelSupportsLanguage(["de", "en"], "en")).toBe(true);
    });

    it("rejects undeclared languages (e.g. Ukrainian on German-only models)", () => {
        expect(modelSupportsLanguage(["de", "en"], "uk")).toBe(false);
        expect(modelSupportsLanguage(["de", "en"], "fr")).toBe(false);
    });
});
