import { Tag, Tooltip } from "@fluentui/react-components";
import { InfoRegular } from "@fluentui/react-icons";
import styles from "./VersionInfo.module.css";
import { useTranslation } from "react-i18next";

interface VersionInfoProps {
    version: string;
    commit?: string;
    versionUrl?: string;
}

export const VersionInfo = ({ version, commit, versionUrl }: VersionInfoProps) => {
    const { t } = useTranslation();

    const tooltipContent = commit
        ? t("components.versioninfo.tooltip_with_commit", "Application version: {{version}}, Commit: {{commit}}", { version, commit })
        : t("components.versioninfo.tooltip", "Application version: {{version}}", { version });

    const content = (
        <div className={styles.versionContainer}>
            <InfoRegular className={styles.infoIcon} aria-hidden />
            <span className={styles.label}>{t("components.versioninfo.label", "Version:")}</span>
            <Tag shape="circular">{version}</Tag>
            {commit && <Tag shape="circular">{commit}</Tag>}
        </div>
    );

    if (versionUrl) {
        return (
            <>
                <Tooltip content={tooltipContent} relationship="description" positioning="above">
                    {content}
                </Tooltip>
                <a href={versionUrl} className={styles.versionLink}>
                    {t("components.versioninfo.whats_new", "Was gibt's neues?")}
                </a>
            </>
        );
    }

    return (
        <Tooltip content={tooltipContent} relationship="description" positioning="above">
            <div className={styles.container}>{content}</div>
        </Tooltip>
    );
};

export default VersionInfo;
