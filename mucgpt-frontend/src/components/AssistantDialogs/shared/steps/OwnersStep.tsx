import { DialogContent, Field, Input, Button, Text, InfoLabel } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { useCallback, useState } from "react";
import { Delete24Regular, PersonAdd24Regular } from "@fluentui/react-icons";

interface OwnersStepProps {
    isOwner: boolean;
    ownerIds: string[];
    currentUserId?: string;
    onOwnersChange: (ownerIds: string[]) => void;
    onHasChanged: (hasChanged: boolean) => void;
}

export const OwnersStep = ({ isOwner, ownerIds, currentUserId, onOwnersChange, onHasChanged }: OwnersStepProps) => {
    const { t } = useTranslation();
    const [newOwnerInput, setNewOwnerInput] = useState<string>("");
    const [error, setError] = useState<string>("");

    const handleAddOwner = useCallback(() => {
        const trimmedInput = newOwnerInput.trim();

        if (!trimmedInput) {
            setError(t("components.edit_assistant_dialog.owners_step.empty_input_error"));
            return;
        }

        if (ownerIds.includes(trimmedInput)) {
            setError(t("components.edit_assistant_dialog.owners_step.duplicate_owner_error"));
            return;
        }

        const updatedOwners = [...ownerIds, trimmedInput];
        onOwnersChange(updatedOwners);
        onHasChanged(true);
        setNewOwnerInput("");
        setError("");
    }, [newOwnerInput, ownerIds, onOwnersChange, onHasChanged, t]);

    const handleRemoveOwner = useCallback(
        (ownerId: string) => {
            // Prevent removing the last owner
            if (ownerIds.length === 1) {
                setError(t("components.edit_assistant_dialog.owners_step.cannot_remove_last_owner"));
                return;
            }

            const updatedOwners = ownerIds.filter(id => id !== ownerId);
            onOwnersChange(updatedOwners);
            onHasChanged(true);
            setError("");
        },
        [ownerIds, onOwnersChange, onHasChanged, t]
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
                e.preventDefault();
                handleAddOwner();
            }
        },
        [handleAddOwner]
    );

    return (
        <DialogContent>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                    <InfoLabel info={<div>{t("components.edit_assistant_dialog.owners_step.info")}</div>}>
                        {t("components.edit_assistant_dialog.owners_step.title")}
                    </InfoLabel>
                    <Text size={300} style={{ display: "block", marginTop: "4px", color: "var(--colorNeutralForeground3)" }}>
                        {t("components.edit_assistant_dialog.owners_step.description")}
                    </Text>
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                    <Field validationMessage={error} validationState={error ? "error" : undefined} style={{ flex: 1 }}>
                        <Input
                            placeholder={t("components.edit_assistant_dialog.owners_step.placeholder")}
                            value={newOwnerInput}
                            onChange={(_, data) => {
                                setNewOwnerInput(data.value);
                                setError("");
                            }}
                            onKeyDown={handleKeyDown}
                            disabled={!isOwner}
                        />
                    </Field>
                    <Button icon={<PersonAdd24Regular />} onClick={handleAddOwner} disabled={!isOwner || !newOwnerInput.trim()} appearance="primary">
                        {t("components.edit_assistant_dialog.owners_step.add_button")}
                    </Button>
                </div>

                <div>
                    <Text size={400} weight="semibold" style={{ display: "block", marginBottom: "8px" }}>
                        {t("components.edit_assistant_dialog.owners_step.current_owners")} ({ownerIds.length})
                    </Text>
                    {ownerIds.length === 0 ? (
                        <Text size={300} style={{ color: "var(--colorNeutralForeground3)" }}>
                            {t("components.edit_assistant_dialog.owners_step.no_owners")}
                        </Text>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {ownerIds.map(ownerId => (
                                <div
                                    key={ownerId}
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        padding: "8px 12px",
                                        backgroundColor: "var(--colorNeutralBackground1)",
                                        borderRadius: "4px",
                                        border: "1px solid var(--colorNeutralStroke1)"
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <Text size={300}>{ownerId}</Text>
                                        {ownerId === currentUserId && (
                                            <Text size={200} style={{ color: "var(--colorNeutralForeground3)" }}>
                                                ({t("components.edit_assistant_dialog.owners_step.you")})
                                            </Text>
                                        )}
                                    </div>
                                    <Button
                                        icon={<Delete24Regular />}
                                        onClick={() => handleRemoveOwner(ownerId)}
                                        disabled={!isOwner || ownerIds.length === 1}
                                        appearance="subtle"
                                        size="small"
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </DialogContent>
    );
};

export default OwnersStep;
