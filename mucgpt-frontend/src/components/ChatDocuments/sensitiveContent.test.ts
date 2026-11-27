import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";

import type { SensitiveContentFinding } from "../../api/models";
import { describeFindings } from "./sensitiveContent";

const t = ((key: string, options?: Record<string, unknown>) =>
    key === "document_library.guardrails_finding"
        ? `${options?.count}× ${options?.category}`
        : key.replace("document_library.guardrails_category_", "")) as TFunction;

const finding = (overrides: Partial<SensitiveContentFinding>): SensitiveContentFinding => ({
    category: "iban",
    kind: "pii",
    confidence: "certain",
    count: 1,
    ...overrides
});

describe("describeFindings", () => {
    it("merges confidences of one category and keeps the backend order", () => {
        const findings = [
            finding({ category: "credential_assignment", kind: "secret", confidence: "likely", count: 1 }),
            finding({ category: "tax_id", confidence: "certain", count: 1 }),
            finding({ category: "tax_id", confidence: "likely", count: 2 })
        ];

        expect(describeFindings(findings, t)).toBe("1× credential_assignment, 3× tax_id");
    });
});
