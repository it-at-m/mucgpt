/** Bavarian ("BA") has no Intl locale data, so dates and numbers fall back to German formatting. */
export const toIntlLocale = (language: string) => (language === "BA" ? "de-DE" : language);
