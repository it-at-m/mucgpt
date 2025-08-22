import * as React from "react";
import { ToolListResponse, ToolInfo } from "../../api/models";
import { Dialog, DialogSurface, DialogTitle, DialogBody, DialogContent, Button, Text, Checkbox } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import styles from "./ToolsSelector.module.css";

interface ToolsSelectorProps {
    open: boolean;
    onClose: (selectedTools?: ToolInfo[]) => void;
    tools?: ToolListResponse;
    selectedTools?: ToolInfo[];
}

export const ToolsSelector: React.FC<ToolsSelectorProps> = ({ open, onClose, tools, selectedTools }) => {
    const { t } = useTranslation();
    const [selected, setSelected] = React.useState<Set<string>>(new Set());

    React.useEffect(() => {
        if (open && selectedTools) {
            setSelected(new Set(selectedTools.map(t => t.id)));
        } else if (!open) {
            setSelected(new Set());
        }
    }, [open, selectedTools]);

    const handleToggle = (tool: ToolInfo) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(tool.id)) {
                next.delete(tool.id);
            } else {
                next.add(tool.id);
            }
            return next;
        });
    };

    const handleSelectAll = () => {
        if (tools) {
            setSelected(new Set(tools.tools.map(t => t.id)));
        }
    };

    const handleClose = () => {
        if (tools) {
            const selectedTools = tools.tools.filter(t => selected.has(t.id));
            onClose(selectedTools);
        } else {
            onClose();
        }
    };

    return (
        <Dialog open={open} modalType="alert">
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>{t("components.toolsselector.title")}</DialogTitle>
                    <DialogContent className={styles.dialogContent}>
                        {tools && tools.tools.length > 0 ? (
                            <>
                                <div className={styles.actionsContainer} style={{ justifyContent: "flex-start", marginBottom: 8 }}>
                                    <Button size="small" appearance="secondary" onClick={handleSelectAll}>
                                        {t("components.toolsselector.select_all")}
                                    </Button>
                                </div>
                                <div className={styles.toolCardsContainer}>
                                    {tools.tools.map((tool: ToolInfo, idx: number) => (
                                        <div key={tool.id + idx} className={styles.toolCard}>
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
                        <div className={styles.actionsContainer}>
                            <Button appearance="primary" onClick={handleClose}>
                                {t("components.toolsselector.apply")}
                            </Button>
                            <Button appearance="secondary" onClick={() => onClose()} style={{ marginLeft: 8 }}>
                                {t("components.toolsselector.cancel")}
                            </Button>
                        </div>
                    </DialogContent>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
