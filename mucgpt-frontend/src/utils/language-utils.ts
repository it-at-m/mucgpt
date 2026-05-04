/**
 * Maps UI language context values to Whisper language codes.
 * Returns undefined for unsupported languages → Whisper auto-detects.
 */
export function mapUILanguageToWhisper(contextLang: string): string | undefined {
    switch (contextLang.toLowerCase()) {
        case "de":
        case "deutsch":
        case "german":
        case "bairisch":
        case "bavarian":
        case "bayerisch":
            return "de";
        case "en":
        case "english":
            return "en";
        case "fr":
        case "français":
        case "francais":
        case "french":
            return "fr";
        case "uk":
        case "українська":
        case "ukrainisch":
        case "ukrainian":
            return "uk";
        default:
            return undefined; // let Whisper auto-detect
    }
}

/**
 * Maps language context values to backend language parameters
 * @param contextLang The language from LanguageContext
 * @returns The corresponding backend language parameter
 */
export function mapContextToBackendLang(contextLang: string): string {
    const lang = contextLang.toLowerCase();

    switch (lang) {
        case "english":
        case "en":
            return "english";
        case "français":
        case "francais":
        case "french":
        case "fr":
            return "français";
        case "bairisch":
        case "bavarian":
        case "bayerisch":
            return "bairisch";
        case "українська":
        case "ukrainisch":
        case "ukrainian":
        case "uk":
            return "українська";
        case "deutsch":
        case "german":
        case "de":
        default:
            return "deutsch";
    }
}
