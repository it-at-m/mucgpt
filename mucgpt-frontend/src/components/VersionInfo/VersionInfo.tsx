import { Badge, Button, Popover, PopoverSurface, PopoverTrigger, Tooltip } from "@fluentui/react-components";
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
    const versionText = t("components.versioninfo.label", "Version");

    const versionDetails = (
        <div className={styles.versionDetails}>
            <div className={styles.versionDetailsHeader}>
                <span className={styles.versionDetailsTitle}>{t("components.versioninfo.details", "Versionsdetails")}</span>
            </div>
            <div className={styles.versionTable}>
                {SERVICES.map(service => (
                    <div key={service.name} className={styles.versionRow}>
                        <span className={styles.versionServiceName}>{service.name}</span>
                        <span className={styles.versionServiceVersion}>{service.getVersion(props)}</span>
                    </div>
                ))}
            </div>
        </div>
    );

    const versionTrigger = isMenuLayout ? (
        <Button appearance="subtle" className={styles.versionMenuButton} aria-label={`${versionText} ${versionLabel}`}>
            <span className={styles.versionMenuIcon} aria-hidden="true">
                <Info24Regular />
            </span>
            <span className={styles.versionMenuText}>
                {versionText} {versionLabel}
            </span>
        </Button>
    ) : (
        <Badge appearance="ghost" color="subtle" shape="circular" tabIndex={0} className={styles.versionBadge}>
            {versionLabel}
        </Badge>
    );

    const versionInfoControl = isMenuLayout ? (
        <Popover positioning={{ position: "after", align: "bottom", offset: { mainAxis: 8, crossAxis: -2 } }} size="small" withArrow>
            <PopoverTrigger disableButtonEnhancement>{versionTrigger}</PopoverTrigger>
            <PopoverSurface className={styles.versionPopoverSurface} tabIndex={-1}>
                {versionDetails}
            </PopoverSurface>
        </Popover>
    ) : (
        <Tooltip content={{ children: versionDetails, className: styles.versionTooltipSurface }} relationship="description" positioning="above" withArrow>
            {versionTrigger}
        </Tooltip>
    );

    return (
        <div className={containerClassName}>
            {versionUrl && (
                <a href={versionUrl} className={styles.versionLink}>
                    {t("components.versioninfo.whats_new", "Was gibt's neues?")}
                </a>
            )}
            {versionInfoControl}
        </div>
    );
};

export default VersionInfo;
