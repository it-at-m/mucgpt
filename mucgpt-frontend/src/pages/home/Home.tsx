import styles from "./Home.module.css";

import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button, Tab, TabList } from "@fluentui/react-components";
import type { SelectTabData, SelectTabEvent } from "@fluentui/react-components";
import { CompassNorthwest24Regular } from "@fluentui/react-icons";
import { useContext, useEffect, useMemo, useState } from "react";

import { AssistantStorageService } from "../../service/assistantstorage";
import { AssistantResponse, CommunityAssistant } from "../../api/models";
import { ASSISTANT_STORE } from "../../constants";
import { DEFAULTHEADER, HeaderContext } from "../layout/HeaderContextProvider";
import { UserContext } from "../layout/UserContextProvider";
import { QuestionInput } from "../../components/QuestionInput/QuestionInput";
import { getAllCommunityAssistantsApi, getUserSubscriptionsApi, getOwnedCommunityAssistants } from "../../api/assistant-client";
import { DiscoveryCard } from "../../components/DiscoveryCard";
import { useToolsContext } from "../../components/ToolsProvider";
import { TermsOfUseDialog } from "../../components/TermsOfUseDialog";
import { VersionInfo } from "../../components/VersionInfo/VersionInfo";
import { ConfigContext } from "../layout/Layout";
import { STORAGE_KEYS } from "../layout/LayoutHelper";

interface HomeAssistant {
    id: string;
    title: string;
    description: string;
    lastUsed: number;
    linkTo: string;
}

type HomeMode = "recommended" | "recent";

const MAX_CARDS = 5;
const MIN_RECENT_FOR_DEFAULT = 1;

const formatDate = (date: Date) => {
    return date.getDate() + "-" + (date.getMonth() + 1) + "-" + date.getFullYear();
};

