import { Badge, Tooltip } from "@fluentui/react-components";
import styles from "./VersionInfo.module.css";
import { useTranslation } from "react-i18next";

interface VersionInfoProps {
    app_version?: string;
    core_version: string;
    frontend_version: string;
    assistant_version: string;
    versionUrl?: string;
    variant?: "default" | "compact";
}

const SERVICES = [
    { name: "mucgpt-frontend", getVersion: (p: VersionInfoProps) => p.frontend_version },
    { name: "mucgpt-core", getVersion: (p: VersionInfoProps) => p.core_version },
    { name: "mucgpt-assistants", getVersion: (p: VersionInfoProps) => p.assistant_version }
];

export const VersionInfo = (props: VersionInfoProps) => {
    const { app_version, frontend_version, versionUrl, variant = "default" } = props;
    const { t } = useTranslation();
    const isCompact = variant === "compact";
    const versionLabel = `v${isCompact ? frontend_version : (app_version ?? frontend_version)}`;

    return (
        <div className={styles.container}>
            {versionUrl && (
                <a href={versionUrl} className={styles.versionLink}>
                    {t("components.versioninfo.whats_new", "Was gibt's neues?")}
                </a>
            )}
            <Tooltip
                content={
                    <div className={styles.tooltipContent}>
                        {SERVICES.map(service => (
                            <div key={service.name} className={styles.tooltipRow}>
                                <span>{service.name}</span>
                                <span>{service.getVersion(props)}</span>
                            </div>
                        ))}
                    </div>
                }
                relationship="description"
                positioning="above"
                withArrow
            >
                <Badge appearance="ghost" color="subtle" shape="circular" tabIndex={0} className={styles.versionBadge}>
                    {versionLabel}
                </Badge>
            </Tooltip>
        </div>
    );
};

export default VersionInfo;
