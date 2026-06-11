import { DialogContent, Field } from "@fluentui/react-components";
import { ToolBase, ToolInfo, ToolListResponse } from "../../../../api";
import { ToolsSelectorContent } from "../../../ToolsSelector/ToolsSelector";

import sharedStyles from "../AssistantDialog.module.css";

interface ToolsSectionProps {
    selectedTools: ToolInfo[];
    availableTools?: ToolListResponse;
    onToolsChange: (tools: ToolBase[]) => void;
    onHasChanged?: (hasChanged: boolean) => void;
}

export const ToolsSection = ({ selectedTools, availableTools, onToolsChange, onHasChanged }: ToolsSectionProps) => {
    const handleSelectionChange = (newSelectedTools: ToolInfo[]) => {
        const newTools: ToolBase[] = newSelectedTools.map(tool => ({
            id: tool.id,
            config: {}
        }));
        onToolsChange(newTools);
        onHasChanged?.(true);
    };

    return (
        <DialogContent>
            <Field size="large" className={sharedStyles.formField}>
                <div className={sharedStyles.dynamicFieldContainer}>
                    <div className={sharedStyles.toolSelectorContainer}>
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
