import { Tag } from "@fluentui/react-components";
import styles from "./VersionInfo.module.css";
import { useTranslation } from "react-i18next";

interface VersionInfoProps {
    version: string;
    commit?: string;
}

export const VersionInfo = ({ version, commit }: VersionInfoProps) => {
    const { t } = useTranslation();

    return (
        <div className={styles.container}>
            <div className={styles.versionContainer}>
                <span className={styles.label}>{t("components.versioninfo.label", "Version:")}</span>
                <Tag shape="circular">{version}</Tag>
                {commit && <Tag shape="circular">{commit}</Tag>}
            </div>
        </div>
    );
};

export default VersionInfo;
