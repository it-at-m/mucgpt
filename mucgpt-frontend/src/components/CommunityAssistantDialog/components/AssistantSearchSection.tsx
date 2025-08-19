import { SearchBox, Text, Dropdown, Option } from "@fluentui/react-components";
import { ArrowSort24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import styles from "../CommunityAssistantDialog.module.css";

interface AssistantSearchSectionProps {
    searchValue: string;
    onSearchChange: (event: any, data: any) => void;
    sortMethod: string;
    onSortMethodChange: (event: any, data: any) => void;
}

export const AssistantSearchSection = ({ searchValue, onSearchChange, sortMethod, onSortMethodChange }: AssistantSearchSectionProps) => {
    const { t } = useTranslation();

    return (
        <div className={styles.searchSection}>
            <SearchBox placeholder={t("components.community_assistants.search")} value={searchValue} onChange={onSearchChange} className={styles.searchBox} />

            <div className={styles.sortSection}>
                <ArrowSort24Regular className={styles.sortIcon} />
                <Text size={300} className={styles.sortLabel}>
                    {t("components.community_assistants.sort_by")}:
                </Text>
                <Dropdown
                    id="sort"
                    value={sortMethod}
                    selectedOptions={[sortMethod]}
                    appearance="outline"
                    size="small"
                    className={styles.sortDropdown}
                    onOptionSelect={onSortMethodChange}
                >
                    <Option value={t("components.community_assistants.sort_title")} text={t("components.community_assistants.sort_title")}>
                        {t("components.community_assistants.sort_title")}
                    </Option>
                    <Option value={t("components.community_assistants.sort_updated")} text={t("components.community_assistants.sort_updated")}>
                        {t("components.community_assistants.sort_updated")}
                    </Option>
                    <Option value={t("components.community_assistants.sort_subscriptions")} text={t("components.community_assistants.sort_subscriptions")}>
                        {t("components.community_assistants.sort_subscriptions")}
                    </Option>
                </Dropdown>
            </div>
        </div>
    );
};
