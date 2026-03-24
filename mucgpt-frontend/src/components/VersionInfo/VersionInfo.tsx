import { Tag, Tooltip } from "@fluentui/react-components";
import { InfoRegular } from "@fluentui/react-icons";
import styles from "./VersionInfo.module.css";
import { useTranslation } from "react-i18next";

interface VersionInfoProps {
    core_version: string;
    frontend_version: string;
    assistant_version: string;
    versionUrl?: string;
    variant?: "default" | "compact";
}

export const VersionInfo = ({ core_version, versionUrl, frontend_version, assistant_version, variant = "default" }: VersionInfoProps) => {
    const { t } = useTranslation();
    const isCompact = variant === "compact";

    const tooltipContent = t(
        "components.versioninfo.tooltip",
        "Application version: {{core_version}}, Frontend Version: {{frontend_version}}, Assistant Version: {{assistant_version}}",
        {
            core_version,
            frontend_version,
            assistant_version
        }
    );

    const content = (
        <div className={`${styles.versionContainer} ${isCompact ? styles.versionContainerCompact : ""}`}>
            <InfoRegular className={styles.infoIcon} aria-hidden />
            <span className={`${styles.label} ${isCompact ? styles.labelCompact : ""}`}>{t("components.versioninfo.core_version", "Core Version:")}</span>
            <Tag shape="circular" className={isCompact ? styles.tagCompact : undefined}>
                {core_version}
            </Tag>
            <span className={`${styles.label} ${isCompact ? styles.labelCompact : ""}`}>
                {t("components.versioninfo.frontend_version", "Frontend Version:")}
            </span>
            <Tag shape="circular" className={isCompact ? styles.tagCompact : undefined}>
                {frontend_version}
            </Tag>
            <span className={`${styles.label} ${isCompact ? styles.labelCompact : ""}`}>
                {t("components.versioninfo.assistant_version", "Assistant Version:")}
            </span>
            <Tag shape="circular" className={isCompact ? styles.tagCompact : undefined}>
                {assistant_version}
            </Tag>
        </div>
    );

    if (versionUrl) {
        return (
            <>
                <Tooltip content={tooltipContent} relationship="description" positioning="above">
                    {content}
                </Tooltip>
                <a href={versionUrl} className={`${styles.versionLink} ${isCompact ? styles.versionLinkCompact : ""}`}>
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
