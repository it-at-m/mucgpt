import { Badge, Tooltip } from "@fluentui/react-components";
import { Info24Regular } from "@fluentui/react-icons";
import styles from "./VersionInfo.module.css";
import { useTranslation } from "react-i18next";

interface VersionInfoProps {
    app_version?: string;
    core_version: string;
    frontend_version: string;
    assistant_version: string;
    versionUrl?: string;
    layout?: "inline" | "menu";
    className?: string;
}

const SERVICES = [
    { name: "mucgpt-frontend", getVersion: (p: VersionInfoProps) => p.frontend_version },
    { name: "mucgpt-core", getVersion: (p: VersionInfoProps) => p.core_version },
    { name: "mucgpt-assistants", getVersion: (p: VersionInfoProps) => p.assistant_version }
];

export const VersionInfo = (props: VersionInfoProps) => {
    const { app_version, frontend_version, versionUrl, layout = "inline", className } = props;
    const { t } = useTranslation();
    const versionLabel = app_version ?? frontend_version;
    const isMenuLayout = layout === "menu";
    const containerClassName = [styles.container, isMenuLayout ? styles.containerMenu : "", className ?? ""].filter(Boolean).join(" ");
    const badgeText = isMenuLayout ? `${t("components.versioninfo.label", "Version")} ${versionLabel}` : versionLabel;

    const tooltipContent = (
        <div className={styles.tooltipContent}>
            {SERVICES.map(service => (
                <div key={service.name} className={styles.tooltipRow}>
                    <span>{service.name}</span>
                    <span>{service.getVersion(props)}</span>
                </div>
            ))}
        </div>
    );

    return (
        <div className={containerClassName}>
            {versionUrl && (
                <a href={versionUrl} className={styles.versionLink}>
                    {t("components.versioninfo.whats_new", "Was gibt's neues?")}
                </a>
            )}
            <Tooltip content={tooltipContent} relationship="description" positioning="above" withArrow>
                {isMenuLayout ? (
                    <span tabIndex={0} className={styles.versionMenuButton}>
                        <Info24Regular />
                        <span>{badgeText}</span>
                    </span>
                ) : (
                    <Badge appearance="ghost" color="subtle" shape="circular" tabIndex={0} className={styles.versionBadge}>
                        {badgeText}
                    </Badge>
                )}
            </Tooltip>
        </div>
    );
};

export default VersionInfo;
