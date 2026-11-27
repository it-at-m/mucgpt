import type { TFunction } from "i18next";

import type { SensitiveContentCategory, SensitiveContentFinding, SensitiveContentGuardrail } from "../../api/models";

export const getSensitiveFindings = (guardrail: SensitiveContentGuardrail | undefined): SensitiveContentFinding[] => guardrail?.findings ?? [];

/** Lists categories with counts, e.g. "2× IBAN, 1× password or credential"; the matched values are never known to the frontend. */
export const describeFindings = (findings: SensitiveContentFinding[], t: TFunction) => {
    // "certain" and "likely" hits of one category are shown together.
    const counts = new Map<SensitiveContentCategory, number>();
    for (const finding of findings) {
        counts.set(finding.category, (counts.get(finding.category) ?? 0) + finding.count);
    }
    return Array.from(counts, ([category, count]) =>
        t("document_library.guardrails_finding", { count, category: t(`document_library.guardrails_category_${category}`) })
    ).join(", ");
};
