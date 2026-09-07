// Maps the app's i18n locale code (see LanguageSelector.AVAILABLE_LANGUAGES) to a Whisper language tag.
// Bavarian (BA) is a German dialect not supported by Whisper → fall back to "de".
const LOCALE_TO_WHISPER: Record<string, string> = {
    DE: "de",
    EN: "en",
    BA: "de",
    FR: "fr",
    UK: "uk"
};

/**
 * Maps an app i18n locale code (e.g. "de-DE", "BA") to the Whisper language
 * tag for transcription. Returns undefined when the locale has no Whisper
 * equivalent, letting Whisper auto-detect.
 */
export function localeToWhisperLang(locale: string): string | undefined {
    return LOCALE_TO_WHISPER[locale.toUpperCase().split("-")[0]];
}

/** Returns true if the model does not declare a language restriction or includes the given language. */
export function modelSupportsLanguage(modelLanguages: string[] | undefined, language: string | undefined): boolean {
    if (!modelLanguages || modelLanguages.length === 0) return true;
    if (!language) return true;
    return modelLanguages.includes(language);
}
