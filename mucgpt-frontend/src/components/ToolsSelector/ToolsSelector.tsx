import * as React from "react";
import { ToolListResponse, ToolInfo } from "../../api/models";
import { Dialog, DialogSurface, DialogTitle, DialogBody, DialogContent, Button, Text, Checkbox } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import styles from "./ToolsSelector.module.css";

interface ToolsSelectorContentProps {
    tools?: ToolListResponse;
    selectedTools?: ToolInfo[];
    onSelectionChange: (selectedTools: ToolInfo[]) => void;
    showActions?: boolean;
    onApply?: () => void;
    onCancel?: () => void;
}

export const ToolsSelectorContent: React.FC<ToolsSelectorContentProps> = ({
    tools,
    selectedTools,
    onSelectionChange,
    showActions = true,
    onApply,
    onCancel
}) => {
    const { t } = useTranslation();
    const [selected, setSelected] = React.useState<Set<string>>(new Set());

    React.useEffect(() => {
        if (selectedTools) {
            setSelected(new Set(selectedTools.map(t => t.id)));
        }
    }, [selectedTools]);

    const handleToggle = (tool: ToolInfo) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(tool.id)) {
                next.delete(tool.id);
            } else {
                next.add(tool.id);
            }

            // Notify parent of change
            if (tools) {
                const updatedTools = tools.tools.filter(t => next.has(t.id));
                onSelectionChange(updatedTools);
            }

            return next;
        });
    };

    const handleSelectAll = () => {
        if (tools) {
            const allIds = new Set(tools.tools.map(t => t.id));
            setSelected(allIds);
            onSelectionChange(tools.tools);
        }
    };

    return (
        <>
            {tools && tools.tools.length > 0 ? (
                <>
                    {showActions && (
                        <div className={styles.actionsContainer} style={{ justifyContent: "flex-start", marginBottom: 8 }}>
                            <Button size="small" appearance="secondary" onClick={handleSelectAll}>
                                {t("components.toolsselector.select_all")}
                            </Button>
                        </div>
                    )}
                    <div className={styles.toolCardsContainer}>
                        {tools.tools.map((tool: ToolInfo) => (
                            <div key={tool.id} className={styles.toolCard}>
                                <span className={styles.toolCardHeader}>
                                    <span className={styles.toolName}>{tool.name}</span>
                                    <span className={styles.toolDescription}>{tool.description}</span>
                                </span>
                                <Checkbox
                                    checked={selected.has(tool.id)}
                                    onChange={() => handleToggle(tool)}
                                    className={styles.toolCardCheckbox}
                                    aria-label={tool.name}
                                />
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <Text className={styles.noTools}>{t("components.toolsselector.none")}</Text>
            )}
            {showActions && (
                <div className={styles.actionsContainer}>
                    <Button appearance="primary" onClick={onApply}>
                        {t("components.toolsselector.apply")}
                    </Button>
                    <Button appearance="secondary" onClick={onCancel} style={{ marginLeft: 8 }}>
                        {t("components.toolsselector.cancel")}
                    </Button>
                </div>
            )}
        </>
    );
};

interface ToolsSelectorProps {
    open: boolean;
    onClose: (selectedTools?: ToolInfo[]) => void;
    tools?: ToolListResponse;
    selectedTools?: ToolInfo[];
}

export const ToolsSelector: React.FC<ToolsSelectorProps> = ({ open, onClose, tools, selectedTools }) => {
    const { t } = useTranslation();
    const [currentSelection, setCurrentSelection] = React.useState<ToolInfo[]>(selectedTools || []);

    React.useEffect(() => {
        if (open && selectedTools) {
            setCurrentSelection(selectedTools);
        }
    }, [open, selectedTools]);

    if (!open) {
        return null;
    }

    const handleClose = () => {
        onClose(currentSelection);
    };

    const handleCancel = () => {
        onClose();
    };

    return (
        <Dialog open={open} modalType="non-modal">
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>{t("components.toolsselector.title")}</DialogTitle>
                    <DialogContent className={styles.dialogContent}>
                        <ToolsSelectorContent
                            tools={tools}
                            selectedTools={currentSelection}
                            onSelectionChange={setCurrentSelection}
                            showActions={true}
                            onApply={handleClose}
                            onCancel={handleCancel}
                        />
                    </DialogContent>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
