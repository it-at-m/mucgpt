import { Tooltip } from "@fluentui/react-components";
import { Warning12Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import type { SensitiveContentFinding } from "../../api/models";
import { Badge } from "../../ui/Badge";
import styles from "./SensitiveContentBadge.module.css";
import { describeFindings } from "./sensitiveContent";

interface Props {
    findings: SensitiveContentFinding[] | undefined;
    confirmed?: boolean;
}

/** Lasting marker for documents with likely personal data or secrets. Renders nothing for clean or unscanned documents. */
export const SensitiveContentBadge = ({ findings, confirmed = false }: Props) => {
    const { t } = useTranslation();
    if (!findings?.length) return null;
    const description = t(confirmed ? "document_library.guardrails_badge_confirmed" : "document_library.guardrails_badge_hint", {
        findings: describeFindings(findings, t)
    });

    return (
        <Tooltip content={description} relationship="description" positioning="above">
            <Badge tabIndex={0} appearance="tint" color="warning" size="small" icon={<Warning12Regular />} className={styles.badge}>
                {t("document_library.guardrails_badge")}
                <span className={styles.visuallyHidden}>: {description}</span>
            </Badge>
        </Tooltip>
    );
};
