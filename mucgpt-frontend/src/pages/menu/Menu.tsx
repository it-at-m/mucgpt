import styles from "./Menu.module.css";

import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button, Tooltip, TabList, Tab, SelectTabEvent, SelectTabData } from "@fluentui/react-components";
import { CompassNorthwest24Regular } from "@fluentui/react-icons";
import { useContext, useEffect, useState } from "react";

import addButtonStyles from "../../components/AddAssistantButton/AddAssistantButton.module.css";
import { AssistantStorageService } from "../../service/assistantstorage";
import { AssistantResponse, Assistant, CommunityAssistant } from "../../api/models";
import { ASSISTANT_STORE, COMMUNITY_ASSISTANT_STORE } from "../../constants";
import { migrate_old_assistants } from "../../service/migration";
import { SearchCommunityAssistantButton } from "../../components/SearchCommunityAssistantButton/SearchCommunityAssistantButton";
import { CommunityAssistantsDialog } from "../../components/CommunityAssistantDialog/CommunityAssistantDialog";
import { DEFAULTHEADER, HeaderContext } from "../layout/HeaderContextProvider";
import { UserContext } from "../layout/UserContextProvider";
import { QuestionInput } from "../../components/QuestionInput/QuestionInput";
import { getOwnedCommunityAssistants, getUserSubscriptionsApi } from "../../api/assistant-client";
import { useGlobalToastContext } from "../../components/GlobalToastHandler/GlobalToastContext";
import { Chat24Regular, ShareIos24Regular } from "@fluentui/react-icons";
import { AssistantStats } from "../../components/AssistantStats/AssistantStats";
import { CommunityAssistantStorageService } from "../../service/communityassistantstorage";
import { AssistantCard } from "../../components/AssistantCard";
import { useToolsContext } from "../../components/ToolsProvider";

