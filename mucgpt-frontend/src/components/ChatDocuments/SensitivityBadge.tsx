import { Tooltip } from "@fluentui/react-components";
import { Warning12Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import type { SensitivityFinding } from "../../api/models";
import { Badge } from "../../ui/Badge";
import styles from "./SensitivityBadge.module.css";
import { describeFindings } from "./sensitivity";

interface Props {
    findings: SensitivityFinding[] | undefined;
    /** Confirmed documents keep the badge as a reminder; only the description changes. */
    truncated?: boolean;
    confirmed?: boolean;
}

/** Lasting marker for documents with likely personal data or secrets. Renders nothing for clean or unscanned documents. */
export const SensitivityBadge = ({ findings, truncated, confirmed = false }: Props) => {
    const { t } = useTranslation();
    if (!findings?.length)
        return truncated ? (
            <Badge appearance="tint" color="warning">
                {t("document_library.partial_scan")}
            </Badge>
        ) : null;

    const description = t(confirmed ? "document_library.sensitivity_badge_confirmed" : "document_library.sensitivity_badge_hint", {
        findings: describeFindings(findings, t)
    });

    return (
        <Tooltip content={description} relationship="description" positioning="above">
            <Badge appearance="tint" color="warning" size="small" icon={<Warning12Regular />} className={styles.badge}>
                {t("document_library.sensitivity_badge")}
                {truncated && ` · ${t("document_library.partial_scan")}`}
                <span className={styles.visuallyHidden}>: {description}</span>
            </Badge>
        </Tooltip>
    );
};
