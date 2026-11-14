import {
    Menu,
    MenuGroup,
    MenuGroupHeader,
    MenuList,
    MenuPopover,
    MenuTrigger,
    Tooltip,
    makeStyles,
    mergeClasses,
    tokens,
    type MenuProps
} from "@fluentui/react-components";
import { Wrench20Regular } from "@fluentui/react-icons";
import { useMemo, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";

import { ToolListResponse } from "../../api/models";
import { Button } from "../../ui/Button";
import { MenuItemCheckbox } from "../../ui/MenuItem";
import { buildToolEntries, ToolEntry } from "../../utils/toolGroups";

const TOOLS_GROUP = "tools";

const useStyles = makeStyles({
    // Fluent reserves a minimum width for text buttons, which leaves the short count floating in empty space.
    // Regular weight matches the model name next to it; Fluent's semibold default makes the label look heavier.
    trigger: {
        minWidth: "auto",
        fontWeight: tokens.fontWeightRegular,
        // Full text-button padding puts the icon further from the attach button than the icon-only actions are spaced.
        paddingLeft: tokens.spacingHorizontalSNudge,
        paddingRight: tokens.spacingHorizontalSNudge
    },
    // Without active tools the label recedes like the model name next to it; active tools keep the stronger default color.
    inactiveTrigger: {
        color: tokens.colorNeutralForeground3
    },
    // On phones the label would push the model name onto a second line; the icon alone has to do there.
    label: {
        "@media (max-width: 480px)": {
            display: "none"
        }
    },
    // Fluent puts the checkmark in front of the name, which indents every tool even while none is active.
    checkmark: {
        order: 1,
        marginRight: 0,
        marginLeft: tokens.spacingHorizontalM
    }
});

interface ChatToolSelectorProps {
    tools: ToolListResponse;
    selectedTools: string[];
    setSelectedTools: Dispatch<SetStateAction<string[]>>;
    allowToolSelection?: boolean;
    lockedToolIds?: string[];
}

export const ChatToolSelector = ({ tools, selectedTools, setSelectedTools, allowToolSelection = true, lockedToolIds = [] }: ChatToolSelectorProps) => {
    const { t } = useTranslation();
    const classes = useStyles();

    const { lockedEntries, selectableEntries } = useMemo(() => {
        const entries = buildToolEntries(tools.tools);
        const isLocked = (entry: ToolEntry) => entry.toolIds.some(id => lockedToolIds.includes(id));

        return {
            lockedEntries: entries.filter(isLocked),
            // Without tool selection the remaining tools can never become active, so listing them would only add noise.
            selectableEntries: allowToolSelection ? entries.filter(entry => !isLocked(entry)) : []
        };
    }, [allowToolSelection, lockedToolIds, tools.tools]);

    const activeEntries = [...lockedEntries, ...selectableEntries.filter(entry => entry.toolIds.some(id => selectedTools.includes(id)))];

    if (lockedEntries.length === 0 && selectableEntries.length === 0) return null;

    const handleCheckedValueChange: MenuProps["onCheckedValueChange"] = (_, { checkedItems }) => {
        const selectableToolIds = selectableEntries.flatMap(entry => entry.toolIds);
        const checkedToolIds = selectableEntries.filter(entry => checkedItems.includes(entry.id)).flatMap(entry => entry.toolIds);
        setSelectedTools(previous => [...previous.filter(id => !selectableToolIds.includes(id)), ...checkedToolIds]);
    };

    const renderSelectableEntry = (entry: ToolEntry) => (
        <MenuItemCheckbox key={entry.id} name={TOOLS_GROUP} value={entry.id} checkmark={{ className: classes.checkmark }}>
            {entry.name}
        </MenuItemCheckbox>
    );

    const tooltip =
        activeEntries.length > 0
            ? t("components.questioninput.active_tools", { tools: activeEntries.map(entry => entry.name).join(", ") })
            : t("components.questioninput.toolsselectorbutton_tooltip");

    return (
        <Menu
            checkedValues={{ [TOOLS_GROUP]: activeEntries.map(entry => entry.id) }}
            onCheckedValueChange={handleCheckedValueChange}
            positioning={{ position: "above", align: "start", offset: 8 }}
        >
            <MenuTrigger disableButtonEnhancement>
                <Tooltip content={tooltip} relationship="label" positioning="below">
                    <Button
                        appearance="subtle"
                        icon={<Wrench20Regular />}
                        className={mergeClasses(classes.trigger, activeEntries.length === 0 && classes.inactiveTrigger)}
                    >
                        {activeEntries.length > 0 ? activeEntries.length : <span className={classes.label}>{t("components.questioninput.tools")}</span>}
                    </Button>
                </Tooltip>
            </MenuTrigger>
            <MenuPopover>
                <MenuList>
                    {lockedEntries.length > 0 && (
                        <MenuGroup>
                            <MenuGroupHeader>{t("components.questioninput.assistant_tools_section")}</MenuGroupHeader>
                            {lockedEntries.map(entry => (
                                <MenuItemCheckbox key={entry.id} name={TOOLS_GROUP} value={entry.id} checkmark={{ className: classes.checkmark }} disabled>
                                    {entry.name}
                                </MenuItemCheckbox>
                            ))}
                        </MenuGroup>
                    )}
                    {lockedEntries.length > 0 && selectableEntries.length > 0 ? (
                        <MenuGroup>
                            <MenuGroupHeader>{t("components.questioninput.optional_tools_section")}</MenuGroupHeader>
                            {selectableEntries.map(renderSelectableEntry)}
                        </MenuGroup>
                    ) : (
                        selectableEntries.map(renderSelectableEntry)
                    )}
                </MenuList>
            </MenuPopover>
        </Menu>
    );
};
