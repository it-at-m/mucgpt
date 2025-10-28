import { DialogContent, Field } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { ToolBase, ToolInfo, ToolListResponse } from "../../../api";
import { ToolsSelectorContent } from "../../ToolsSelector/ToolsSelector";
import styles from "../EditAssistantDialog.module.css";

interface ToolsStepProps {
    tools: ToolBase[];
    selectedTools: ToolInfo[];
    availableTools?: ToolListResponse;
    onToolsChange: (tools: ToolBase[]) => void;
    onHasChanged: (hasChanged: boolean) => void;
}

export const ToolsStep = ({ selectedTools, availableTools, onToolsChange, onHasChanged }: ToolsStepProps) => {
    const { t } = useTranslation();

    const handleSelectionChange = (newSelectedTools: ToolInfo[]) => {
        const newTools: ToolBase[] = newSelectedTools.map(tool => ({
            id: tool.id,
            config: {}
        }));
        onToolsChange(newTools);
        onHasChanged(true);
    };

    return (
        <DialogContent>
            <Field size="large" className={styles.formField}>
                <label className={styles.formLabel}>{t("components.edit_assistant_dialog.tools")}</label>
                <div className={styles.dynamicFieldContainer}>
                    <div className={styles.toolSelectorContainer}>
                        <ToolsSelectorContent
                            tools={availableTools}
                            selectedTools={selectedTools}
                            onSelectionChange={handleSelectionChange}
                            showActions={false}
                        />
                    </div>
                </div>
            </Field>
        </DialogContent>
    );
};
