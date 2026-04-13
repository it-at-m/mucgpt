import { Badge, Link, Tooltip } from "@fluentui/react-components";
import styles from "./VersionInfo.module.css";
import { useTranslation } from "react-i18next";

interface VersionInfoProps {
    app_version: string;
    core_version: string;
    frontend_version: string;
    assistant_version: string;
    versionUrl?: string;
}

const SERVICES = [
    { name: "mucgpt-frontend", getVersion: (p: VersionInfoProps) => p.frontend_version },
    { name: "mucgpt-core", getVersion: (p: VersionInfoProps) => p.core_version },
    { name: "mucgpt-assistants", getVersion: (p: VersionInfoProps) => p.assistant_version }
];

export const VersionInfo = (props: VersionInfoProps) => {
    const { app_version, versionUrl } = props;
    const { t } = useTranslation();

    return (
        <div className={styles.container}>
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
