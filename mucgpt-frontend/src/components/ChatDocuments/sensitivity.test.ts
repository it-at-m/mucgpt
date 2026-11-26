import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";

import type { DocumentSensitivity, SensitivityFinding } from "../../api/models";
import { getUnconfirmedDocuments, isSendBlockedByDocuments, toChatDocument } from "./documentSelection";
import { describeFindings, needsSensitivityConfirmation } from "./sensitivity";

const t = ((key: string, options?: Record<string, unknown>) =>
    key === "document_library.sensitivity_finding"
        ? `${options?.count}× ${options?.category}`
        : key.replace("document_library.sensitivity_category_", "")) as TFunction;

const finding = (overrides: Partial<SensitivityFinding>): SensitivityFinding => ({
    category: "iban",
    kind: "pii",
    confidence: "certain",
    count: 1,
    ...overrides
});

const sensitivity = (overrides: Partial<DocumentSensitivity>): DocumentSensitivity => ({
    findings: [finding({})],
    requires_acknowledgement: true,
    acknowledged: false,
    ...overrides
});

const metadata = (value: DocumentSensitivity) => ({
    id: "doc",
    filename: "Antrag.txt",
    mime_type: "text/plain",
    original_size: 5,
    text_length: 5,
    preview: "text",
    preview_kind: "initial_excerpt",
    path: "/documents/doc.txt",
    created_at: "2026-11-02",
    sensitivity: value
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

describe("sensitivity confirmation", () => {
    it("is needed only for flagged documents that are not confirmed yet", () => {
        expect(needsSensitivityConfirmation(sensitivity({}))).toBe(true);
        expect(needsSensitivityConfirmation(sensitivity({ acknowledged: true }))).toBe(false);
        expect(needsSensitivityConfirmation(sensitivity({ findings: [], requires_acknowledgement: false }))).toBe(false);
        expect(needsSensitivityConfirmation(undefined)).toBe(false);
    });

    it("blocks sending unconfirmed documents but keeps the findings of confirmed ones", () => {
        const unconfirmed = toChatDocument(metadata(sensitivity({})));
        const confirmed = toChatDocument(metadata(sensitivity({ acknowledged: true })));

        expect(getUnconfirmedDocuments([unconfirmed, confirmed])).toEqual([unconfirmed]);
        expect(isSendBlockedByDocuments([unconfirmed])).toBe(true);
        expect(isSendBlockedByDocuments([confirmed])).toBe(false);
        expect(confirmed.status === "ready" && confirmed.sensitiveFindings).toEqual([finding({})]);
    });
});
