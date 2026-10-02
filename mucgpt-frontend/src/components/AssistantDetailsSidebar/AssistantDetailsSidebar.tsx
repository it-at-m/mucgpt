import {
    InlineDrawer,
    DrawerHeader,
    DrawerHeaderTitle,
    DrawerBody,
    DrawerFooter,
    Text,
    Body1Strong,
    Caption1Strong,
    Link,
    Menu,
    MenuTrigger,
    MenuPopover,
    MenuList,
    MenuDivider,
    Tooltip,
    makeStyles,
    mergeClasses,
    tokens
} from "@fluentui/react-components";
import {
    Dismiss24Regular,
    Chat20Regular,
    Copy20Regular,
    Checkmark20Regular,
    Edit20Regular,
    Delete20Regular,
    ArrowExportUp20Regular,
    Share20Regular,
    MoreHorizontal20Regular
} from "@fluentui/react-icons";
import { useState, useCallback, useRef, useEffect, useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import styles from "./AssistantDetailsSidebar.module.css";
import { Assistant, AssistantResponse, CommunityAssistant, CommunityAssistantSnapshot, ToolBase } from "../../api/models";
import { MarkdownRenderer } from "../MarkdownRenderer/MarkdownRenderer";
import { Badge } from "../../ui/Badge";
import { AssistantStateCallout, type AssistantCalloutState } from "../AssistantStateCallout/AssistantStateCallout";
import { Button } from "../../ui/Button";
import { MenuItem } from "../../ui/MenuItem";
import { EdelweissSpinner } from "../EdelweissSpinner";
import { CREATIVITY_MEDIUM } from "../../constants";
import { getCreativityOption } from "../../utils/creativityOptions";
import { getPrimaryOwnerDetails, OwnerMetadataLink } from "../OwnerMetadataLink/OwnerMetadataLink";
import { useGlobalToastContext } from "../GlobalToastHandler/GlobalToastContext";

export interface AssistantCardData {
    id: string;
    title: string;
    description: string;
    subscriptions: number;
    updated?: string | null;
    lastUsed?: number;
    tags: string[];
    rawData: AssistantResponse | CommunityAssistantSnapshot | CommunityAssistant | Assistant;
    isDeletedSnapshot?: boolean;
    isLocalAssistant?: boolean;
    isOwnedAssistant?: boolean;
    isSubscribedAssistant?: boolean;
}

const formatConfigurationDate = (value: string | undefined, locale: string): string | undefined => {
    if (!value) return undefined;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;

    const resolvedLocale = locale === "BA" ? "de-DE" : locale;

    return new Intl.DateTimeFormat(resolvedLocale, {
        day: "numeric",
        month: "long",
        year: "numeric"
    }).format(date);
};

const getModelDisplayName = (model: string | undefined): string | undefined => {
    if (!model) return undefined;
    return model.split("/").pop() || model;
};

const useStyles = makeStyles({
    drawer: {
        position: "relative",
        flexShrink: 0,
        zIndex: 2,
        boxSizing: "border-box",
        width: "var(--assistantDetailsDrawerWidth)",
        height: "100%",
        backgroundColor: tokens.colorNeutralBackground1,
        "@media (max-width: 1200px)": {
            width: "var(--assistantDetailsDrawerCompactWidth)"
        },
        "@media (max-width: 600px)": {
            width: "100%"
        }
    },
    drawerBody: {
        paddingTop: tokens.spacingVerticalL,
        paddingBottom: tokens.spacingVerticalXXL
    },
    drawerFooter: {
        paddingTop: tokens.spacingVerticalL,
        paddingBottom: tokens.spacingVerticalL
    },
    startChatButton: {
        flexGrow: 1,
        minWidth: 0,
        maxWidth: "none"
    }
});

interface DetailsGroupProps {
    title: string;
    children: ReactNode;
}

const DetailsGroup = ({ title, children }: DetailsGroupProps) => {
    const titleId = useId();

    return (
        <section className={styles.group} aria-labelledby={titleId}>
            <Body1Strong as="h3" id={titleId} className={styles.groupTitle}>
                {title}
            </Body1Strong>
            <div className={styles.groupContent}>{children}</div>
        </section>
    );
};

interface DetailsFieldProps {
    label: string;
    action?: ReactNode;
    children: ReactNode;
}

interface DetailsRowProps {
    label: string;
    children: ReactNode;
}

const DetailsRow = ({ label, children }: DetailsRowProps) => (
    <div className={styles.detailsRow}>
        <dt>
            <Caption1Strong>{label}</Caption1Strong>
        </dt>
        <dd>{children}</dd>
    </div>
);

const DetailsField = ({ label, action, children }: DetailsFieldProps) => (
    <div className={styles.field}>
        <div className={styles.fieldHeader}>
            <Caption1Strong as="h4" className={styles.fieldLabel}>
                {label}
            </Caption1Strong>
            {action}
        </div>
        {children}
    </div>
);

interface ExpandableContentProps {
    className?: string;
    collapsedClassName: string;
    children: ReactNode;
}

const ExpandableContent = ({ className, collapsedClassName, children }: ExpandableContentProps) => {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState<boolean>(false);
    const [canExpand, setCanExpand] = useState<boolean>(false);
    const contentRef = useRef<HTMLDivElement>(null);
    const contentId = useId();

    useEffect(() => {
        const element = contentRef.current;
        if (!element || isExpanded) return;

        const updateCanExpand = () => setCanExpand(element.scrollHeight > element.clientHeight);
        updateCanExpand();

        const resizeObserver = new ResizeObserver(updateCanExpand);
        resizeObserver.observe(element);
        return () => resizeObserver.disconnect();
    }, [isExpanded]);

    return (
        <div className={mergeClasses(styles.expandable, className)}>
            <div ref={contentRef} id={contentId} className={mergeClasses(styles.expandableContent, !isExpanded && collapsedClassName)}>
                {children}
            </div>
            {canExpand && (
                <Link as="button" aria-expanded={isExpanded} aria-controls={contentId} onClick={() => setIsExpanded(expanded => !expanded)}>
                    {isExpanded ? t("components.community_assistants.show_less") : t("components.community_assistants.show_more")}
                </Link>
            )}
        </div>
    );
};

const COLLAPSED_STARTER_PROMPT_COUNT = 3;

interface StarterPromptListProps {
    prompts: string[];
}

const StarterPromptList = ({ prompts }: StarterPromptListProps) => {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState<boolean>(false);
    const listId = useId();
    const hiddenCount = prompts.length - COLLAPSED_STARTER_PROMPT_COUNT;
    const visiblePrompts = isExpanded || hiddenCount <= 0 ? prompts : prompts.slice(0, COLLAPSED_STARTER_PROMPT_COUNT);

    return (
        <div className={styles.expandable}>
            <ul id={listId} className={styles.textList}>
                {visiblePrompts.map((prompt, index) => (
                    <li key={`${prompt}-${index}`} className={styles.textListItem}>
                        <q>{prompt}</q>
                    </li>
                ))}
            </ul>
            {hiddenCount > 0 && (
                <Link as="button" aria-expanded={isExpanded} aria-controls={listId} onClick={() => setIsExpanded(expanded => !expanded)}>
                    {isExpanded ? t("components.community_assistants.show_less") : t("components.community_assistants.show_more_count", { count: hiddenCount })}
                </Link>
            )}
        </div>
    );
};

interface AssistantDetailsSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    assistant: AssistantCardData | null;
    isLoading?: boolean;
    ownedAssistantIds: Set<string>;
    onStartChat?: () => void;
    onOpenChatHistory?: () => void;
    onEdit?: () => void;
    onDuplicate?: () => void;
    onExport?: () => void;
    onDelete?: () => void;
    onUnsubscribe?: () => void;
    onMigrateLocal?: () => void;
    hideStartChat?: boolean;
}

