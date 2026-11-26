import type { TFunction } from "i18next";

import type { DocumentSensitivity, SensitivityCategory, SensitivityFinding } from "../../api/models";

export const getSensitiveFindings = (sensitivity: DocumentSensitivity | undefined): SensitivityFinding[] => sensitivity?.findings ?? [];

/** Lists categories with counts, e.g. "2× IBAN, 1× password or credential"; the matched values are never known to the frontend. */
export const describeFindings = (findings: SensitivityFinding[], t: TFunction) => {
    // "certain" and "likely" hits of one category are shown together.
    const counts = new Map<SensitivityCategory, number>();
    for (const finding of findings) {
        counts.set(finding.category, (counts.get(finding.category) ?? 0) + finding.count);
    }
    return Array.from(counts, ([category, count]) =>
        t("document_library.sensitivity_finding", { count, category: t(`document_library.sensitivity_category_${category}`) })
    ).join(", ");
};