const Home = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [recentAssistants, setRecentAssistants] = useState<HomeAssistant[]>([]);
    const [recommendedAssistants, setRecommendedAssistants] = useState<HomeAssistant[]>([]);
    const [loading, setLoading] = useState(true);
    const [question, setQuestion] = useState<string>("");
    const [username, setUserName] = useState<string>("");
    const [selectedTools, setSelectedTools] = useState<string[]>([]);
    const [mode, setMode] = useState<HomeMode>("recommended");
    const [dataReady, setDataReady] = useState(false);
    const { tools } = useToolsContext();

    const { setHeader } = useContext(HeaderContext);
    const { user } = useContext(UserContext);
    const config = useContext(ConfigContext);

    useEffect(() => {
        setHeader(DEFAULTHEADER);
    }, [setHeader]);

    useEffect(() => {
        if (user) {
            setUserName(user.givenname || user.displayName || user.username || "User");
        }
    }, [user]);

    useEffect(() => {
        let query = null;
        const hashPart = window.location.hash;
        if (hashPart && hashPart.includes("?")) {
            const queryString = hashPart.split("?")[1];
            if (queryString) {
                const params = new URLSearchParams(queryString);
                query = params.get("q");
            }
        } else {
            const params = new URLSearchParams(window.location.search);
            query = params.get("q");
        }
        if (query) {
            setQuestion(query);
        }

        (async () => {
            try {
                const assistantStorageService = new AssistantStorageService(ASSISTANT_STORE);

                const [subs, owned, allCommunity] = await Promise.all([
                    getUserSubscriptionsApi(),
                    getOwnedCommunityAssistants(),
                    getAllCommunityAssistantsApi()
                ]);

                const allCommunityMap = new Map<string, AssistantResponse>();
                allCommunity.forEach(a => allCommunityMap.set(a.id, a));

                const subsMap = new Map<string, CommunityAssistant>();
                subs.forEach(s => subsMap.set(s.id, s));

                const ownedMap = new Map<string, AssistantResponse>();
                owned.forEach(o => ownedMap.set(o.id, o));

                // Build recent assistants from chat history
                const allRecords = await assistantStorageService.getChatStorageService().getAll();
                const chatRecords = (allRecords || []).filter(
                    r => r.id && r.id.startsWith(AssistantStorageService.CHAT_ID) && r._last_edited && r.messages.length > 0
                );

                const assistantLastUsed = new Map<string, number>();
                for (const chat of chatRecords) {
                    const id = chat.id!;
                    const withoutPrefix = id.substring(AssistantStorageService.CHAT_ID.length);
                    const lastUnderscore = withoutPrefix.lastIndexOf("_");
                    if (lastUnderscore === -1) continue;
                    const assistantId = withoutPrefix.substring(0, lastUnderscore);

                    const existing = assistantLastUsed.get(assistantId) || 0;
                    if ((chat._last_edited || 0) > existing) {
                        assistantLastUsed.set(assistantId, chat._last_edited || 0);
                    }
                }

                const recent: HomeAssistant[] = [];
                for (const [assistantId, lastUsed] of assistantLastUsed) {
                    const own = ownedMap.get(assistantId);
                    if (own) {
                        recent.push({
                            id: assistantId,
                            title: own.latest_version.name,
                            description: own.latest_version.description || "",
                            lastUsed,
                            linkTo: `/owned/communityassistant/${assistantId}`
                        });
                        continue;
                    }

                    // Subscribed assistants should only be shown if they still exist and are visible.
                    const community = allCommunityMap.get(assistantId);
                    if (!community || !community.is_visible) continue;

                    const sub = subsMap.get(assistantId);
                    if (sub) {
                        recent.push({
                            id: assistantId,
                            title: sub.title,
                            description: sub.description,
                            lastUsed,
                            linkTo: `/communityassistant/${assistantId}`
                        });
                    }
                }

                recent.sort((a, b) => b.lastUsed - a.lastUsed);
                setRecentAssistants(recent.slice(0, MAX_CARDS));

                // Build recommended: top 5 visible community assistants by subscription count
                const recommended = [...allCommunity]
                    .filter(a => a.is_visible)
                    .sort((a, b) => (b.subscriptions_count || 0) - (a.subscriptions_count || 0))
                    .slice(0, MAX_CARDS)
                    .map(a => ({
                        id: a.id,
                        title: a.latest_version.name,
                        description: a.latest_version.description || "",
                        lastUsed: 0,
                        linkTo: `/communityassistant/${a.id}`
                    }));
                setRecommendedAssistants(recommended);

                // Determine initial mode
                const persisted = localStorage.getItem(STORAGE_KEYS.HOME_ASSISTANT_MODE) as HomeMode | null;
                const validRecent = recent.slice(0, MAX_CARDS);
                if (validRecent.length >= MIN_RECENT_FOR_DEFAULT && persisted) {
                    setMode(persisted);
                } else {
                    setMode("recommended");
                }

            } catch (error) {
                console.error("Failed to load home page data", error);
            } finally {
                setDataReady(true);
                setLoading(false);
            }
        })();
    }, []);

    const handleModeChange = (newMode: HomeMode) => {
        setMode(newMode);
        localStorage.setItem(STORAGE_KEYS.HOME_ASSISTANT_MODE, newMode);
    };

    const handleModeTabSelect = (_event: SelectTabEvent, data: SelectTabData) => {
        if (data.value === "recommended" || data.value === "recent") {
            handleModeChange(data.value);
        }
    };

    const onSendQuestion = (nextQuestion: string) => {
        let url = `#/chat?q=${encodeURIComponent(nextQuestion)}`;
        if (selectedTools.length > 0) {
            url += `&tools=${encodeURIComponent(selectedTools.join(","))}`;
        }
        window.location.href = url;
    };

    const onAcceptTermsOfUse = () => {
        localStorage.setItem(STORAGE_KEYS.TERMS_OF_USE_READ, formatDate(new Date()));
        if (config && localStorage.getItem(STORAGE_KEYS.VERSION_UPDATE_SEEN) !== config.frontend_version) {
            localStorage.setItem(STORAGE_KEYS.VERSION_UPDATE_SEEN, config.frontend_version);
            navigate("/version");
        }
    };

    const displayedCards = useMemo(() => {
        return mode === "recent" ? recentAssistants : recommendedAssistants;
    }, [mode, recentAssistants, recommendedAssistants]);

    const hasAnyContent = recommendedAssistants.length > 0 || recentAssistants.length > 0;
    const sectionHeading = t("home.assistants");
    const sectionLabel = mode === "recent" ? t("home.last_used") : t("home.recommended");

    return (
        <div className={styles.pageContainer}>
            <section className={styles.chatstartercontainer} aria-labelledby="chat-header">
                <h1 id="chat-header" className={styles.heading}>
                    {t("menu.chat_header", { user: username })}{" "}
                </h1>
                <div className={styles.chatstarter}>
                    <QuestionInput
                        onSend={onSendQuestion}
                        disabled={false}
                        placeholder={t("chat.prompt")}
                        setQuestion={q => setQuestion(q)}
                        selectedTools={selectedTools}
                        setSelectedTools={setSelectedTools}
                        tools={tools}
                        variant="home"
                        question={question}
                    />
                </div>
            </section>

            <section className={styles.contentSection} aria-labelledby="assistants-heading">
                {!loading && dataReady && hasAnyContent && (
                    <>
                        <div className={styles.sectionHeaderRow}>
                            <div className={styles.sectionHeader} id="assistants-heading">
                                {sectionHeading}
                            </div>
                            <TabList className={styles.modeTabs} selectedValue={mode} onTabSelect={handleModeTabSelect}>
                                <Tab value="recommended">{t("home.recommended")}</Tab>
                                <Tab value="recent">{t("home.last_used")}</Tab>
                            </TabList>
                        </div>
                        <div className={styles.assistantGrid} role="list" aria-label={sectionLabel}>
                            {displayedCards.map(assistant => (
                                <DiscoveryCard
                                    key={assistant.id}
                                    id={assistant.id}
                                    title={assistant.title}
                                    description={assistant.description}
                                    linkTo={assistant.linkTo}
                                    role="listitem"
                                />
                            ))}
                            <DiscoveryCard
                                id="discover-all"
                                title={t("home.discover_all")}
                                description={t("home.discover_all_description")}
                                linkTo="/discovery"
                                badge={t("home.explore_badge")}
                                badgeAppearance="tint"
                                badgeColor="brand"
                                role="listitem"
                            />
                        </div>
                    </>
                )}

                {!loading && dataReady && !hasAnyContent && (
                    <div className={styles.fallbackContainer}>
                        <div className={styles.fallbackText}>
                            {t("home.no_assistants_available")}
                        </div>
                        <Button
                            className={styles.fallbackButton}
                            appearance="primary"
                            icon={<CompassNorthwest24Regular aria-hidden />}
                            onClick={() => navigate("/discovery")}
                        >
                            {t("menu.discover_assistants", "Assistenten entdecken")}
                        </Button>
                    </div>
                )}
            </section>

            <footer className={styles.inlineFooter} role="contentinfo" aria-label={t("common.footer_info", "Fu\u00dfzeileninformationen")}>
                <div className={styles.footerContent}>
                    <div className={styles.footerMetaRow}>
                        <address className={styles.footerCompanyBlock}>
                            {t("common.organization_name", "Landeshauptstadt M\u00fcnchen, RIT/it@M KIES")}
                        </address>
                        {config && (
                            <div className={styles.footerVersionBlock}>
                                <VersionInfo
                                    core_version={config.core_version}
                                    frontend_version={config.frontend_version}
                                    assistant_version={config.assistant_version}
                                    variant="compact"
                                />
                            </div>
                        )}
                        <div className={styles.footerLinksBlock}>
                            <a href={import.meta.env.BASE_URL + "#/version"} className={styles.footerLink}>
                                {t("components.versioninfo.whats_new", "Was gibt's neues?")}
                            </a>
                            <span className={styles.footerLinkSeparator} aria-hidden>·</span>
                            <TermsOfUseDialog defaultOpen={false} onAccept={onAcceptTermsOfUse} triggerClassName={styles.footerTermsTrigger} />
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Home;