const Menu = () => {
    const { t } = useTranslation();
    const [assistants, setAssistants] = useState<Assistant[]>([]);
    const [communityAssistants, setCommunityAssistants] = useState<CommunityAssistant[]>([]);
    const [deletedCommunityAssistants, setDeletedCommunityAssistants] = useState<CommunityAssistant[]>([]);
    const [ownedCommunityAssistants, setOwnedCommunityAssistants] = useState<AssistantResponse[]>([]);
    const [showSearchAssistant, setShowSearchAssistant] = useState<boolean>(false);
    const [getCommunityAssistants, setGetCommunityAssistants] = useState<boolean>(false);
    const [hoveredAssistantId, setHoveredAssistantId] = useState<string | null>(null);
    const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [selectedTab, setSelectedTab] = useState<string>("local");


    const [question, setQuestion] = useState<string>("");
    const [username, setUserName] = useState<string>("");
    const [selectedTools, setSelectedTools] = useState<string[]>([]);
    const { tools } = useToolsContext();

    const { setHeader } = useContext(HeaderContext);
    const { user } = useContext(UserContext);
    const { showSuccess } = useGlobalToastContext();
    useEffect(() => {
        setHeader(DEFAULTHEADER);
    }, [setHeader]);

    const assistantStorageService: AssistantStorageService = new AssistantStorageService(ASSISTANT_STORE);
    const communityAssistantStorageService: CommunityAssistantStorageService = new CommunityAssistantStorageService(COMMUNITY_ASSISTANT_STORE);

    useEffect(() => {
        // Check for query parameter in hash and regular URLs
        let query = null;

        // Check hash format like #/?q=something
        const hashPart = window.location.hash;
        if (hashPart && hashPart.includes("?")) {
            const queryString = hashPart.split("?")[1];
            if (queryString) {
                const params = new URLSearchParams(queryString);
                query = params.get("q");
            }
        }
        // Check regular format /?q=something
        else {
            const params = new URLSearchParams(window.location.search);
            query = params.get("q");
        }

        if (query) {
            // URLSearchParams already decodes the value, but handle + as space for legacy URLs
            setQuestion(query);
        }
        (async () => {
            await migrate_old_assistants();
            const [assistantsLocal, subs, owned, localCommunity] = await Promise.all([
                assistantStorageService.getAllAssistantConfigs(),
                getUserSubscriptionsApi(),
                getOwnedCommunityAssistants(),
                communityAssistantStorageService.getAllAssistantConfigs()
            ]);
            setAssistants(assistantsLocal);
            setCommunityAssistants(subs);
            setOwnedCommunityAssistants(owned);
            setDeletedCommunityAssistants(
                localCommunity
                    .filter(local => !subs.some(sub => sub.id === local.id)) // lokal, aber nicht in subs
                    .filter(deleted => !owned.some(own => own.id === deleted.id)) // und nicht in owned
            );
        })();
    }, []);

    useEffect(() => {
        if (user) {
            setUserName(user.givenname || user.displayName || user.username || "User");
        }
    }, [user]);


    const onSearchAssistant = () => {
        setShowSearchAssistant(true);
        setGetCommunityAssistants(true);
    };

    const onSendQuestion = (question: string) => {
        let url = `#/chat?q=${encodeURIComponent(question)}`;
        if (selectedTools.length > 0) {
            url += `&tools=${encodeURIComponent(selectedTools.join(","))}`;
        }
        window.location.href = url;
    };

    const onShareAssistant = (assistantId: string) => {
        navigator.clipboard.writeText(`${window.location.origin}/#/communityassistant/${assistantId}`);
        showSuccess("Link kopiert", "Der Assistant-Link wurde in die Zwischenablage kopiert.");
    };

    const handleFocus = (assistantId: string, event: React.FocusEvent) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;

        setHoverPosition({
            x: rect.left + scrollX + rect.width / 2,
            y: rect.bottom + scrollY
        });
        setHoveredAssistantId(assistantId);
    };

    const handleMouseEnter = (assistantId: string, event: React.MouseEvent) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;

        setHoverPosition({
            x: rect.left + scrollX + rect.width / 2,
            y: rect.bottom + scrollY
        });
        setHoveredAssistantId(assistantId);
    };

    const handleMouseLeave = () => {
        setHoveredAssistantId(null);
    };

    const onTabSelect = (event: SelectTabEvent, data: SelectTabData) => {
        setSelectedTab(data.value as string);
        setHoveredAssistantId(null);
        setHoverPosition({ x: 0, y: 0 });
    };

    return (
        <div role="presentation">
            <section className={styles.chatstartercontainer} aria-labelledby="chat-header">

                <h1 id="chat-header" className={styles.heading}>
                    {t("menu.chat_header", { user: username })}{" "}
                </h1>
                <div className={styles.chatstarter}>
                    <QuestionInput
                        onSend={onSendQuestion}
                        disabled={false}
                        placeholder={t("chat.prompt")}
                        setQuestion={question => {
                            setQuestion(question);
                        }}
                        selectedTools={selectedTools}
                        setSelectedTools={setSelectedTools}
                        tools={tools}
                        question={question}
                    ></QuestionInput>
                </div>
                <div className={styles.divider}>
                    <hr />
                    <span>{t("menu.or", "oder")}</span>
                    <hr />
                </div>
                <nav className={styles.chatNavigationContainer} aria-label={t("menu.navigation_aria", "Chat Navigation")}>
                    <Tooltip
                        content={t("menu.go_to_chat_tooltip", "Direkt zur Chat-Seite navigieren ohne Frage eingeben zu müssen")}
                        relationship="description"
                        positioning="below"
                    >
                        <Link
                            to="/chat"
                            className={styles.chatNavigationButton}
                            aria-label={t("menu.go_to_chat_aria", "Direkt zum Chat navigieren")}
                            role="button"
                        >
                            <Chat24Regular aria-hidden />
                            <span>{t("menu.go_to_chat", "Direkt zum Chat")}</span>
                        </Link>
                    </Tooltip>
                </nav>
            </section>
            <section className={styles.container} aria-labelledby="assistants-section">
                <div id="assistants-section" className={styles.rowheader} role="heading" aria-level={3}>
                    {t("menu.own_assistants")}
                    <div className={addButtonStyles.container}>
                        <Tooltip content={t("menu.discover_assistants", "Assistenten entdecken")} relationship="description" positioning="below">
                            <Link to="/discovery" className={addButtonStyles.button} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 16px", textDecoration: "none", fontSize: "14px", fontWeight: 600, color: "var(--onPrimary)" }} aria-label={t("menu.discover_assistants", "Assistenten entdecken")}>
                                <CompassNorthwest24Regular aria-hidden />
                                {t("menu.discover_assistants", "Assistenten entdecken")}
                            </Link>
                        </Tooltip>
                    </div>
                </div>

                <TabList selectedValue={selectedTab} onTabSelect={onTabSelect}>
                    <Tab value="local">{t("menu.local")}</Tab>
                    <Tab value="owned">{t("menu.owned")}</Tab>
                </TabList>

                {selectedTab === "local" && (
                    <div className={styles.row} role="list" aria-label={t("menu.local", "Lokale Assistenten")}>
                        {assistants.map((assistant: Assistant, key) => (
                            <AssistantCard
                                key={key}
                                id={assistant.id || `assistant-${key}`}
                                title={assistant.title}
                                description={assistant.description}
                                linkTo={`/assistant/${assistant.id}`}
                                linkAriaLabel={t("menu.select_assistant_aria", "Assistant auswählen: {{title}}", { title: assistant.title })}
                                linkText={t("menu.select")}
                                role="listitem"
                                showTooltip={true}
                            />
                        ))}
                        {assistants.length === 0 && (
                            <div role="status" aria-live="polite">
                                {t("menu.no_assistants")}
                            </div>
                        )}
                    </div>
                )}

                {selectedTab === "owned" && (
                    <div className={styles.row} role="list" aria-label={t("menu.owned", "Veröffentlicht in der Community")}>
                        {ownedCommunityAssistants.map((assistant: AssistantResponse, key) => (
                            <AssistantCard
                                key={key}
                                id={assistant.id}
                                title={assistant.latest_version.name}
                                description={assistant.latest_version.description || ""}
                                linkTo={`owned/communityassistant/${assistant.id}`}
                                linkAriaLabel={t("menu.select_assistant_aria", "Assistant auswählen: {{title}}", { title: assistant.latest_version.name })}
                                linkText={t("menu.select")}
                                role="listitem"
                                showTooltip={false}
                                onMouseEnter={handleMouseEnter}
                                onMouseLeave={handleMouseLeave}
                                onFocus={handleFocus}
                                onBlur={handleMouseLeave}
                                additionalButtons={
                                    <Button
                                        onClick={() => onShareAssistant(assistant.id)}
                                        aria-label={t("menu.share_assistant_aria", "Assistant teilen: {{title}}", { title: assistant.latest_version.name })}
                                    >
                                        <ShareIos24Regular aria-hidden /> Teilen
                                    </Button>
                                }
                            />
                        ))}
                        {ownedCommunityAssistants.length === 0 && (
                            <div role="status" aria-live="polite">
                                {t("menu.no_assistants")}
                            </div>
                        )}
                    </div>
                )}

                <div className={styles.rowheader} role="heading" aria-level={3}>
                    {t("menu.community_assistants")} <SearchCommunityAssistantButton onClick={onSearchAssistant} />
                </div>
                <CommunityAssistantsDialog
                    showSearchDialogInput={showSearchAssistant}
                    setShowSearchDialogInput={setShowSearchAssistant}
                    takeCommunityAssistants={getCommunityAssistants}
                    setTakeCommunityAssistants={setGetCommunityAssistants}
                    ownedAssistants={ownedCommunityAssistants.map(a => a.id)}
                    subscribedAssistants={communityAssistants.map(a => a.id)}
                />
                <div className={styles.row} role="list" aria-label={t("menu.community_assistants", "Abonnierte Community Assistenten")}>
                    {communityAssistants.map((assistant, key) => (
                        <AssistantCard
                            key={key}
                            id={assistant.id || `community-${key}`}
                            title={assistant.title}
                            description={assistant.description}
                            linkTo={`communityassistant/${assistant.id}`}
                            linkAriaLabel={t("menu.select_assistant_aria", "Assistant auswählen: {{title}}", { title: assistant.title })}
                            linkText={t("menu.select")}
                            role="listitem"
                            showTooltip={true}
                        />
                    ))}
                    {communityAssistants.length === 0 && (
                        <div role="status" aria-live="polite">
                            {t("menu.no_assistants")}
                        </div>
                    )}
                </div>
                {deletedCommunityAssistants.length > 0 && (
                    <div>
                        <div className={styles.subrowheader} role="heading" aria-level={4}>
                            {t("menu.deleted")}
                        </div>
                        <div className={styles.row} role="list" aria-label={t("menu.deleted_assistants_list", "Gelöschte Community Assistants")}>
                            {deletedCommunityAssistants.map((assistant, key) => (
                                <AssistantCard
                                    key={key}
                                    id={assistant.id || `deleted-${key}`}
                                    title={assistant.title}
                                    description={assistant.description}
                                    linkTo={`deleted/communityassistant/${assistant.id}`}
                                    linkAriaLabel={t("menu.select_assistant_aria", "Assistant auswählen: {{title}}", { title: assistant.title })}
                                    linkText={t("menu.select")}
                                    role="listitem"
                                    showTooltip={true}
                                    style={{ opacity: 0.5 }}
                                    titleStyle={{ color: "red" }}
                                />
                            ))}
                        </div>
                    </div>
                )}
                <div className={styles.rowheader} aria-hidden="true">
                    {" "}
                </div>
            </section>
            {hoveredAssistantId && (
                <div
                    style={{
                        position: "absolute",
                        left: hoverPosition.x - 160, // Center horizontally (assuming 320px width)
                        top: hoverPosition.y + 10, // Position below the assistant box
                        zIndex: 1000,
                        padding: "12px",
                        pointerEvents: "none"
                    }}
                >
                    {ownedCommunityAssistants.find(assistant => assistant.id === hoveredAssistantId) && (
                        <AssistantStats assistant={ownedCommunityAssistants.find(assistant => assistant.id === hoveredAssistantId)!} />
                    )}
                </div>
            )}
        </div>
    );
};

export default Menu;
