import { Badge, Tooltip } from "@fluentui/react-components";
import styles from "./VersionInfo.module.css";
import { useTranslation } from "react-i18next";

interface VersionInfoProps {
    app_version: string;
    core_version: string;
    frontend_version: string;
    assistant_version: string;
    versionUrl?: string;
}

export const VersionInfo = ({ app_version, core_version, versionUrl, frontend_version, assistant_version }: VersionInfoProps) => {
    const { t } = useTranslation();

    return (
        <div className={styles.container}>
            <Tooltip
                content={
                    <div className={styles.tooltipContent}>
                        <div className={styles.tooltipRow}>
                            <span className={styles.tooltipService}>{t("components.versioninfo.service_frontend")}</span>
                            <span className={styles.tooltipVersion}>{frontend_version}</span>
                        </div>
                        <div className={styles.tooltipRow}>
                            <span className={styles.tooltipService}>{t("components.versioninfo.service_core")}</span>
                            <span className={styles.tooltipVersion}>{core_version}</span>
                        </div>
                        <div className={styles.tooltipRow}>
                            <span className={styles.tooltipService}>{t("components.versioninfo.service_assistants")}</span>
                            <span className={styles.tooltipVersion}>{assistant_version}</span>
                        </div>
                    </div>
                }
                relationship="description"
                positioning="above"
                withArrow
            >
                <Badge appearance="outline" color="subtle" shape="circular" tabIndex={0}>
                    v{app_version}
                </Badge>
            </Tooltip>
            {versionUrl && (
                <a href={versionUrl} className={styles.versionLink}>
                    {t("components.versioninfo.whats_new", "Was gibt's neues?")}
                </a>
            )}
        </div>
    );
};

export default VersionInfo;