export const AssistantDetailsSidebar = ({
    isOpen,
    onClose,
    assistant,
    isLoading = false,
    ownedAssistantIds,
    onStartChat,
    onOpenChatHistory,
    onEdit,
    onDuplicate,
    onExport,
    onDelete,
    onUnsubscribe,
    onMigrateLocal,
    hideStartChat
}: AssistantDetailsSidebarProps) => {
    const { t, i18n } = useTranslation();
    const { showSuccess, showError } = useGlobalToastContext();
    const [systemPromptCopied, setSystemPromptCopied] = useState<boolean>(false);
    const responseData = assistant?.rawData && "latest_version" in assistant.rawData ? assistant.rawData : undefined;
    const latestVersion = responseData?.latest_version;
    const snapshot =
        assistant?.rawData && !("latest_version" in assistant.rawData) && "system_message" in assistant.rawData
            ? (assistant.rawData as CommunityAssistantSnapshot | Assistant)
            : undefined;

    const assistantCreativity = latestVersion?.creativity || snapshot?.creativity || CREATIVITY_MEDIUM;
    const creativityConfig = getCreativityOption(t, assistantCreativity);

    // Every persisted tool entry represents a tool selected for this assistant.
    // `config` only holds tool-specific options and does not contain an `enabled` flag.
    const enabledTools = latestVersion?.tools || snapshot?.tools || [];
    const systemPrompt = latestVersion?.system_prompt || snapshot?.system_message;
    const defaultModel = latestVersion?.default_model || snapshot?.default_model;
    const starterPrompts = latestVersion?.examples || snapshot?.examples || [];
    const followUpActions = latestVersion?.quick_prompts || snapshot?.quick_prompts || [];
    const rawData = assistant?.rawData;
    const isVisible = (rawData && "is_visible" in rawData ? rawData.is_visible : undefined) ?? latestVersion?.is_visible ?? snapshot?.is_visible ?? true;
    const version = latestVersion?.version ?? snapshot?.version;
    const assistantState = latestVersion?.state ?? snapshot?.state;
    const isPendingLegalReview = assistantState === "pending_legal_review";
    const isInactive = assistantState === "inactive";
    const isUnavailable = isPendingLegalReview || isInactive;
    const configurationDate = formatConfigurationDate(latestVersion?.created_at, i18n.resolvedLanguage || i18n.language);
    const systemPromptCopyLabel = systemPromptCopied
        ? t("components.community_assistants.system_prompt_copied", "Copied")
        : t("components.community_assistants.system_prompt_copy", "Copy system prompt");

    const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const onCopySystemPrompt = useCallback(async () => {
        if (!systemPrompt) return;
        try {
            await navigator.clipboard.writeText(systemPrompt);
            setSystemPromptCopied(true);
            if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
            copyTimeoutRef.current = setTimeout(() => {
                setSystemPromptCopied(false);
            }, 1000);
        } catch (err) {
            console.error("Failed to copy system prompt:", err);
        }
    }, [systemPrompt]);

    const onCopyShareLink = useCallback(async () => {
        if (!assistant) return;
        const shareLink = `${window.location.origin}${window.location.pathname}#/communityassistant/${assistant.id}`;
        try {
            await navigator.clipboard.writeText(shareLink);
            showSuccess(t("components.community_assistants.share_link_copied"));
        } catch (err) {
            console.error("Failed to copy share link:", err);
            showError(t("components.community_assistants.share_link_copy_failed"));
        }
    }, [assistant, showError, showSuccess, t]);

    useEffect(() => {
        setSystemPromptCopied(false);
    }, [assistant?.id]);

    useEffect(() => {
        return () => {
            if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        };
    }, []);

    const primaryOwner = getPrimaryOwnerDetails(rawData);
    const isOwned = assistant ? ownedAssistantIds.has(assistant.id) : false;
    const isDeletedSnapshot = Boolean(assistant?.isDeletedSnapshot);
    const isLocalAssistant = Boolean(assistant?.isLocalAssistant);
    const isLegacyAssistant = assistant ? /^\d+$/.test(assistant.id) : false;
    const canUnsubscribe = Boolean(assistant?.isSubscribedAssistant && !isOwned && !isDeletedSnapshot && !isLocalAssistant && !isLegacyAssistant);
    const creatorFallbackLabel = t("components.community_assistants.filter_all", "Community");
    const isPrivate = isLocalAssistant || !isVisible;
    const canEdit = isOwned && (isLocalAssistant || assistantState === "active" || assistantState === "pending_legal_review");
    const canDelete = isOwned && Boolean(onDelete);
    const hasNeutralMenuActions = Boolean(onDuplicate || onExport);
    const hasDangerMenuActions = canDelete || Boolean(canUnsubscribe && onUnsubscribe);
    const hasMoreOptions = hasNeutralMenuActions || hasDangerMenuActions;

    const classes = useStyles();
    const calloutState: AssistantCalloutState | undefined = isDeletedSnapshot
        ? "deleted"
        : isLegacyAssistant
          ? "legacy"
          : isLocalAssistant
            ? "local"
            : isPendingLegalReview
              ? "pending_legal_review"
              : isInactive
                ? "inactive"
                : undefined;

    return (
        <InlineDrawer id="assistant-details-drawer" open={isOpen} position="end" className={classes.drawer} aria-labelledby="sidebar-title">
            <DrawerHeader>
                <DrawerHeaderTitle
                    heading={{ as: "h2", id: "sidebar-title", className: styles.sidebarTitle }}
                    action={<Button appearance="subtle" aria-label={t("common.close")} icon={<Dismiss24Regular />} onClick={onClose} />}
                >
                    {assistant?.title || (isLoading ? t("common.loading") : "")}
                </DrawerHeaderTitle>
            </DrawerHeader>

            <DrawerBody className={mergeClasses(styles.drawerBody, classes.drawerBody)}>
                {isLoading ? (
                    <div className={styles.loadingContainer}>
                        <EdelweissSpinner size="extra-large" />
                        <Text>{t("common.loading")}</Text>
                    </div>
                ) : (
                    <>
                        {assistant && calloutState && !hideStartChat && (
                            <AssistantStateCallout
                                state={calloutState}
                                context="details"
                                onDuplicate={onDuplicate}
                                onMigrateLocal={onMigrateLocal}
                                onOpenChatHistory={onOpenChatHistory}
                                onEdit={canEdit ? onEdit : undefined}
                                onDelete={onDelete}
                            />
                        )}

                        {assistant?.description && (
                            <ExpandableContent key={assistant.id} collapsedClassName={styles.descriptionCollapsed}>
                                <MarkdownRenderer className={styles.markdownContent}>{assistant.description}</MarkdownRenderer>
                            </ExpandableContent>
                        )}

                        {(starterPrompts.length > 0 || followUpActions.length > 0) && (
                            <DetailsGroup title={t("components.community_assistants.section_in_chat")}>
                                {starterPrompts.length > 0 && (
                                    <DetailsField label={t("components.assistant_editor.starter_prompts")}>
                                        <StarterPromptList key={assistant?.id} prompts={starterPrompts.map(prompt => prompt.text)} />
                                    </DetailsField>
                                )}

                                {followUpActions.length > 0 && (
                                    <DetailsField label={t("components.assistant_editor.follow_up_actions")}>
                                        <ul className={styles.chipList}>
                                            {followUpActions.map((action, index) => (
                                                <li key={action.id ?? `${action.label}-${index}`} className={styles.chipItem}>
                                                    <Badge tone="neutral" size="large" shape="circular">
                                                        {action.label}
                                                    </Badge>
                                                </li>
                                            ))}
                                        </ul>
                                    </DetailsField>
                                )}
                            </DetailsGroup>
                        )}

                        <DetailsGroup title={t("components.community_assistants.section_configuration")}>
                            {systemPrompt && (
                                <DetailsField
                                    label={t("components.assistant_editor.system_prompt")}
                                    action={
                                        <Tooltip content={systemPromptCopyLabel} relationship="label">
                                            <Button
                                                appearance="subtle"
                                                size="small"
                                                icon={systemPromptCopied ? <Checkmark20Regular /> : <Copy20Regular />}
                                                onClick={onCopySystemPrompt}
                                            />
                                        </Tooltip>
                                    }
                                >
                                    <ExpandableContent key={assistant?.id} className={styles.systemPrompt} collapsedClassName={styles.systemPromptCollapsed}>
                                        <MarkdownRenderer className={styles.markdownContent}>{systemPrompt}</MarkdownRenderer>
                                    </ExpandableContent>
                                </DetailsField>
                            )}

                            <dl className={styles.detailsList}>
                                <DetailsRow label={t("components.assistant_editor.creativity")}>{creativityConfig.label}</DetailsRow>
                                <DetailsRow label={t("components.assistant_editor.default_model")}>
                                    {getModelDisplayName(defaultModel) || t("components.assistant_editor.no_default_model")}
                                </DetailsRow>
                            </dl>

                            {enabledTools.length > 0 && (
                                <DetailsField label={t("components.assistant_editor.section_tools")}>
                                    <ul className={styles.chipList}>
                                        {enabledTools.map((tool: ToolBase) => (
                                            <li key={tool.id} className={styles.chipItem}>
                                                <Badge tone="neutral" size="large" shape="circular">
                                                    {tool.id}
                                                </Badge>
                                            </li>
                                        ))}
                                    </ul>
                                </DetailsField>
                            )}
                        </DetailsGroup>

                        {assistant && (
                            <DetailsGroup title={t("components.community_assistants.section_about")}>
                                <dl className={styles.detailsList}>
                                    <DetailsRow label={t("components.community_assistants.created_by")}>
                                        {isOwned || isLocalAssistant ? (
                                            t("components.community_assistants.metadata_you", "Du")
                                        ) : (
                                            <OwnerMetadataLink owner={primaryOwner} fallbackLabel={creatorFallbackLabel} />
                                        )}
                                    </DetailsRow>
                                    <DetailsRow label={t("components.community_assistants.visibility")}>
                                        {isPrivate
                                            ? t("components.community_assistants.private_label", "Privat")
                                            : t("components.community_assistants.public_access")}
                                    </DetailsRow>
                                    {!isPrivate && <DetailsRow label={t("components.community_assistants.subscribers")}>{assistant.subscriptions}</DetailsRow>}
                                    {version !== undefined && version !== "" && (
                                        <DetailsRow label={t("components.community_assistants.version")}>{version}</DetailsRow>
                                    )}
                                    {configurationDate && (
                                        <DetailsRow label={t("components.community_assistants.last_updated")}>{configurationDate}</DetailsRow>
                                    )}
                                </dl>
                            </DetailsGroup>
                        )}
                    </>
                )}
            </DrawerBody>
            {assistant && !isLoading && !isUnavailable && !hideStartChat && !isDeletedSnapshot && !isLocalAssistant && !isLegacyAssistant && (
                <DrawerFooter className={mergeClasses(styles.actions, classes.drawerFooter)}>
                    <Button appearance="primary" icon={<Chat20Regular />} onClick={onStartChat} className={classes.startChatButton}>
                        {t("app_sidebar.new_chat")}
                    </Button>
                    {canEdit && onEdit && (
                        <Tooltip content={t("common.edit")} relationship="label">
                            <Button appearance="subtle" icon={<Edit20Regular />} onClick={onEdit} />
                        </Tooltip>
                    )}
                    <Tooltip content={t("components.community_assistants.share_link_copy")} relationship="label">
                        <Button appearance="subtle" icon={<Share20Regular />} onClick={onCopyShareLink} />
                    </Tooltip>
                    {hasMoreOptions && (
                        <Menu positioning="above-end">
                            <MenuTrigger disableButtonEnhancement>
                                <Tooltip content={t("components.community_assistants.more_options", "More options")} relationship="label">
                                    <Button appearance="subtle" icon={<MoreHorizontal20Regular />} />
                                </Tooltip>
                            </MenuTrigger>
                            <MenuPopover>
                                <MenuList>
                                    {onDuplicate && (
                                        <MenuItem icon={<Copy20Regular />} onClick={onDuplicate}>
                                            {t("components.community_assistants.duplicate")}
                                        </MenuItem>
                                    )}
                                    {onExport && (
                                        <MenuItem icon={<ArrowExportUp20Regular />} onClick={onExport}>
                                            {t("components.assistantsettingsdrawer.export")}
                                        </MenuItem>
                                    )}
                                    {hasNeutralMenuActions && hasDangerMenuActions && <MenuDivider />}
                                    {canDelete && (
                                        <MenuItem tone="danger" icon={<Delete20Regular />} onClick={onDelete}>
                                            {t("common.delete")}
                                        </MenuItem>
                                    )}
                                    {canUnsubscribe && onUnsubscribe && (
                                        <MenuItem tone="danger" icon={<Delete20Regular />} onClick={onUnsubscribe}>
                                            {t("components.community_assistants.unsubscribe")}
                                        </MenuItem>
                                    )}
                                </MenuList>
                            </MenuPopover>
                        </Menu>
                    )}
                </DrawerFooter>
            )}
        </InlineDrawer>
    );
};
