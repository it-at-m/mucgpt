import { Tag, Tooltip } from "@fluentui/react-components";
import { InfoRegular } from "@fluentui/react-icons";
import styles from "./VersionInfo.module.css";
import { useTranslation } from "react-i18next";

interface VersionInfoProps {
    core_version: string;
    frontend_version: string;
    assistant_version: string;
    versionUrl?: string;
}

export const VersionInfo = ({ core_version, versionUrl, frontend_version, assistant_version }: VersionInfoProps) => {
    const { t } = useTranslation();

    const tooltipContent =
        t("components.versioninfo.tooltip", "Application version: {{core_version}}, Frontend Version: {{frontend_version}}, Assistant Version {{assistant_version}} ", { core_version, frontend_version, assistant_version });

    const content = (
        <div className={styles.versionContainer}>
            <InfoRegular className={styles.infoIcon} aria-hidden />
            <span className={styles.label}>{t("components.versioninfo.core_version", "Core Version:")}</span>
            <Tag shape="circular">{core_version}</Tag>
            <span className={styles.label}>{t("components.versioninfo.frontend_version", "Frontend Version:")}</span>
            <Tag shape="circular">{frontend_version}</Tag>
            <span className={styles.label}>{t("components.versioninfo.assistant_version", "Assistant Version:")}</span>
            <Tag shape="circular">{assistant_version}</Tag>
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
