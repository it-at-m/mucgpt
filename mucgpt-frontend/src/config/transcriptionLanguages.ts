// Maps the app's i18n locale code to a Whisper language tag.
// Bavarian (BAY) is a German dialect not supported by Whisper → fall back to "de".
const LOCALE_TO_WHISPER: Record<string, string> = {
    DE: "de",
    EN: "en",
    FR: "fr",
    UK: "uk",
    BAY: "de"
};

export function localeToWhisperLang(locale: string): string | undefined {
    return LOCALE_TO_WHISPER[locale.toUpperCase().split("-")[0]];
}

/** Returns true if the model does not declare a language restriction or includes the given language. */
export function modelSupportsLanguage(modelLanguages: string[] | undefined, language: string | undefined): boolean {
    if (!modelLanguages || modelLanguages.length === 0) return true;
    if (!language) return true;
    return modelLanguages.includes(language);
}
