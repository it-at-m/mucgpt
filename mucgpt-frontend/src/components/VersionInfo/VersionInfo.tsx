import { Caption1, Caption1Strong, Menu, MenuItem, MenuPopover, MenuTrigger } from "@fluentui/react-components";
import { Info24Regular } from "@fluentui/react-icons";
import styles from "./VersionInfo.module.css";
import { useTranslation } from "react-i18next";

interface VersionInfoProps {
    app_version?: string;
    core_version: string;
    frontend_version: string;
    assistant_version: string;
}

const SERVICES = [
    { name: "mucgpt-frontend", getVersion: (p: VersionInfoProps) => p.frontend_version },
    { name: "mucgpt-core", getVersion: (p: VersionInfoProps) => p.core_version },
    { name: "mucgpt-assistants", getVersion: (p: VersionInfoProps) => p.assistant_version }
];

export const VersionInfo = (props: VersionInfoProps) => {
    const { app_version, frontend_version } = props;
    const { t } = useTranslation();
    const versionLabel = app_version ?? frontend_version;

    return (
        <Menu>
            <MenuTrigger disableButtonEnhancement>
                <MenuItem hasSubmenu icon={<Info24Regular />} secondaryContent={versionLabel}>
                    {t("components.versioninfo.label", "Version")}
                </MenuItem>
            </MenuTrigger>
            <MenuPopover>
                <Caption1Strong block className={styles.versionDetailsTitle}>
                    {t("components.versioninfo.details", "Versionsdetails")}
                </Caption1Strong>
                <div className={styles.versionTable}>
                    {SERVICES.map(service => (
                        <div key={service.name} className={styles.versionRow}>
                            <Caption1 className={styles.versionServiceName}>{service.name}</Caption1>
                            <Caption1Strong>{service.getVersion(props)}</Caption1Strong>
                        </div>
                    ))}
                </div>
            </MenuPopover>
        </Menu>
    );
};

export default VersionInfo;
