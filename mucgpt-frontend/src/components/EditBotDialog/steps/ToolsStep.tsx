import { DialogContent, Field, Button } from "@fluentui/react-components";
import { Add24Regular, Delete24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { ToolBase, ToolInfo } from "../../../api";
import styles from "../EditBotDialog.module.css";

interface ToolsStepProps {
    tools: ToolBase[];
    selectedTools: ToolInfo[];
    isOwner: boolean;
    onToolsChange: (tools: ToolBase[]) => void;
    onSelectedToolsChange: (tools: ToolInfo[]) => void;
    onShowToolsSelector: () => void;
    onHasChanged: (hasChanged: boolean) => void;
}

export const ToolsStep = ({ tools, selectedTools, isOwner, onToolsChange, onSelectedToolsChange, onShowToolsSelector, onHasChanged }: ToolsStepProps) => {
    const { t } = useTranslation();

    const handleRemoveTool = (toolName: string) => {
        const newTools = tools.filter(t => t.id !== toolName);
        onToolsChange(newTools);
        const newSelectedTools = selectedTools.filter(t => t.name !== toolName);
        onSelectedToolsChange(newSelectedTools);
        onHasChanged(true);
    };

    return (
        <DialogContent>
            <Field size="large" className={styles.formField}>
                <label className={styles.formLabel}>{t("components.edit_bot_dialog.tools")}</label>
                <div className={styles.dynamicFieldContainer}>
                    <div className={styles.dynamicFieldList}>
                        {selectedTools.length > 0 ? (
                            selectedTools.map((tool, index) => (
                                <div key={tool.name + index} className={styles.dynamicFieldItem}>
                                    <div className={styles.dynamicFieldInputs}>
                                        <div className={styles.dynamicFieldInputRow}>
                                            <span className={styles.dynamicFieldInputLabel}>{tool.name}:</span>
                                            <span className={styles.toolDescription}>{tool.description}</span>
                                        </div>
                                    </div>
                                    <button
                                        className={styles.removeFieldButton}
                                        onClick={() => handleRemoveTool(tool.name)}
                                        disabled={!isOwner}
                                        title={t("components.edit_bot_dialog.remove")}
                                    >
                                        <Delete24Regular />
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className={styles.noToolsText}>{t("components.edit_bot_dialog.no_tools_selected")}</div>
                        )}
                    </div>
                    {isOwner && (
                        <Button appearance="subtle" onClick={onShowToolsSelector} disabled={!isOwner} className={styles.addFieldButton}>
                            <Add24Regular /> {t("components.edit_bot_dialog.select_tools")}
                        </Button>
                    )}
                </div>
            </Field>
        </DialogContent>
    );
};
