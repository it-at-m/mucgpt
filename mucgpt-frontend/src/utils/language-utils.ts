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
