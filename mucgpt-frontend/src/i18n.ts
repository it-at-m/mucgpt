import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { tutorialsTranslations } from "./i18n.tutorials";

i18n
    // pass the i18n instance to react-i18next.
    .use(initReactI18next)
    // init i18next
    // for all options read: https://www.i18next.com/overview/configuration-options
    .init({
        debug: true,
        fallbackLng: "DE",
        interpolation: {
            escapeValue: false // not needed for react as it escapes by default
        },
        resources: {
            DE: {
                translation: {
                    header: {
                        chat: "Chat",
                        nutzungsbedingungen: "Nutzungsbedingungen",
                        create_assistant: "Assistent erstellen"
                    },
                    menu: {
                        go_to_tutorials_tooltip: "Tutorials und Anleitungen zu MUCGPT anzeigen",
                        go_to_tutorials: "Lerne MUCGPT kennen",
                        go_to_tutorials_aria: "Tutorials und Anleitungen zu MUCGPT",
                        chat_header: "Hallo {{user}}, was hast du heute vor?",
                        own_assistants: "Lokale Assistenten",
                        community_assistants: "Community Assistenten",
                        no_assistants: "Keine Assistenten gefunden",
                        soon: "In Entwicklung...",
                        owned: "Eigene:",
                        subscribed: "Abonnierte:",
                        select: "Auswählen",
                        navigation_aria: "Chat Navigation",
                        go_to_chat: "Direkt zum Chat",
                        go_to_chat_tooltip: "Direkt zur Chat-Seite navigieren ohne Frage eingeben zu müssen",
                        go_to_chat_aria: "Direkt zum Chat navigieren",
                        assistants_section: "Assistenten-Verwaltung",
                        own_assistants_list: "Eigene Assistenten",
                        owned_assistants_list: "Eigene Community Assistenten",
                        subscribed_assistants_list: "Abonnierte Community Assistenten",
                        deleted: "Gelöschte:",
                        deleted_assistants_list: "Gelöschte Community Assistenten",
                        select_assistant_aria: "Assistent auswählen: {{title}}",
                        share_assistant_aria: "Assistent teilen: {{title}}"
                    },
                    chat: {
                        header: "Stelle eine Frage oder probiere ein Beispiel",
                        prompt: "Stelle eine Frage",
                        answer_loading: "Erstelle Antwort",
                        quickprompts: {
                            shorter_tooltip: "Schreibe eine kürzere Antwort",
                            longer_tooltip: "Schreibe eine längere Antwort",
                            formal_tooltip: "Schreibe eine förmlichere Antwort",
                            informal_tooltip: "Schreibe eine informellere Antwort",
                            shorter: "➖ Kürzer",
                            longer: "➕ Länger",
                            formal: "👔 Förmlicher",
                            informal: "👕 Informeller",
                            shorter_prompt:
                                "Formuliere deine letzte Nachricht zu einem neuen kürzeren Text, der den ursprünglichen Inhalt in einer kürzeren und prägnanteren Form wiedergibt. Dieser Text sollte die wichtigsten Informationen enthalten und das Verständnis des Lesers verbessern.",
                            longer_prompt:
                                "Formuliere deine letzte Nachricht zu einem neuen längeren Text, der den ursprünglichen Inhalt erweitert und mit mehr Details und Hintergrundinformationen versehen ist. Dieser Text sollte das Verständnis des Lesers vertiefen und eine umfassendere Perspektive auf das Thema bieten.",
                            formal_prompt:
                                "Formuliere deine letzte Nachricht zu einem neuen formellen Text, der den ursprünglichen Inhalt in einer akademischen Schreibweise präsentiert. Dieser Text sollte eine klare Struktur aufweisen, präzise und sachliche Ausdrucksweise verwenden und dem Leser ein professionelles Leseerlebnis bieten.",
                            informal_prompt:
                                "Formuliere deine letzte Nachricht zu einem neuen informelleren Text, der den ursprünglichen Inhalt in einer lockeren Schreibweise wiedergibt. Dieser Text soll dem Leser ein ungezwungenes Leseerlebnis bieten, indem er leicht verständliche Sprache und gegebenenfalls auch humorvolle Elemente verwendet."
                        }
                    },
                    version: {
                        header: "Was gibt's Neues?",
                        added: "Neu",
                        fixed: "Fehler behoben",
                        changed: "Änderungen"
                    },
                    common: {
                        open_menu: "Menü öffnen",
                        close_menu: "Menü schließen",
                        skip_to_content: "Zum Hauptinhalt springen",
                        main_navigation: "Hauptnavigation",
                        home_link: "Zur Startseite",
                        environment_label: "Umgebung: {{env}}",
                        page_navigation: "Seitennavigation",
                        user_settings: "Benutzereinstellungen",
                        main_content: "Hauptinhalt",
                        footer_info: "Fußzeileninformationen",
                        clear_chat: "Neuer Chat",
                        settings: "Einstellungen",
                        close: "Schließen",
                        messages: "Nachrichten",
                        examples: "Beispiele",
                        sidebar_show: "Sidebar anzeigen",
                        sidebar_hide: "Sidebar ausblenden",
                        cancel: "Abbrechen",
                        ok: "OK",
                        errors: {
                            config_not_loaded: "Konfiguration konnte nicht geladen werden.",
                            failed_to_load_config: "Fehler beim Laden der Konfiguration.",
                            configuration_error: "Konfigurationsfehler"
                        }
                    },
                    create_assistant: {
                        title: "Titel",
                        description: "Beschreibung",
                        prompt: "System-Prompt",
                        create: "Erstellen"
                    },
                    components: {
                        assistant_chat: {
                            load_assistant_failed: "Assistent konnte nicht geladen werden",
                            assistant_not_found: "Assistent wurde nicht gefunden",
                            load_assistant_failed_message: "Beim Laden des Assistenten ist ein Fehler aufgetreten",
                            load_chat_failed: "Chat konnte nicht geladen werden",
                            load_chat_failed_message: "Beim Laden des Chat-Verlaufs ist ein Fehler aufgetreten",

                            delete_assistant_success: "Assistent wurde gelöscht",
                            delete_assistant_success_message: "Der Assistent '{{title}}' wurde erfolgreich gelöscht",
                            delete_assistant_failed: "Assistent konnte nicht gelöscht werden",
                            delete_assistant_failed_message: "Beim Löschen des Assistenten ist ein Fehler aufgetreten",

                            update_assistant_success: "Assistent wurde aktualisiert",
                            update_assistant_success_message: "Der Assistent '{{title}}' wurde erfolgreich aktualisiert",
                            update_assistant_failed: "Assistent konnte nicht aktualisiert werden",
                            update_assistant_failed_message: "Beim Aktualisieren des Assistenten ist ein Fehler aufgetreten"
                        },
                        assistant_stats: {
                            title: "Assistenten-Statistiken",
                            visibility_label: "Sichtbarkeit:",
                            visibility_visible: "Sichtbar",
                            visibility_invisible: "Unsichtbar",
                            publication_label: "Veröffentlichung:",
                            publication_public: "Öffentlich",
                            publication_departments: "Sichtbar für {{count}} Abteilungen",
                            subscriptions_label: "Abonnements:",
                            version_label: "Version:"
                        },
                        not_subscribed_dialog: {
                            subscribe_title: "Assistent abonnieren",
                            subscribe_message: "Sie haben den Assistenten '{{assistantTitle}}' noch nicht abonniert. Möchten Sie ihn jetzt abonnieren?",
                            subscribe_info: "Durch das Abonnieren erhalten Sie Zugriff auf alle Funktionen dieses Assistenten.",
                            subscribe_button: "Abonnieren",
                            subscribe_success: "Erfolgreich abonniert",
                            subscribe_success_message: "Sie haben den Assistenten '{{assistantTitle}}' erfolgreich abonniert",
                            no_access_title: "Kein Zugriff",
                            no_access_message: "Sie haben keinen Zugriff auf den Assistenten '{{assistantTitle}}'.",
                            no_access_info: "Bitte wenden Sie sich an den Ersteller des Assistenten, um Zugriff zu erhalten."
                        },
                        department_dropdown: {
                            placeholder: "Suche Abteilung...",
                            no_matches: "Keine Treffer",
                            own_department_label: "(Ihre Abteilung)"
                        },
                        terms_of_use: {
                            tooltip: "Nutzungsbedingungen anzeigen",
                            label: "Nutzungsbedingungen",
                            accept: "Zustimmen"
                        },
                        versioninfo: {
                            tooltip: "Kern Version: {{core_version}}, Frontend Version: {{frontend_version}}, Assistenten Version: {{assistant_version}}",
                            label: "Version:",
                            whats_new: "Was gibt's neues?"
                        },
                        feedback: {
                            tooltip: "Feedback geben",
                            aria_label: "Feedback per E-Mail senden",
                            label: "Feedback"
                        },
                        helpbutton: {
                            help: "Hilfe",
                            label: "Hilfe & FAQ",
                            tooltip: "Hilfe und häufig gestelle Fragen anzeigen",
                            aria_label: "Hilfe und FAQ öffnen"
                        },
                        language_selector: {
                            change_language: "Sprache ändern"
                        },
                        theme_selector: {
                            theme_light: "Helles Thema",
                            theme_dark: "Dunkles Thema",
                            change_theme: "Thema wechseln",
                            light_short: "Hell",
                            dark_short: "Dunkel"
                        },
                        sumlength: {
                            sentences: "Zwei Sätze",
                            bullets: "Fünf Stichpunkte",
                            quarter: "1/4 der Länge"
                        },
                        answererror: {
                            retry: "Wiederholen"
                        },
                        answer: {
                            regenerate: "Antwort regenerieren",
                            copy: "Antwort kopieren",
                            unformat: "Unformatierte Antwort"
                        },
                        mermaid: {
                            download: "Diagramm herunterladen",
                            render: "Zeichne Diagramm...",
                            error: "Das Diagramm kann leider nicht dargestellt werden, da es Fehler enthält.",
                            zoomIn: "Vergrößern",
                            zoomOut: "Verkleinern",
                            resetZoom: "Zoom zurücksetzen",
                            panHint: "Ziehen zum Verschieben • Strg/Cmd+Mausrad zum Zoomen • Doppelklick zum Zurücksetzen",
                            zoomHint: "Strg+Mausrad zum Zoomen • Doppelklick zum Anpassen"
                        },
                        mindmap: {
                            download: "Herunterladen",
                            reset: "Ansicht zurücksetzen",
                            source: "Datenansicht",
                            mindmap: "Mindmap-Ansicht",
                            exitFullscreen: "Beenden der Vollbildansicht",
                            fullscreen: "Vollbildansicht",
                            loading: "Mindmap wird geladen...",
                            errors: {
                                insufficientContent: "Zu wenig Inhalt für eine Mindmap",
                                transformationError: "Mindmap konnte nicht erstellt werden"
                            }
                        },
                        sumanswer: {
                            header: "Einzigartige Aspekte/Entitäten:",
                            alternative: "Zusammenfassung",
                            copy: "Zusammenfassung kopieren"
                        },
                        questioninput: {
                            tokensused: "Token verbraucht",
                            limit: ". Ältere Eingaben werden bei der Generierung nicht berücksichtigt!",
                            errorhint: "MUCGPT kann Fehler machen. Überprüfe wichtige Informationen.",
                            toolsselectorbutton_tooltip: "Werkzeuge auswählen"
                        },
                        suminput: {
                            tokensused: "Token verbraucht",
                            limit: ". Ältere Eingaben werden bei der Generierung nicht berücksichtigt!",
                            removedocument: "Dokument löschen"
                        },
                        chattsettingsdrawer: {
                            temperature: "Temperatur",
                            min_temperature: "konservativ",
                            max_temperatur: "kreativ",
                            temperature_article: "Die",
                            temperature_info: `beeinflusst die "Kreativität" des Sprachmodells. Ein höherer Wert führt zu unvorhersehbareren Antworten (Wörter, die unwahrscheinlich gegenüber dem aktuellen Kontext sind, werden generiert), während ein niedrigerer Wert eher konservative und genauere Antworten erzeugt.`,
                            max_lenght: "Maximale Antwortlänge",
                            max_lenght_info: "Wie viele Token dürfen maximal bei einer Antwort generiert werden.",
                            system_prompt_clear: "System-Prompt löschen",
                            system_prompt: "System-Prompt",
                            system_prompt_info:
                                "sind vordefinierte Abfragen oder Anweisungen, die dazu dienen, die Antworten von MUCGPT gezielter und kontrollierter zu gestalten. Dabei nimmt die KI oft eine bestimmte Rolle ein, antwortet in einem bestimmten Format oder beachtet andere Einschränkungen."
                        },
                        assistantsettingsdrawer: {
                            expand: "Ansicht erweitern",
                            collapse: "Ansicht einklappen",
                            delete: "Assistent löschen",
                            edit: "Assistent bearbeiten",
                            finish_edit: "Bearbeitung abschließen",
                            show_configutations: "Konfigurationen anzeigen",
                            close_configutations: "Konfigurationen schließen",
                            "unpublish-button": "Veröffentlichung aufheben",
                            "remove-assistant": "Assistent entfernen",
                            publish: "Veröffentlichen",
                            unpublish: "Nicht mehr veröffentlichen",
                            deleted_warning: "Dieser Assistent wurde aus der Community gelöscht und ist nicht mehr verfügbar.",
                            deleteDialog: {
                                title: "Assistent Löschen",
                                content: "Wollen Sie den Assistenten wirklich löschen? Dies kann nicht rückgängig gemacht werden.",
                                unpublish: "Wollen Sie die Veröffentlichung des Assistenten wirklich aufheben? Dies macht ihn für andere nicht mehr verfügbar.",
                                remove: "Wollen Sie den Assistenten wirklich entfernen? Dadurch werden alle Chats mit diesem Assistenten gelöscht.",
                                confirm: "Ja",
                                cancel: "Nein"
                            }
                        },
                        answericon: {
                            label: "MUCGPT Nachricht"
                        },
                        usericon: {
                            label: "Deine Nachricht"
                        },
                        example: {
                            label: "Beispiel"
                        },
                        deleteMessage: {
                            label: "Nachricht zurückziehen"
                        },
                        quickprompt: {
                            name: "Vorgeschlagene Antworten"
                        },
                        history: {
                            button: "Gespeicherte Chats",
                            today: "Heute",
                            yesterday: "Gestern",
                            sevendays: "Letzte 7 Tage",
                            older: "Älter",
                            history: "Historie",
                            newchat: "Gib dem Chat einen neuen Namen:",
                            options: "Chat-Optionen",
                            close: "Schließen",
                            lastEdited: "Zuletzt geändert:",
                            rename: "Chat umbenennen",
                            delete: "Chat löschen",
                            favourites: "Favoriten",
                            save: "Zu Favoriten hinzufügen",
                            unsave: "Aus Favoriten entfernen",
                            error: "Wechsle nicht den Tab, bevor die Antwort fertig generiert wurde!",
                            saved_in_browser: "Im Browser gespeicherte Chats",
                            loadMore: "Mehr laden",
                            more: "mehr"
                        },
                        add_assistant_button: {
                            add_assistant: "Erstelle deinen eigenen Assistenten"
                        },
                        create_assistant_dialog: {
                            what_function: "Was soll dein Assistent können?",
                            generating_prompt: "Generiere Prompt...",
                            dismiss: "Abbrechen",
                            create: "Erstellen",
                            prompt_title_desc: "Vorgeschlagener System-Prompt, Titel und Beschreibung:",
                            back: "Zurück",
                            save: "Speichern",
                            describe: "Beschreibe die Funktion...",
                            skip: "Überspringen",
                            assistant_saved_success: "Assistent erfolgreich gespeichert!",
                            assistant_saved_message: 'Ihr Assistent "{{title}}" wurde erfolgreich erstellt und gespeichert.',
                            assistant_creation_failed: "Assistent konnte nicht erstellt werden",
                            save_config_failed: "Speichern der Assistenten-Konfiguration fehlgeschlagen",
                            assistant_save_failed: "Speichern des Assistenten fehlgeschlagen",
                            save_assistant_failed: "Speichern der Assistenten-Konfiguration fehlgeschlagen",
                            assistant_generated_success: "Assistent erfolgreich generiert!",
                            assistant_generated_message: "Die Konfiguration Ihres Assistenten wurde generiert. Sie können sie jetzt überprüfen und anpassen.",
                            assistant_generation_failed: "Generierung der Assistenten-Konfiguration fehlgeschlagen"
                        },
                        edit_assistant_dialog: {
                            title: "Assistent bearbeiten",
                            assistant_title: "Titel",
                            assistant_description: "Beschreibung",
                            system_prompt: "System-Prompt",
                            advanced_settings: "Erweiterte Einstellungen",
                            hide_advanced_settings: "Erweiterte Einstellungen ausblenden",
                            collapse: "Einklappen",
                            temperature: "Temperatur",
                            max_output_tokens: "Maximale Ausgabe-Token",
                            departments: "Abteilungen",
                            departments_info:
                                "Dies sind die Abteilungen, die Zugriff auf den Assistenten haben. Alle Abteilungen in der Hierarchie unter den ausgewählten Abteilungen haben ebenfalls Zugriff.",
                            quick_prompts: "Vorgeschlagene Antworten",
                            quick_prompts_placeholder: "Fügen Sie Vorgeschlagene Antworten hinzu, eine pro Zeile (Label|Prompt)",
                            quick_prompt_label_placeholder: "Geben Sie das Label ein...",
                            quick_prompt_text_placeholder: "Geben Sie den Prompt-Text ein...",
                            add_quick_prompt: "Vorgeschlagene Antwort hinzufügen",
                            examples: "Beispiele",
                            examples_placeholder: "Fügen Sie Beispiele hinzu, eine pro Zeile (Text|Wert)",
                            example_text_placeholder: "Geben Sie den Beispiel-Text ein...",
                            example_value_placeholder: "Geben Sie den Beispiel-Wert ein...",
                            add_example: "Beispiel hinzufügen",
                            tools: "Werkzeuge",
                            select_tools: "Werkzeuge auswählen",
                            no_tools_selected: "Keine Werkzeuge ausgewählt",
                            no_quick_prompts_selected: "Keine vorgeschlagenen Antworten hinzugefügt",
                            no_examples_selected: "Keine Beispiele hinzugefügt",
                            remove: "Entfernen",
                            close: "Schließen",
                            back: "Zurück",
                            save: "Speichern",
                            saved_successfully: "Erfolgreich gespeichert!",
                            assistant_saved_description: "Der Assistent {{assistantName}} wurde erfolgreich gespeichert.",
                            // Stepper step titles
                            step_title: "Titel",
                            step_description: "Beschreibung",
                            step_system_prompt: "System-Prompt",
                            step_tools: "Werkzeuge",
                            step_quick_prompts: "Schnelle Eingaben",
                            step_examples: "Beispiele",
                            step_visibility: "Sichtbarkeit",
                            step_advanced_settings: "Erweiterte Einstellungen",
                            // Navigation buttons
                            next: "Weiter",
                            previous: "Zurück",
                            // Close dialog
                            close_dialog_title: "Dialog schließen",
                            close_dialog_message: "Sind Sie sicher, dass Sie den Dialog schließen möchten? Alle nicht gespeicherten Änderungen gehen verloren.",
                            cancel: "Abbrechen"
                        },
                        publish_assistant_dialog: {
                            title: "Assistent veröffentlichen",
                            version: "Version",
                            assistant_info_title: "Unbenannter Assistent",
                            assistant_info_description: "Keine Beschreibung verfügbar",
                            important_info_title: "Wichtige Hinweise",
                            important_info_items: {
                                item1: "Der Assistent wird entsprechend Ihrer Auswahl verfügbar gemacht",
                                item2: "Veröffentlichte Assistenten können von den berechtigten Nutzern verwendet werden",
                                item3: "Die Veröffentlichung kann später geändert oder zurückgenommen werden"
                            },
                            publication_options_title: "Veröffentlichungsoptionen",
                            visibility_public: "Öffentlich sichtbar",
                            visibility_private: "Privat (nur über Link)",
                            visibility_public_description: "Assistent erscheint in der öffentlichen Assistent-Liste",
                            visibility_private_description: "Assistent ist nur über den direkten Link erreichbar",
                            direct_link_label: "Direkter Assistent-Link:",
                            copy_link_tooltip: "Link in Zwischenablage kopieren",
                            copy_link_aria: "Link kopieren",
                            departments_title: "Veröffentlichen für Abteilungen",
                            departments_description: "Wählen Sie die Abteilungen aus, für die der Assistent verfügbar sein soll:",
                            cancel: "Abbrechen",
                            confirm: "Bestätigen",
                            publishing: "Veröffentliche...",
                            done: "Fertig",
                            publish_assistant_success: "Assistent erfolgreich veröffentlicht",
                            publish_assistant_success_message: "Der Assistent '{{title}}' wurde erfolgreich veröffentlicht"
                        },
                        search_assistant_button: {
                            search_assistants: "Assistenten durchsuchen"
                        },
                        community_assistants: {
                            title: "Community Assistenten", // Deutsch
                            search: "Assistenten durchsuchen",
                            filter_by_tag: "Nach Tag filtern",
                            sort_by: "Sortieren nach",
                            sort_title: "Titel",
                            sort_updated: "Zuletzt aktualisiert",
                            sort_subscriptions: "Abonnements",
                            save: "Assistent speichern",
                            system_message: "System-Prompt",
                            departments: "Zugelassene Bereiche",
                            departments_description: "Dieser Assistent ist für folgende Organisationseinheiten freigegeben:",
                            department_single: "Bereich",
                            departments_plural: "Bereiche",
                            public_access: "Öffentlich",
                            description: "Beschreibung",
                            tools: "Werkzeuge",
                            tool_single: "Werkzeug",
                            tools_plural: "Werkzeuge",
                            loading_assistants: "Lade Assistenten...",
                            no_assistants_found: "Keine Assistenten gefunden, die Ihren Kriterien entsprechen.",
                            back_to_search: "Zurück zur Suche",
                            already_saved: "Bereits gespeichert",
                            assistant_already_saved: "Assistent ist bereits gespeichert!",
                            subscribe_success_title: "Assistent {{title}} erfolgreich abonniert",
                            subscribe_success_message: "Du hast den Assistenten erfolgreich abonniert.",
                            subscribe_failed_title: "Fehler beim Abonnieren des Assistenten {{title}}",
                            subscribe_failed_default: "Beim Abonnieren des Assistenten ist ein Fehler aufgetreten. Bitte versuche es erneut.",
                            times_subscribed: "mal abonniert",
                            owned_assistant: "Eigener Assistent",
                            subscribed_assistant: "Abonniert"
                        },
                        toolsselector: {
                            title: "Verfügbare Tools",
                            select_all: "Alle auswählen",
                            none: "Keine Tools verfügbar.",
                            apply: "Übernehmen",
                            cancel: "Abbrechen"
                        }
                    },
                    ...tutorialsTranslations.DE
                }
            },
            EN: {
                translation: {
                    header: {
                        chat: "Chat",
                        nutzungsbedingungen: "Terms of use",
                        create_assistant: "Create assistant"
                    },
                    menu: {
                        go_to_tutorials_tooltip: "Show tutorials and guides for MUCGPT",
                        go_to_tutorials: "Get to know MUCGPT",
                        go_to_tutorials_aria: "Tutorials and guides for MUCGPT",
                        chat_header: "Hello {{user}}, what are you planning today?",
                        own_assistants: "Local Assistants", // Englisch
                        community_assistants: "Community Assistants",
                        no_assistants: "No Assistants found",
                        soon: "In Development...",
                        owned: "Owned:",
                        subscribed: "Subscribed:",
                        select: "Select",
                        navigation_aria: "Chat navigation",
                        go_to_chat: "Go to chat",
                        go_to_chat_tooltip: "Navigate directly to chat page without entering a question",
                        go_to_chat_aria: "Navigate directly to chat",
                        assistants_section: "Assistant management",
                        own_assistants_list: "Your assistants",
                        owned_assistants_list: "Your community assistants",
                        subscribed_assistants_list: "Subscribed community assistants",
                        deleted: "Deleted:",
                        deleted_assistants_list: "Deleted community assistants",
                        select_assistant_aria: "Select assistant: {{title}}",
                        share_assistant_aria: "Share assistant: {{title}}"
                    },
                    chat: {
                        header: "Ask a question or try an example",
                        prompt: "Ask a question",
                        answer_loading: "Generating answer",
                        quickprompts: {
                            shorter_tooltip: "Shorten your answer",
                            longer_tooltip: "Write a longer response",
                            formal_tooltip: "Write your answer more formal",
                            informal_tooltip: "Write your answer more informal",
                            shorter: "➖ less detail",
                            longer: "➕  more detail",
                            formal: "👔 more formal",
                            informal: "👕 more informal",
                            shorter_prompt:
                                "Rewrite your last message into a new, shorter text that conveys the original content in a more concise and impactful way. This text should include the most important information and improve the reader's understanding.",
                            longer_prompt:
                                "Rewrite your last message into a new, longer text that expands upon the original content with more details and background information. This text should deepen the reader's understanding and provide a more comprehensive perspective on the topic.",
                            formal_prompt:
                                "Rewrite your last message into a new formal text that presents the original content in an academic writing style. This text should have a clear structure, use precise and factual language, and provide the reader with a professional reading experience.",
                            informal_prompt:
                                "Rewrite your last message into a new, more informal text that conveys the original content in a casual writing style. This text should provide the reader with a relaxed reading experience by using easily understandable language and, if appropriate, incorporating humorous elements."
                        }
                    },
                    version: {
                        header: "Whats new?",
                        added: "Added",
                        fixed: "Fixed",
                        changed: "Changed"
                    },
                    common: {
                        open_menu: "Open menu",
                        close_menu: "Close menu",
                        main_navigation: "Main navigation",
                        home_link: "Go to homepage",
                        environment_label: "Environment: {{env}}",
                        page_navigation: "Page navigation",
                        user_settings: "User settings",
                        main_content: "Main content",
                        footer_info: "Footer information",
                        clear_chat: "New chat",
                        settings: "Settings",
                        close: "Close",
                        messages: "Messages",
                        examples: "Examples",
                        sidebar_show: "Show sidebar",
                        sidebar_hide: "Hide sidebar",
                        cancel: "Cancel",
                        ok: "OK",
                        errors: {
                            config_not_loaded: "Configuration could not be loaded.",
                            failed_to_load_config: "Failed to load configuration.",
                            configuration_error: "Configuration error"
                        }
                    },
                    create_assistant: {
                        title: "Title",
                        description: "Description",
                        prompt: "System prompt",
                        create: "Create"
                    },
                    components: {
                        assistant_chat: {
                            load_assistant_failed: "Assistant could not be loaded",
                            assistant_not_found: "Assistant was not found",
                            load_assistant_failed_message: "An error occurred while loading the assistant",
                            load_chat_failed: "Chat could not be loaded",
                            load_chat_failed_message: "An error occurred while loading the chat history",

                            delete_assistant_success: "Assistant has been deleted",
                            delete_assistant_success_message: "The assistant '{{title}}' has been successfully deleted",
                            delete_assistant_failed: "Assistant could not be deleted",
                            delete_assistant_failed_message: "An error occurred while deleting the assistant",

                            update_assistant_success: "Assistant has been updated",
                            update_assistant_success_message: "The assistant '{{title}}' has been successfully updated",
                            update_assistant_failed: "Assistant could not be updated",
                            update_assistant_failed_message: "An error occurred while updating the assistant"
                        },
                        assistant_stats: {
                            title: "Assistant Statistics",
                            visibility_label: "Visibility:",
                            visibility_visible: "Visible",
                            visibility_invisible: "Invisible",
                            publication_label: "Publication:",
                            publication_public: "Public",
                            publication_departments: "Visible to {{count}} departments",
                            subscriptions_label: "Subscriptions:",
                            version_label: "Version:"
                        },
                        not_subscribed_dialog: {
                            subscribe_title: "Subscribe to Assistant",
                            subscribe_message: "You have not yet subscribed to the assistant '{{assistantTitle}}'. Would you like to subscribe now?",
                            subscribe_info: "By subscribing, you gain access to all features of this assistant.",
                            subscribe_button: "Subscribe",
                            subscribe_success: "Successfully subscribed",
                            subscribe_success_message: "You have successfully subscribed to the assistant '{{assistantTitle}}'",
                            no_access_title: "No Access",
                            no_access_message: "You do not have access to the assistant '{{assistantTitle}}'.",
                            no_access_info: "Please contact the creator of the assistant to gain access."
                        },
                        department_dropdown: {
                            placeholder: "Search department...",
                            no_matches: "No matches",
                            own_department_label: "(Your department)"
                        },
                        terms_of_use: {
                            tooltip: "Show terms of use",
                            label: "Terms of use",
                            accept: "Accept"
                        },
                        versioninfo: {
                            tooltip: "Core Version: {{core_version}}, Frontend Version: {{frontend_version}}, Assistant Version: {{assistant_version}}",
                            label: "Version:",
                            whats_new: "What's new?"
                        },
                        feedback: {
                            tooltip: "Give feedback",
                            aria_label: "Send feedback via email",
                            label: "Feedback"
                        },
                        helpbutton: {
                            help: "Help",
                            label: "Help & FAQ",
                            tooltip: "Show help and frequently asked questions",
                            aria_label: "Open help and FAQ"
                        },
                        language_selector: {
                            change_language: "Change language"
                        },
                        theme_selector: {
                            theme_light: "Light theme",
                            theme_dark: "Dark theme",
                            change_theme: "Change theme",
                            light_short: "Light",
                            dark_short: "Dark"
                        },
                        sumlength: {
                            sentences: "Two sentences",
                            bullets: "Five bullet points",
                            quarter: "1/4 of the length"
                        },
                        answererror: {
                            retry: "Retry"
                        },
                        answer: {
                            regenerate: "Regenerate response",
                            copy: "Copy response",
                            unformat: "Unformatted response"
                        },
                        mindmap: {
                            download: "Download",
                            reset: "Reset view",
                            source: "Source view",
                            mindmap: "Mindmap view",
                            exitFullscreen: "Exit fullscreen view",
                            fullscreen: "Fullscreen view",
                            loading: "Loading mindmap...",
                            errors: {
                                insufficientContent: "Not enough content for a mindmap",
                                transformationError: "Mindmap could not be created"
                            }
                        },
                        mermaid: {
                            download: "Download diagram",
                            render: "Draw diagram...",
                            error: "Unfortunately, the diagram cannot be displayed as it contains errors.",
                            zoomIn: "Zoom In",
                            zoomOut: "Zoom Out",
                            resetZoom: "Reset Zoom",
                            panHint: "Drag to pan • Ctrl+Scroll to zoom • Double-click to reset",
                            zoomHint: "Ctrl+Scroll to zoom • Double-click to fit"
                        },
                        sumanswer: {
                            header: "Unique entities/aspects:",
                            alternative: "Summary ",
                            copy: "Copy summary"
                        },
                        questioninput: {
                            tokensused: "Token used",
                            limit: ". Previous inputs are not considered during generation!",
                            errorhint: "MUCGPT can make errors. Verify important information.",
                            toolsselectorbutton_tooltip: "Select tools"
                        },
                        suminput: {
                            tokensused: "Token used",
                            limit: ". Previous inputs are not considered during generation!",
                            removedocument: "Delete document"
                        },
                        chattsettingsdrawer: {
                            temperature: "Temperature",
                            min_temperature: "conservative",
                            max_temperatur: "creative",
                            temperature_article: "The",
                            temperature_info: `controls the “creativity” or randomness of the text generated by MUCGPT. A higher temperature (e.g., 0.7) results in more diverse and creative output, while a lower temperature (e.g., 0.2) makes the output more deterministic and focused.`,
                            max_lenght: "Maximum response length",
                            max_lenght_info: "How many tokens (words) can be generated at most in a response.",
                            system_prompt_clear: "Clear system prompt",
                            system_prompt: "System prompt",
                            system_prompt_info:
                                "are predefined queries or instructions that serve to make the responses of MUCGPT more targeted and controlled. The AI often takes on a certain role, responds in a certain format, or observes other restrictions"
                        },
                        assistantsettingsdrawer: {
                            expand: "Expand view",
                            collapse: "Collapse view",
                            delete: "Delete assistant",
                            edit: "Edit Assistant",
                            finish_edit: "Finish Edit",
                            show_configutations: "Show configurations",
                            close_configutations: "Close configurations",
                            "unpublish-button": "Unpublish",
                            "remove-assistant": "Remove Assistant",
                            publish: "Publish",
                            unpublish: "Unpublish",
                            deleted_warning: "This assistant has been deleted from the community and is no longer available.",
                            deleteDialog: {
                                title: "Delete Assistant",
                                content: "Are you sure you want to delete the assistant? This action cannot be undone.",
                                unpublish: "Are you sure you want to unpublish the assistant? This will make it unavailable to others.",
                                remove: "Are you sure you want to remove the assistant? This will delete all chats with this assistant.",
                                confirm: "Yes",
                                cancel: "No"
                            }
                        },
                        answericon: {
                            label: "MUCGPT message"
                        },
                        usericon: {
                            label: "Your message"
                        },
                        example: {
                            label: "Example"
                        },
                        deleteMessage: {
                            label: "Retract message"
                        },
                        quickprompt: {
                            name: "Recommended answers"
                        },
                        history: {
                            button: "Saved Chats",
                            today: "Today",
                            yesterday: "Yesterday",
                            sevendays: "Last 7 Days",
                            older: "Older",
                            history: "History",
                            newchat: "Enter new name for the chat:",
                            options: "Chat-Options",
                            close: "Close",
                            lastEdited: "Last edited: ",
                            rename: "Rename chat",
                            delete: "Delete chat",
                            favourites: "Favourites",
                            save: "Add to Favourites",
                            unsave: "Remove from Favourites",
                            error: "Do not change the Tab before the Answer is fully generated!",
                            saved_in_browser: "Chats saved in Browser",
                            loadMore: "Load more",
                            more: "more"
                        },
                        add_assistant_button: {
                            add_assistant: "Create your own assistant"
                        },
                        create_assistant_dialog: {
                            what_function: "What should your assistant be able to do?",
                            generating_prompt: "Generating prompt...",
                            dismiss: "Cancel",
                            create: "Create",
                            prompt_title_desc: "Suggested system prompt, title, and description:",
                            back: "Back",
                            save: "Save",
                            describe: "Describe the function...",
                            skip: "Skip",
                            assistant_saved_success: "Assistant saved successfully!",
                            assistant_saved_message: 'Your assistant "{{title}}" has been created and saved.',
                            assistant_creation_failed: "Assistant could not be created",
                            save_config_failed: "Failed to save assistant configuration",
                            assistant_save_failed: "Failed to save assistant",
                            save_assistant_failed: "Failed to save assistant configuration",
                            assistant_generated_success: "Assistant generated successfully!",
                            assistant_generated_message: "Your assistant configuration has been generated. You can now review and customize it.",
                            assistant_generation_failed: "Failed to generate assistant configuration"
                        },
                        edit_assistant_dialog: {
                            title: "Edit Assistant",
                            assistant_title: "Title",
                            assistant_description: "Description",
                            system_prompt: "System Prompt",
                            advanced_settings: "Advanced Settings",
                            hide_advanced_settings: "Hide Advanced Settings",
                            collapse: "Collapse",
                            temperature: "Temperature",
                            max_output_tokens: "Max Output Tokens",
                            departments: "Departments",
                            departments_info:
                                "These are the departments that have access to the assistant. All departments in the hierarchy below the selected departments also have access.",
                            quick_prompts: "Quick Prompts",
                            quick_prompts_placeholder: "Add quick prompts, one per line (label|prompt)",
                            quick_prompt_label_placeholder: "Enter the label...",
                            quick_prompt_text_placeholder: "Enter the prompt text...",
                            add_quick_prompt: "Add Quick Prompt",
                            examples: "Examples",
                            examples_placeholder: "Add examples, one per line (text|value)",
                            example_text_placeholder: "Enter the example text...",
                            example_value_placeholder: "Enter the example value...",
                            add_example: "Add Example",
                            tools: "Tools",
                            select_tools: "Select Tools",
                            no_tools_selected: "No tools selected",
                            no_quick_prompts_selected: "No quick prompts added",
                            no_examples_selected: "No examples added",
                            remove: "Remove",
                            close: "Close",
                            back: "Back",
                            save: "Save",
                            saved_successfully: "Succesfully saved!",
                            assistant_saved_description: "The assistant {{assistantName}} has been successfully saved.",
                            step_title: "Title",
                            step_description: "Description",
                            step_system_prompt: "System Prompt",
                            step_tools: "Tools",
                            step_quick_prompts: "Quick Prompts",
                            step_examples: "Examples",
                            step_visibility: "Visibility",
                            step_advanced_settings: "Advanced Settings",
                            next: "Next",
                            previous: "Previous",
                            close_dialog_title: "Close Dialog",
                            close_dialog_message: "Are you sure you want to close the dialog? All unsaved changes will be lost.",
                            cancel: "Cancel"
                        },
                        publish_assistant_dialog: {
                            title: "Publish Assistant",
                            version: "Version",
                            assistant_info_title: "Unnamed Assistant",
                            assistant_info_description: "No description available",
                            important_info_title: "Important Information",
                            important_info_items: {
                                item1: "The assistant will be made available according to your selection",
                                item2: "Published assistants can be used by authorized users",
                                item3: "Publication can be changed or withdrawn later"
                            },
                            publication_options_title: "Publication Options",
                            visibility_public: "Publicly visible",
                            visibility_private: "Private (link only)",
                            visibility_public_description: "Assistant appears in the public assistant list",
                            visibility_private_description: "Assistant is only accessible via direct link",
                            direct_link_label: "Direct assistant link:",
                            copy_link_tooltip: "Copy link to clipboard",
                            copy_link_aria: "Copy link",
                            departments_title: "Publish for departments",
                            departments_description: "Select the departments for which the assistant should be available:",
                            cancel: "Cancel",
                            confirm: "Confirm",
                            publishing: "Publishing...",
                            done: "Done",
                            publish_assistant_success: "Assistant published successfully",
                            publish_assistant_success_message: "The assistant '{{title}}' has been published successfully"
                        },
                        search_assistant_button: {
                            search_assistants: "Search assistants"
                        },
                        community_assistants: {
                            title: "Community Assistants", // Englisch
                            search: "Search assistants",
                            filter_by_tag: "Filter by tag",
                            sort_by: "Sort by",
                            sort_title: "Title",
                            sort_updated: "Last updated",
                            sort_subscriptions: "Subscriptions",
                            save: "Save assistant",
                            system_message: "System prompt",
                            departments: "Authorized Departments",
                            departments_description: "This assistant is authorized for the following organizational units:",
                            department_single: "Department",
                            departments_plural: "Departments",
                            public_access: "Public",
                            description: "Description",
                            tools: "Tools",
                            tool_single: "Tool",
                            tools_plural: "Tools",
                            loading_assistants: "Loading assistants...",
                            no_assistants_found: "No assistants found matching your criteria.",
                            back_to_search: "Back to Search",
                            already_saved: "Already Saved",
                            assistant_already_saved: "Assistant is already saved!",
                            subscribe_success_title: "Assistant {{title}} successfully subscribed",
                            subscribe_success_message: "You have successfully subscribed to the assistant.",
                            subscribe_failed_title: "Error subscribing to {{title}}",
                            subscribe_failed_default: "An error occurred while subscribing to the assistant. Please try again.",
                            times_subscribed: "times subscribed",
                            owned_assistant: "Own Assistant",
                            subscribed_assistant: "Subscribed"
                        },
                        toolsselector: {
                            title: "Available tools",
                            select_all: "Select all",
                            none: "No tools available.",
                            apply: "Apply",
                            cancel: "Cancel"
                        }
                    },
                    ...tutorialsTranslations.EN
                }
            },
            BA: {
                translation: {
                    header: {
                        chat: "Redn",
                        nutzungsbedingungen: "Gebrauchsvorschriftn",
                        create_assistant: "Assistenten erstoin"
                    },
                    menu: {
                        go_to_tutorials_tooltip: "Zeig Tutorials und Anleitungen für MUCGPT",
                        go_to_tutorials: "Lerne MUCGPT lernen",

                        go_to_tutorials_aria: "Tutorials und Anleitungen für MUCGPT",
                        chat_header: "Griaß di {{user}}, wos host heid vor?",
                        own_assistants: "Lokale Assitentn", // Bairisch
                        community_assistants: "Community Assistentn",
                        no_assistants: "Koane Assitentn gfundn",
                        soon: "In Entwicklung...",
                        owned: "Eigene:",
                        subscribed: "Abonnierte:",
                        select: "Auswähln",
                        navigation_aria: "Chat-Navigation",
                        go_to_chat: "Glei zum Chat",
                        go_to_chat_tooltip: "Glei auf’d Chat-Seit geh, ganz ohne Frog eingeben",
                        go_to_chat_aria: "Glei zum Chat geh",
                        assistants_section: "Assistenten-Verwaltung",
                        own_assistants_list: "Deina Assistentn",
                        owned_assistants_list: "Deina Community-Assistentn",
                        subscribed_assistants_list: "Abonniert Community-Assistentn",
                        deleted: "Glöschte:",
                        deleted_assistants_list: "Glöschte Community-Assistentn",
                        select_assistant_aria: "Assistent aussuacha: {{title}}",
                        share_assistant_aria: "Assistent teilen: {{title}}"
                    },
                    chat: {
                        header: "Stelle a Froog oda probier a Beispui",
                        prompt: "Stelle a Froog ",
                        answer_loading: "I bearbeit grad de Frog",
                        quickprompts: {
                            shorter_tooltip: "Schreib a kürzere Antwort",
                            longer_tooltip: "Schreib a längere Antwort",
                            formal_tooltip: "Schreib a förmlichere Antwort",
                            informal_tooltip: "Schreib a informellere Antwort",
                            shorter: "➖ Kürzer",
                            longer: "➕ Länger",
                            formal: "👔 Förmlicher",
                            informal: "👕 Informeller",
                            shorter_prompt:
                                "Formulier dei letzte Nachricht zu am neuen kürzeren Text, der an ursprünglichen Inhalt in a kürzere und prägnantere Form wiedagibt. Der Text soidad die wichtigsten Informationen enthalten und as Verständnis des Lesers verbessern.",
                            longer_prompt:
                                "Formuliere dei letzte Nachricht zu am neuen längeren Text, der an ursprünglichen Inhalt erweitert und mit mehr Details und Hintergrundinformationen versehen is. Der Text soidad as Verständnis des Lesers vertiefen und a umfassendere Perspektive auf das Thema bieten.",
                            formal_prompt:
                                "Formuliere dei letzte Nachricht zu am neuen formellen Text, der an ursprünglichen Inhalt in na akademischen Schreibweise präsentiert. Der Text soidad a klare Struktur aufweisen, präzise und sachliche Ausdrucksweise benutzn und am Leser a professionelles Leseerlebnis bieten",
                            informal_prompt:
                                "Formuliere dei letzte Nachricht zu am neuen informelleren Text, der an ursprünglichen Inhalt in a lockeren Schreibweise wiedagibt. Dieser Text soi am Leser a ungezwungenes Leseerlebnis bieten, indem er leicht verständliche Sprache und gegebenenfalls auch humorvolle Elemente benutzt."
                        }
                    },
                    common: {
                        open_menu: "Menü aufmachn",
                        close_menu: "Menü zumachn",
                        skip_to_content: "Glei zum Hauptinhalt hupfa",
                        main_navigation: "Haupt-Navigation",
                        home_link: "Zruck auf d’Startseit",
                        environment_label: "Umgebung: {{env}}",
                        page_navigation: "Seitn-Navigation",
                        user_settings: "Nutzereinstellungen",
                        main_content: "Hauptinhalt",
                        footer_info: "Fußzeilen-Info",
                        clear_chat: "Neia Chat",
                        settings: "Konfiguration",
                        close: "Schließen",
                        messages: "Nochrichten",
                        examples: "Beispui",
                        sidebar_show: "Sidebar zoagn",
                        sidebar_hide: "Sidebar ausblenden",
                        cancel: "Abbrechen",
                        ok: "OK",
                        errors: {
                            config_not_loaded: "Konfiguration konnt ned g'laden werdn.",
                            failed_to_load_config: "Fehler beim Laden vo da Konfiguration.",
                            configuration_error: "Konfigurationsfehler"
                        }
                    },
                    version: {
                        header: "Wos gibts neis?",
                        added: "Nei",
                        fixed: "Fehla beseitigt",
                        changed: "Änderunga"
                    },
                    create_assistant: {
                        title: "Titel",
                        description: "Beschreibung",
                        prompt: "System Prompt",
                        create: "Erstellen"
                    },
                    components: {
                        assistant_chat: {
                            load_assistant_failed: "Assistent konnt ned geladen werd'n",
                            assistant_not_found: "Assistent wurde ned g'funden",
                            load_assistant_failed_message: "Beim Laden vom Assistenten is a Fehler aufgetreten",
                            load_chat_failed: "Chat konnt ned geladen werd'n",
                            load_chat_failed_message: "Beim Laden vom Chatverlauf is a Fehler aufgetreten",

                            delete_assistant_success: "Assistent is g'schufft worden",
                            delete_assistant_success_message: "Da Assistent '{{title}}' is erfolgreich g'schufft worden",
                            delete_assistant_failed: "Assistent konnt ned g'schufft werd'n",
                            delete_assistant_failed_message: "Beim Löschn vom Assistenten is a Fehler aufgetreten",

                            update_assistant_success: "Assistent is aktualisiert worden",
                            update_assistant_success_message: "Da Assistent '{{title}}' is erfolgreich aktualisiert worden",
                            update_assistant_failed: "Assistent konnt ned aktualisiert werd'n",
                            update_assistant_failed_message: "Beim Aktualisieren vom Assistenten is a Fehler aufgetreten"
                        },
                        assistant_stats: {
                            title: "Assistenten-Statistikn",
                            visibility_label: "Sichtbarkeit:",
                            visibility_visible: "Sichtbar",
                            visibility_invisible: "Unsichtbar",
                            publication_label: "Veröffentlichung:",
                            publication_public: "Öffentlich",
                            publication_departments: "Sichtbar für {{count}} Abteilungen",
                            subscriptions_label: "Abonnements:",
                            version_label: "Version:"
                        },
                        not_subscribed_dialog: {
                            subscribe_title: "Assistenten abonnieren",
                            subscribe_message: "Du hosd'n Assistenten '{{assistantTitle}}' no ned abonniert. Möchst'n jetzt abonnieren?",
                            subscribe_info: "Durch's Abonnieren kriagst Zugriff auf alle Funktionen von dem Assistenten.",
                            subscribe_button: "Abonnieren",
                            subscribe_success: "Erfolgreich abonniert",
                            subscribe_success_message: "Du hosd'n Assistenten '{{assistantTitle}}' erfolgreich abonniert",
                            no_access_title: "Koa Zugriff",
                            no_access_message: "Du hosd koan Zugriff auf'n Assistenten '{{assistantTitle}}'.",
                            no_access_info: "Bitte wend di an'n Ersteller vom Assistenten, damit'd Zugriff kriagst."
                        },
                        department_dropdown: {
                            placeholder: "Suach Abteilung...",
                            no_matches: "Koin Treffer",
                            own_department_label: "(Dei Abteilung)"
                        },
                        terms_of_use: {
                            tooltip: "Nutzungsbedingunga zeig'n",
                            label: "Nutzungsbedingunga",
                            accept: "Zustimm'n"
                        },
                        versioninfo: {
                            tooltip: "Kern Version: {{core_version}}, Frontend Version: {{frontend_version}}, Assistenten Version: {{assistant_version}}",
                            label: "Version:",
                            whats_new: "Wos gibt's Nei's?"
                        },
                        feedback: {
                            tooltip: "Feedback geb'n",
                            aria_label: "Feedback per E-Mail schick'n",
                            label: "Feedback"
                        },
                        helpbutton: {
                            help: "Hilfe",
                            label: "Hilfe & FAQ",
                            tooltip: "Hilfe und häufige Frog'n zeig'n",
                            aria_label: "Hilfe und FAQ aufmach'n"
                        },
                        language_selector: {
                            change_language: "Sprach wechs'l"
                        },
                        theme_selector: {
                            theme_light: "Helles Thema",
                            theme_dark: "Dunkles Thema",
                            change_theme: "Thema wechs'l",
                            light_short: "Hell",
                            dark_short: "Dunkl"
                        },
                        sumlength: {
                            sentences: "Zwoa Sätzen",
                            bullets: "Fünf Stichpunkten",
                            quarter: "Viertl vo da Läng"
                        },
                        answererror: {
                            retry: "No amoi probiern",
                            copy: "Antwort kopieren",
                            unformat: "Unformatierte Antwort"
                        },
                        answer: {
                            regenerate: "No amoi probiern"
                        },
                        mindmap: {
                            download: "Obalada",
                            reset: "Oisicht zrucksetzn",
                            source: "Datenoisicht",
                            mindmap: "Mindmapoisicht",
                            exitFullscreen: "Vollbildmodus verlass'n",
                            fullscreen: "Vollbildmodus",
                            loading: "Lade Mindmap...",
                            errors: {
                                insufficientContent: "Zu wenig Inhalt für a Mindmap",
                                transformationError: "Mindmap konnt ned erstellt werd'n"
                            }
                        },
                        mermaid: {
                            download: "Schau-Buidl obalada",
                            render: "Zeichne Schau-Buidl...",
                            error: "Des Schau-Buidl ko leiwa net duagstellt wern, wei's Fehla håd.",
                            zoomIn: "Vergrößern",
                            zoomOut: "Verkleinern",
                            resetZoom: "Zoom zrucksetzn",
                            panHint: "Ziahn zum Veschibn • Strg+Mausradl zum Zoomen • Doppelklick zum Zrucksetzn",
                            zoomHint: "Strg+Mausradl zum Zoomen • Doppelklick zum Anpassn"
                        },
                        sumanswer: {
                            header: "Einzigartige Schwerpunkte:",
                            alternative: "Zsammanfassung ",
                            copy: "Zsammanfassung kopiern"
                        },
                        questioninput: {
                            tokensused: "Token vabrocht",
                            limit: ". Oide Eingabn wean bei da Generierung ned mit einbezogn!",
                            errorhint: "MUCGPT kann a Schmarrn macha. Schau oba wichtige Informationen stimma.",
                            toolsselectorbutton_tooltip: "Werkzeig aussuachn"
                        },
                        suminput: {
                            tokensused: "Token vabrocht",
                            limit: ". Oide Eingabn wean bei da Generierung ned mit einbezogn!",
                            removedocument: "Dokument löschn"
                        },
                        chattsettingsdrawer: {
                            min_temperature: "konservativ",
                            max_temperatur: "kreativ",
                            temperature: "Temperatur",
                            temperature_article: "Da",
                            temperature_info: `	beinflusst de "Kreativität" vom Sprachmodel. A höherer Wert führt zu unvorhersehbareren Antworten (Wörter, de unwahrscheinliche geem de aktuelle Kontext san, werdn generiert), während a niedrigerer Wert eher konservative und genauere Antworten erzeugt.`,
                            max_lenght: "Maximale Antwortläng",
                            max_lenght_info: "Wia vui Token dürfen maximal bei am Antwort generiert werdn.",
                            system_prompt_clear: "System Prompt löschn",
                            system_prompt: "System Prompt",
                            system_prompt_info:
                                "san vorgegebene Abfragen oder Anweisungen, de dazu dienen, de Antworten von MUCGPT zielgerichteter und kontrollierter zum doa. Dabei nimmt de KI oft a bestimmte Rolle ei, antwortet in am bestimmten Format oder beachtet andere Einschränkungen."
                        },
                        assistantsettingsdrawer: {
                            expand: "Ansicht erweitern",
                            collapse: "Ansicht einklapp'n",
                            delete: "Assistent löschn",
                            edit: "Assistent bearbeit'n",
                            finish_edit: "Bearbeitung abschließ'n",
                            show_configutations: "Konfigurationen anzeigen",
                            close_configutations: "Konfigurationen schließen",
                            "unpublish-button": "Veröffentlichung aufheb'n",
                            "remove-assistant": "Assistent entfern'n",
                            publish: "Veröffentlich'n",
                            unpublish: "Nimma veröffentlich'n",
                            deleted_warning: "Der Assistent is aus da Community glöscht wordn und is nimma verfügbar.",
                            deleteDialog: {
                                title: "Assistent Löschn",
                                content: "Wuißt du den Assistenten echt löschn? Des ko nimma rückgängig gmocht werdn.",
                                unpublish: "Wuißt du de Veröffentlichung vom Assistenten echt aufheb'n? Dann könn'n andere den nimma nutzen.",
                                remove: "Wuißt du den Assistenten echt entfern'n? Dadurch werdn alle Chats mit dem Assistenten glöscht.",
                                confirm: "Ja",
                                cancel: "Na"
                            }
                        },
                        answericon: {
                            label: "MUCGPT Nochricht"
                        },
                        usericon: {
                            label: "Dei Nochricht"
                        },
                        example: {
                            label: "Beispui"
                        },
                        deleteMessage: {
                            label: "Nachricht zruckziang"
                        },
                        quickprompt: {
                            name: "Vogschlagene Antworten"
                        },
                        history: {
                            button: "Gespeichade Chats",
                            today: "Heid",
                            yesterday: "Gesdan",
                            sevendays: "Letzte 7 Dog",
                            older: "Oida",
                            history: "Historie",
                            newchat: "Gib dem Chat an nein Nama:",
                            options: "Chat-Optionen",
                            close: "Schließen",
                            lastEdited: "Zuletzt geändert: ",
                            rename: "Chat Umbenenna",
                            delete: "Chat Löschn",
                            favourites: "Favoriten",
                            save: "Zu Favoritn hinzufügn",
                            unsave: "Vo Favoritn entfernen",
                            error: "Wechsle de Seiten ned bevor ned de Nachricht komplett generiert wordn is!",
                            saved_in_browser: "Im Browser gespeichade Chats",
                            loadMore: "Mehr loden",
                            more: "mehr"
                        },
                        add_assistant_button: {
                            add_assistant: "Erstell dein eigenen Assistenten"
                        },
                        create_assistant_dialog: {
                            what_function: "Was soll dein Assistent können?",
                            generating_prompt: "Prompt wird erstellt...",
                            dismiss: "Abbrechen",
                            create: "Erstellen",
                            prompt_title_desc: "Vorgeschlagener System-Prompt, Titel und Beschreibung:",
                            back: "Zruck",
                            save: "Speichern",
                            describe: "Beschreib die Funktion...",
                            skip: "Übaspringa",
                            assistant_saved_success: "Assistent erfolgreich gspeichert!",
                            assistant_saved_message: 'Dei Assistent "{{title}}" is erfolgreich erstellt und gspeichert wordn.',
                            assistant_creation_failed: "Assistent konnt ned erstellt werdn",
                            save_config_failed: "Speichern vo da Assistenten-Konfiguration is fehlgschlogn",
                            assistant_save_failed: "Speichern vom Assistenten is fehlgschlogn",
                            save_assistant_failed: "Speichern vo da Assistenten-Konfiguration is fehlgschlogn",
                            assistant_generated_success: "Assistent erfolgreich generiert!",
                            assistant_generated_message: "Dei Assistent-Konfiguration is generiert wordn. Du kannst sie jetzt überprüfn und anpassn.",
                            assistant_generation_failed: "Generierung vo da Assistenten-Konfiguration is fehlgschlogn"
                        },
                        edit_assistant_dialog: {
                            title: "Assistent bearbeiten",
                            assistant_title: "Titel",
                            assistant_description: "Beschreibung",
                            system_prompt: "System-Prompt",
                            advanced_settings: "Erweiterte Einstellungen",
                            hide_advanced_settings: "Erweiterte Einstellungen vaberg",
                            collapse: "Eiklappn",
                            temperature: "Temperatur",
                            max_output_tokens: "Maximale Ausgabe-Token",
                            departments: "Abteilungen",
                            departments_info:
                                "Des san de Abteilungen, de Zugriff auf den Assistenten ham. Olle Abteilungen in da Hierarchie unter de ausgsuachten Abteilungen ham a Zugriff.",
                            quick_prompts: "Vorgeschlagene Antworten",
                            quick_prompts_placeholder: "Füg vorgschlagene Antworn hinzu, oane pro Zeile (Label|Prompt)",
                            quick_prompt_label_placeholder: "Gib des Label ei...",
                            quick_prompt_text_placeholder: "Gib den Prompt-Text ei...",
                            add_quick_prompt: "Vorgeschlagene Antwort hinzufügn",
                            examples: "Beispui",
                            examples_placeholder: "Füg Beispui hinzu, oans pro Zeile (Text|Wert)",
                            example_text_placeholder: "Gib den Beispui-Text ei...",
                            example_value_placeholder: "Gib den Beispui-Wert ei...",
                            add_example: "Beispui hinzufügn",
                            tools: "Werkzeig",
                            select_tools: "Werkzeig aussuachn",
                            no_tools_selected: "Koane Werkzeig ausgsuacht",
                            no_quick_prompts_selected: "Koane vorgeschlagene Antworn hinzugfügt",
                            no_examples_selected: "Koane Beispui hinzugfügt",
                            remove: "Entfernen",
                            close: "Schließen",
                            back: "Zruck",
                            save: "Speichan",
                            saved_successfully: "Erfolgreich gspeichert!",
                            assistant_saved_description: "Der Assistent {{assistantName}} is jetzt erfolgreich g'speichert.",
                            // Stepper step titles
                            step_title: "Titel",
                            step_description: "Beschreibung",
                            step_system_prompt: "System-Prompt",
                            step_tools: "Werkzeig",
                            step_quick_prompts: "Vorgeschlagene Antworn",
                            step_examples: "Beispui",
                            step_visibility: "Sichtbarkeit",
                            step_advanced_settings: "Erweiterte Einstellungen",
                            // Navigation buttons
                            next: "Weiter",
                            previous: "Zruck",
                            // Close dialog
                            close_dialog_title: "Dialog schließn",
                            close_dialog_message: "Bist da sicha, dass'd den Dialog schließn willst? Olle ned gspeicherten Änderungen gehen verlorn.",
                            cancel: "Obbrecha"
                        },
                        publish_assistant_dialog: {
                            title: "Assistent veröffentlcha",
                            version: "Version",
                            assistant_info_title: "Unbenannter Assistent",
                            assistant_info_description: "Koa Beschreibung verfügbar",
                            important_info_title: "Wichtige Hinweise",
                            important_info_items: {
                                item1: "Da Assistent wird entsprechend vo deiner Auswahl verfügbar gmacht",
                                item2: "Veröffentlichte Assistentn können vo de berechtigten Nutzer verwendet werdn",
                                item3: "De Veröffentlichung ko später geändert oder zruckgnomma werdn"
                            },
                            publication_options_title: "Veröffentlichungsoptionen",
                            visibility_public: "Öffentlich sichtbar",
                            visibility_private: "Privat (nur üba Link)",
                            visibility_public_description: "Assistent erscheint in da öffentlichen Assistent-Liste",
                            visibility_private_description: "Assistent is nur üba'n direkten Link erreichbar",
                            direct_link_label: "Direkter Assistent-Link:",
                            copy_link_tooltip: "Link in Zwischenablage kopiern",
                            copy_link_aria: "Link kopiern",
                            departments_title: "Veröffentlcha für Abteilungen",
                            departments_description: "Such de Abteilungen aus, für de da Assistent verfügbar sei soll:",
                            cancel: "Obbrecha",
                            confirm: "Bestätigen",
                            publishing: "Veröffentlche...",
                            done: "Fertig",
                            publish_assistant_success: "Assistent erfolgreich veröffentlicht",
                            publish_assistant_success_message: "Da Assistent '{{title}}' is erfolgreich veröffentlicht worn"
                        },
                        search_assistant_button: {
                            search_assistants: "Assistentn durchschaun"
                        },
                        community_assistants: {
                            title: "Community Assistentn", // Bairisch
                            search: "Assistentn durchschaun",
                            filter_by_tag: "Noch Tag filtern",
                            sort_by: "Sortieren noch",
                            sort_title: "Titel",
                            sort_updated: "Zletzt aktualisiert",
                            sort_subscriptions: "Abonnements",
                            save: "Assistent speichan",
                            system_message: "System-Prompt",
                            departments: "Zuglassene Bereiche",
                            departments_description: "Der Assistent is für de foigenden Organisationseinheitn freigem:",
                            department_single: "Bereich",
                            departments_plural: "Bereiche",
                            public_access: "Öffentlich",
                            description: "Beschreibung",
                            tools: "Werkzeig",
                            tool_single: "Werkzeig",
                            tools_plural: "Werkzeig",
                            loading_assistants: "Load Assistentn...",
                            no_assistants_found: "Koane Assistentn gfundn, de zu deine Kriterien passn.",
                            back_to_search: "Zruck zur Such",
                            already_saved: "Scho gspeichert",
                            assistant_already_saved: "Assistent is scho gspeichert!",
                            subscribe_success_title: "Assistent {{title}} erfolgreich abonniert",
                            subscribe_success_message: "Du host den Assistent erfolgreich abonniert.",
                            subscribe_failed_title: "Fehler beim Abonnieren vom Assistentn {{title}}",
                            subscribe_failed_default: "Beim Abonnieren vom Assistentn is a Fehler aufgtretn. Bitte versuch's amoi.",
                            times_subscribed: "moi abonniert",
                            owned_assistant: "Eigener Assistent",
                            subscribed_assistant: "Abonniert"
                        },
                        toolsselector: {
                            title: "Verfügbare Werkzeig",
                            select_all: "Olle aussuachn",
                            none: "Koane Werkzeig verfügbar.",
                            apply: "Ibernemma",
                            cancel: "Obbrecha"
                        }
                    },
                    ...tutorialsTranslations.BA
                }
            },
            FR: {
                translation: {
                    header: {
                        chat: "Chat",
                        nutzungsbedingungen: "Conditions d'utilisation"
                    },
                    menu: {
                        go_to_tutorials_tooltip: "Afficher les tutoriels et guides pour MUCGPT",
                        go_to_tutorials: "Découvrez MUCGPT",
                        go_to_tutorials_aria: "Tutoriels et guides pour MUCGPT",
                        chat_header: "Bonjour {{user}}, qu'est-ce que vous prévoyez aujourd'hui ?",
                        own_assistants: "Assistants Locaux", // French
                        community_assistants: "Assistants Communautaires",
                        no_assistants: "Aucun Assistant trouvé",
                        soon: "En Développement...",
                        owned: "Possédés:",
                        subscribed: "Abonnés:",
                        select: "Sélectionner",
                        navigation_aria: "Navigation du chat",
                        go_to_chat: "Aller au chat",
                        go_to_chat_tooltip: "Accéder directement à la page du chat sans saisir de question",
                        go_to_chat_aria: "Accéder directement au chat",
                        assistants_section: "Gestion des assistants",
                        own_assistants_list: "Vos assistants",
                        owned_assistants_list: "Vos assistants communautaires",
                        subscribed_assistants_list: "Assistants communautaires abonnés",
                        deleted: "Supprimés:",
                        deleted_assistants_list: "Assistants communautaires supprimés",
                        select_assistant_aria: "Sélectionner l'assistant : {{title}}",
                        share_assistant_aria: "Partager l'assistant : {{title}}"
                    },
                    chat: {
                        header: "Posez une question ou essayez un exemple",
                        prompt: "Posez une question",
                        answer_loading: "Créer une réponse",
                        quickprompts: {
                            shorter_tooltip: "Écrire une réponse plus courte",
                            longer_tooltip: "Écrire une réponse plus longue",
                            formal_tooltip: "Écrire une réponse plus formelle",
                            informal_tooltip: "Écrire une réponse plus informelle",
                            shorter: "➖ Plus court",
                            longer: "➕ Plus long",
                            formal: "👔 Plus formel",
                            informal: "👕 Plus informel",
                            shorter_prompt:
                                "Formulez votre dernier message en un nouveau texte plus court qui reflète le contenu original sous une forme plus courte et plus concise. Ce texte doit contenir les informations les plus importantes et améliorer la compréhension du lecteur.",
                            longer_prompt:
                                "Formulez votre dernier message en un nouveau texte plus long qui développe le contenu original et ajoute plus de détails et d'informations de contexte. Ce texte doit approfondir la compréhension du lecteur et offrir une perspective plus complète sur le sujet.",
                            formal_prompt:
                                "Formulez votre dernier message en un nouveau texte formel qui présente le contenu original dans un style académique. Ce texte doit avoir une structure claire, utiliser une expression précise et factuelle et offrir au lecteur une expérience de lecture professionnelle",
                            informal_prompt:
                                "Formulez votre dernier message en un nouveau texte plus informel qui reflète le contenu original dans un style plus décontracté. Ce texte doit offrir au lecteur une expérience de lecture détendue en utilisant un langage facile à comprendre et, le cas échéant, des éléments humoristiques."
                        }
                    },
                    version: {
                        header: "Quoi de neuf ?",
                        added: "Nouveau",
                        fixed: "Bugs corrigés",
                        changed: "Changements"
                    },
                    common: {
                        open_menu: "Ouvrir le menu",
                        close_menu: "Fermer le menu",
                        skip_to_content: "Aller directement au contenu principal",
                        main_navigation: "Navigation principale",
                        home_link: "Retour à la page d’accueil",
                        environment_label: "Environnement : {{env}}",
                        page_navigation: "Navigation de la page",
                        user_settings: "Paramètres utilisateur",
                        main_content: "Contenu principal",
                        footer_info: "Informations du pied de page",
                        clear_chat: "Nouveau chat",
                        settings: "Paramètres",
                        close: "Fermer",
                        messages: "Messages",
                        examples: "Exemples",
                        sidebar_show: "Afficher la barre latérale",
                        sidebar_hide: "Masquer la barre latérale",
                        cancel: "Annuler",
                        ok: "OK",
                        errors: {
                            config_not_loaded: "La configuration n'a pas pu être chargée.",
                            failed_to_load_config: "Échec du chargement de la configuration.",
                            configuration_error: "Erreur de configuration"
                        }
                    },
                    create_assistant: {
                        title: "Titre",
                        description: "Description",
                        prompt: "System prompt",
                        create: "Créer"
                    },
                    components: {
                        assistant_chat: {
                            load_assistant_failed: "L'assistant n'a pas pu être chargé",
                            assistant_not_found: "L'assistant n'a pas été trouvé",
                            load_assistant_failed_message: "Une erreur s'est produite lors du chargement de l'assistant",
                            load_chat_failed: "Le chat n'a pas pu être chargé",
                            load_chat_failed_message: "Une erreur s'est produite lors du chargement de l'historique du chat",

                            delete_assistant_success: "L'assistant a été supprimé",
                            delete_assistant_success_message: "L'assistant '{{title}}' a été supprimé avec succès",
                            delete_assistant_failed: "L'assistant n'a pas pu être supprimé",
                            delete_assistant_failed_message: "Une erreur s'est produite lors de la suppression de l'assistant",

                            update_assistant_success: "L'assistant a été mis à jour",
                            update_assistant_success_message: "L'assistant '{{title}}' a été mis à jour avec succès",
                            update_assistant_failed: "L'assistant n'a pas pu être mis à jour",
                            update_assistant_failed_message: "Une erreur s'est produite lors de la mise à jour de l'assistant"
                        },
                        assistant_stats: {
                            title: "Statistiques de l'Assistant",
                            visibility_label: "Visibilité:",
                            visibility_visible: "Visible",
                            visibility_invisible: "Invisible",
                            publication_label: "Publication:",
                            publication_public: "Public",
                            publication_departments: "Visible pour {{count}} départements",
                            subscriptions_label: "Abonnements:",
                            version_label: "Version:"
                        },
                        not_subscribed_dialog: {
                            subscribe_title: "S'abonner à l'assistant",
                            subscribe_message: "Vous n'êtes pas encore abonné à l'assistant '{{assistantTitle}}'. Souhaitez-vous vous abonner maintenant?",
                            subscribe_info: "En vous abonnant, vous accédez à toutes les fonctionnalités de cet assistant.",
                            subscribe_button: "S'abonner",
                            subscribe_success: "Abonnement réussi",
                            subscribe_success_message: "Vous vous êtes abonné avec succès à l'assistant '{{assistantTitle}}'",
                            no_access_title: "Aucun accès",
                            no_access_message: "Vous n'avez pas accès à l'assistant '{{assistantTitle}}'.",
                            no_access_info: "Veuillez contacter le créateur de l'assistant pour obtenir l'accès."
                        },
                        department_dropdown: {
                            placeholder: "Rechercher un département...",
                            no_matches: "Aucune correspondance",
                            own_department_label: "(Votre département)"
                        },
                        terms_of_use: {
                            tooltip: "Afficher les conditions d'utilisation",
                            label: "Conditions d'utilisation",
                            accept: "Accepter"
                        },
                        versioninfo: {
                            tooltip:  "Version de l'application: {{core_version}}, version de la frontend: {{frontend_version}},version de l'Assistant: {{assistant_version}}",
                            label: "Version:",
                            whats_new: "Quoi de neuf ?"
                        },
                        feedback: {
                            tooltip: "Donner un avis",
                            aria_label: "Envoyer des retours par e-mail",
                            label: "Feedback"
                        },
                        helpbutton: {
                            help: "Aide",
                            label: "Aide & FAQ",
                            tooltip: "Afficher l'aide et les questions fréquentes",
                            aria_label: "Ouvrir l'aide et la FAQ"
                        },
                        language_selector: {
                            change_language: "Changer la langue"
                        },
                        theme_selector: {
                            theme_light: "Thème clair",
                            theme_dark: "Thème sombre",
                            change_theme: "Changer de thème",
                            light_short: "Clair",
                            dark_short: "Sombre"
                        },
                        sumlength: {
                            sentences: "Deux phrases",
                            bullets: "Cinq points",
                            quarter: "1/4 de la longueur"
                        },
                        answererror: {
                            retry: "Réessayer"
                        },
                        answer: {
                            regenerate: "Régénérer la réponse",
                            copy: "Copier la réponse",
                            unformat: "Réponse non formatée"
                        },
                        mermaid: {
                            download: "Télécharger le diagramme",
                            render: "Dessiner le diagramme...",
                            error: "Le diagramme ne peut malheureusement pas être affiché en raison d'erreurs.",
                            zoomIn: "Agrandir",
                            zoomOut: "Réduire",
                            resetZoom: "Réinitialiser le zoom",
                            panHint: "Glisser pour déplacer • Ctrl+Molette pour zoomer • Double-clic pour réinitialiser",
                            zoomHint: "Ctrl+Molette pour zoomer • Double-clic pour ajuster"
                        },
                        mindmap: {
                            download: "Télécharger",
                            reset: "Réinitialiser la vue",
                            source: "Vue des données",
                            mindmap: "Vue de la carte mentale",
                            exitFullscreen: "Quitter le mode plein écran",
                            fullscreen: "Mode plein écran",
                            loading: "Chargement de la carte mentale...",
                            errors: {
                                insufficientContent: "Contenu insuffisant pour une carte mentale",
                                transformationError: "La carte mentale n'a pas pu être créée en raison d'une erreur"
                            }
                        },
                        sumanswer: {
                            header: "Aspects/entités uniques :",
                            alternative: "Résumé",
                            copy: "Copier le résumé"
                        },
                        questioninput: {
                            tokensused: "Jetons utilisés",
                            limit: ". Les entrées plus anciennes ne seront pas prises en compte lors de la génération !",
                            errorhint: "MUCGPT peut faire des erreurs. Vérifiez les informations importantes.",
                            toolsselectorbutton_tooltip: "Sélectionner des outils"
                        },
                        suminput: {
                            tokensused: "Tokens utilisés",
                            limit: ". Les entrées plus anciennes ne seront pas prises en compte lors de la génération !",
                            removedocument: "Supprimer le document"
                        },
                        chattsettingsdrawer: {
                            temperature: "Température",
                            min_temperature: "conservatrice",
                            max_temperatur: "créative",
                            temperature_article: "La",
                            temperature_info: `influence la "créativité" du modèle de langage. Une valeur plus élevée produit des réponses moins prévisibles (des mots improbables par rapport au contexte actuel sont générés), tandis qu'une valeur plus basse produit des réponses plus conservatrices et précises.`,
                            max_lenght: "Longueur maximale de la réponse",
                            max_lenght_info: "Nombre maximal de tokens pouvant être générés pour une réponse.",
                            system_prompt_clear: "Effacer le Prompt système",
                            system_prompt: "Prompt système",
                            system_prompt_info:
                                "sont des requêtes ou des instructions prédéfinies destinées à rendre les réponses de MUCGPT plus ciblées et contrôlées. L'IA prend souvent un rôle spécifique, répond dans un format particulier ou respecte d'autres contraintes."
                        },
                        assistantsettingsdrawer: {
                            expand: "Développer la vue",
                            collapse: "Réduire la vue",
                            delete: "Supprimer l'assistant",
                            edit: "Modifier l'assistant",
                            finish_edit: "Terminer la modification",
                            show_configutations: "Afficher les configurations",
                            close_configutations: "Fermer les configurations",
                            "unpublish-button": "Dépublier",
                            "remove-assistant": "Retirer l'assistant",
                            publish: "Publier",
                            unpublish: "Dépublier",
                            deleted_warning: "Cet assistant a été supprimé de la communauté et n'est plus disponible.",
                            deleteDialog: {
                                title: "Supprimer l'Assistant",
                                content: "Êtes-vous sûr de vouloir supprimer l'assistant ? Cette action ne peut pas être annulée.",
                                unpublish: "Êtes-vous sûr de vouloir dépublier l'assistant ? Il ne sera plus disponible pour les autres.",
                                remove: "Êtes-vous sûr de vouloir retirer l'assistant ? Cela supprimera toutes les conversations avec cet assistant.",
                                confirm: "Oui",
                                cancel: "Non"
                            }
                        },
                        answericon: {
                            label: "MUCGPT message"
                        },
                        usericon: {
                            label: "Votre message"
                        },
                        example: {
                            label: "Exemple"
                        },
                        deleteMessage: {
                            label: "Retirer le message"
                        },
                        quickprompt: {
                            name: "Réponses suggérées"
                        },
                        history: {
                            button: "Chats sauvegardés",
                            today: "Aujourd'hui",
                            yesterday: "Hier",
                            sevendays: "7 derniers jours",
                            older: "Plus ancien",
                            history: "Historique",
                            newchat: "Donnez un nouveau nom au chat :",
                            options: "Options de chat",
                            close: "Fermer",
                            lastEdited: "Dernière modification : ",
                            rename: "Renommer le chat",
                            delete: "Supprimer le chat",
                            favourites: "Favoris",
                            save: "Ajouter aux favoris",
                            unsave: "Retirer des favoris",
                            error: "Ne changez pas d'onglet avant que la réponse soit générée !",
                            saved_in_browser: "Chats sauvegardés dans le navigateur",
                            loadMore: "Charger plus",
                            more: "plus"
                        },
                        add_assistant_button: {
                            add_assistant: "Crée ton propre assistant"
                        },
                        create_assistant_dialog: {
                            what_function: "Que doit pouvoir faire votre assistant?",
                            generating_prompt: "Génération du prompt...",
                            dismiss: "Annuler",
                            create: "Créer",
                            prompt_title_desc: "Prompt système proposé, titre, et description :",
                            back: "Retour",
                            save: "Enregistrer",
                            describe: "Décrivez la fonction...",
                            skip: "Passer",
                            assistant_saved_success: "Assistant enregistré avec succès!",
                            assistant_saved_message: 'Votre assistant "{{title}}" a été créé et enregistré avec succès.',
                            assistant_creation_failed: "L'assistant n'a pas pu être créé",
                            save_config_failed: "Échec de l'enregistrement de la configuration de l'assistant",
                            assistant_save_failed: "Échec de l'enregistrement de l'assistant",
                            save_assistant_failed: "Échec de l'enregistrement de la configuration de l'assistant",
                            assistant_generated_success: "Assistant généré avec succès!",
                            assistant_generated_message:
                                "La configuration de votre assistant a été générée. Vous pouvez maintenant la vérifier et la personnaliser.",
                            assistant_generation_failed: "Échec de la génération de la configuration de l'assistant"
                        },
                        edit_assistant_dialog: {
                            title: "Modifier l'assistant",
                            assistant_title: "Titre",
                            assistant_description: "Description",
                            system_prompt: "Prompt système",
                            advanced_settings: "Paramètres avancés",
                            hide_advanced_settings: "Masquer les paramètres avancés",
                            collapse: "Réduire",
                            temperature: "Température",
                            max_output_tokens: "Tokens de sortie max",
                            departments: "Départements",
                            departments_info:
                                "Ce sont les départements qui ont accès à l'assistant. Tous les départements dans la hiérarchie sous les départements sélectionnés ont également accès.",
                            quick_prompts: "Prompts rapides",
                            quick_prompts_placeholder: "Ajoutez des prompts rapides, un par ligne (label|prompt)",
                            quick_prompt_label_placeholder: "Entrez le label...",
                            quick_prompt_text_placeholder: "Entrez le texte du prompt...",
                            add_quick_prompt: "Ajouter un prompt rapide",
                            examples: "Exemples",
                            examples_placeholder: "Ajoutez des exemples, un par ligne (texte|valeur)",
                            example_text_placeholder: "Entrez le texte de l'exemple...",
                            example_value_placeholder: "Entrez la valeur de l'exemple...",
                            add_example: "Ajouter un exemple",
                            tools: "Outils",
                            select_tools: "Sélectionner des outils",
                            no_tools_selected: "Aucun outil sélectionné",
                            no_quick_prompts_selected: "Aucun prompt rapide ajouté",
                            no_examples_selected: "Aucun exemple ajouté",
                            remove: "Supprimer",
                            close: "Fermer",
                            back: "Retour",
                            save: "Enregistrer",
                            saved_successfully: "Enregistré avec succès!",
                            assistant_saved_description: "L'assistant {{assistantName}} a été enregistré avec succès.",
                            // Stepper step titles
                            step_title: "Titre",
                            step_description: "Description",
                            step_system_prompt: "Prompt système",
                            step_tools: "Outils",
                            step_quick_prompts: "Prompts rapides",
                            step_examples: "Exemples",
                            step_visibility: "Visibilité",
                            step_advanced_settings: "Paramètres avancés",
                            // Navigation buttons
                            next: "Suivant",
                            previous: "Précédent",
                            // Close dialog
                            close_dialog_title: "Fermer le dialogue",
                            close_dialog_message: "Êtes-vous sûr de vouloir fermer le dialogue ? Toutes les modifications non enregistrées seront perdues.",
                            cancel: "Annuler"
                        },
                        publish_assistant_dialog: {
                            title: "Publier l'assistant",
                            version: "Version",
                            assistant_info_title: "Assistant sans nom",
                            assistant_info_description: "Aucune description disponible",
                            important_info_title: "Informations importantes",
                            important_info_items: {
                                item1: "L'assistant sera rendu disponible selon votre sélection",
                                item2: "Les assistants publiés peuvent être utilisés par les utilisateurs autorisés",
                                item3: "La publication peut être modifiée ou retirée plus tard"
                            },
                            publication_options_title: "Options de publication",
                            visibility_public: "Publiquement visible",
                            visibility_private: "Privé (uniquement via lien)",
                            visibility_public_description: "L'assistant apparaît dans la liste publique des assistants",
                            visibility_private_description: "L'assistant n'est accessible que via le lien direct",
                            direct_link_label: "Lien direct de l'assistant :",
                            copy_link_tooltip: "Copier le lien dans le presse-papiers",
                            copy_link_aria: "Copier le lien",
                            departments_title: "Publier pour les départements",
                            departments_description: "Sélectionnez les départements pour lesquels l'assistant doit être disponible :",
                            cancel: "Annuler",
                            confirm: "Confirmer",
                            publishing: "Publication...",
                            done: "Terminé",
                            publish_assistant_success: "Assistant publié avec succès",
                            publish_assistant_success_message: "L'assistant '{{title}}' a été publié avec succès"
                        },
                        search_assistant_button: {
                            search_assistants: "Rechercher des assistants"
                        },
                        community_assistants: {
                            title: "Assistants Communautaires",
                            search: "Rechercher des assistants",
                            filter_by_tag: "Filtrer par tag",
                            sort_by: "Trier par",
                            sort_title: "Titre",
                            sort_updated: "Dernière mise à jour",
                            sort_subscriptions: "Abonnements",
                            save: "Enregistrer l'assistant",
                            system_message: "Prompt système",
                            departments: "Départements autorisés",
                            departments_description: "Cet assistant est autorisé pour les unités organisationnelles suivantes :",
                            department_single: "Département",
                            departments_plural: "Départements",
                            public_access: "publique",
                            description: "Description",
                            tools: "Outils",
                            tool_single: "Outil",
                            tools_plural: "Outils",
                            loading_assistants: "Chargement des assistants...",
                            no_assistants_found: "Aucun assistant trouvé correspondant à vos critères.",
                            back_to_search: "Retour à la recherche",
                            already_saved: "Déjà enregistré",
                            assistant_already_saved: "L'assistant est déjà enregistré !",
                            subscribe_success_title: "Assistant {{title}} abonné avec succès",
                            subscribe_success_message: "Vous vous êtes abonné avec succès à l'assistant.",
                            subscribe_failed_title: "Erreur lors de l'abonnement à {{title}}",
                            subscribe_failed_default: "Une erreur est survenue lors de l'abonnement à l'assistant. Veuillez réessayer.",
                            times_subscribed: "fois abonné",
                            owned_assistant: "Assistant Propre",
                            subscribed_assistant: "Abonné"
                        },
                        toolsselector: {
                            title: "Outils disponibles",
                            select_all: "Tout sélectionner",
                            none: "Aucun outil disponible.",
                            apply: "Appliquer",
                            cancel: "Annuler"
                        }
                    },
                    ...tutorialsTranslations.FR
                }
            },
            UK: {
                translation: {
                    header: {
                        chat: "Чат",
                        nutzungsbedingungen: "Умови використання"
                    },
                    menu: {
                        go_to_tutorials_tooltip: "Показати посібники та інструкції для MUCGPT",
                        go_to_tutorials: "Познайомтеся з MUCGPT",
                        go_to_tutorials_aria: "Посібники та інструкції для MUCGPT",
                        chat_header: "Привіт {{user}}, що ти плануєш сьогодні?",
                        own_assistants: "Локальні Асистенти", // Ukrainisch
                        community_assistants: "Громадські Асистенти",
                        no_assistants: "Асистентів не знайдено",
                        soon: "В розробці...",
                        owned: "Власні:",
                        subscribed: "Підписані:",
                        select: "Вибрати",
                        navigation_aria: "Навігація чату",
                        go_to_chat: "Перейти до чату",
                        go_to_chat_tooltip: "Перейти прямо на сторінку чату без введення питання",
                        go_to_chat_aria: "Перейти прямо до чату",
                        assistants_section: "Управління асистентами",
                        own_assistants_list: "Ваші асистенти",
                        owned_assistants_list: "Ваші асистенти спільноти",
                        subscribed_assistants_list: "Підписані асистенти спільноти",
                        deleted: "Видалені:",
                        deleted_assistants_list: "Видалені асистенти спільноти",
                        select_assistant_aria: "Вибрати асистента: {{title}}",
                        share_assistant_aria: "Поділитися асистентом: {{title}}"
                    },
                    chat: {
                        header: "Задайте питання або спробуйте приклад",
                        prompt: "Задайте питання",
                        answer_loading: "Створення відповіді",
                        quickprompts: {
                            shorter_tooltip: "Написати коротшу відповідь",
                            longer_tooltip: "Написати довшу відповідь",
                            formal_tooltip: "Написати офіційнішу відповідь",
                            informal_tooltip: "Написати неофіційнішу відповідь",
                            shorter: "➖ Коротше",
                            longer: "➕ Довше",
                            formal: "👔 Офіційніше",
                            informal: "👕 Неофіційніше",
                            shorter_prompt:
                                "Сформулюйте ваше останнє повідомлення в новий коротший текст, який відображає оригінальний зміст у скороченому та стислому вигляді. Цей текст має містити найважливішу інформацію та покращити розуміння читача.",
                            longer_prompt:
                                "Сформулюйте ваше останнє повідомлення в новий довший текст, який розширює оригінальний зміст та додає більше деталей і контекстної інформації. Цей текст має поглибити розуміння читача та надати більш всебічний погляд на тему.",
                            formal_prompt:
                                "Сформулюйте ваше останнє повідомлення в новий офіційний текст, який представляє оригінальний зміст у академічному стилі. Цей текст має мати чітку структуру, використовувати точну та фактичну мову та надавати читачеві професійний досвід читання",
                            informal_prompt:
                                "Сформулюйте ваше останнє повідомлення в новий неофіційний текст, який відображає оригінальний зміст у невимушеному стилі. Цей текст має надавати читачеві розслаблений досвід читання за допомогою легкої та зрозумілої мови та, можливо, гумористичних елементів."
                        }
                    },
                    version: {
                        header: "Що нового?",
                        added: "Нове",
                        fixed: "Виправлено помилки",
                        changed: "Зміни"
                    },
                    common: {
                        open_menu: "Відкрити меню",
                        close_menu: "Закрити меню",
                        skip_to_content: "Перейти до основного контенту",
                        main_navigation: "Головна навігація",
                        home_link: "Повернутися на головну сторінку",
                        environment_label: "Середовище: {{env}}",
                        page_navigation: "Навігація сторінки",
                        user_settings: "Налаштування користувача",
                        main_content: "Основний контент",
                        footer_info: "Інформація у футері",
                        clear_chat: "Новий чат",
                        settings: "Налаштування",
                        close: "Закрити",
                        messages: "Повідомлення",
                        examples: "Приклади",
                        sidebar_show: "Показати бічну панель",
                        sidebar_hide: "Сховати бічну панель",
                        cancel: "Скасувати",
                        ok: "OK",
                        errors: {
                            config_not_loaded: "Не вдалося завантажити конфігурацію.",
                            failed_to_load_config: "Помилка завантаження конфігурації.",
                            configuration_error: "Помилка конфігурації"
                        }
                    },
                    create_assistant: {
                        title: "Заголовок",
                        description: "Опис",
                        prompt: "Системний запит",
                        create: "Створити"
                    },
                    components: {
                        assistant_chat: {
                            load_assistant_failed: "Не вдалося завантажити асистента",
                            assistant_not_found: "Асистента не знайдено",
                            load_assistant_failed_message: "Сталася помилка під час завантаження асистента",
                            load_chat_failed: "Не вдалося завантажити чат",
                            load_chat_failed_message: "Сталася помилка під час завантаження історії чату",

                            delete_assistant_success: "Асистента було видалено",
                            delete_assistant_success_message: "Асистента '{{title}}' було успішно видалено",
                            delete_assistant_failed: "Не вдалося видалити асистента",
                            delete_assistant_failed_message: "Сталася помилка під час видалення асистента",

                            update_assistant_success: "Асистента було оновлено",
                            update_assistant_success_message: "Асистента '{{title}}' було успішно оновлено",
                            update_assistant_failed: "Не вдалося оновити асистента",
                            update_assistant_failed_message: "Сталася помилка під час оновлення асистента"
                        },
                        assistant_stats: {
                            title: "Статистика Бота",
                            visibility_label: "Видимість:",
                            visibility_visible: "Видимий",
                            visibility_invisible: "Невидимий",
                            publication_label: "Публікація:",
                            publication_public: "Публічний",
                            publication_departments: "Видимий для {{count}} відділів",
                            subscriptions_label: "Підписки:",
                            version_label: "Версія:"
                        },
                        not_subscribed_dialog: {
                            subscribe_title: "Підписатися на асистента",
                            subscribe_message: "Ви ще не підписані на асистента '{{assistantTitle}}'. Бажаєте підписатися зараз?",
                            subscribe_info: "Підписавшись, ви отримаєте доступ до всіх функцій цього асистента.",
                            subscribe_button: "Підписатися",
                            subscribe_success: "Успішно підписано",
                            subscribe_success_message: "Ви успішно підписалися на асистента '{{assistantTitle}}'",
                            no_access_title: "Немає доступу",
                            no_access_message: "У вас немає доступу до асистента '{{assistantTitle}}'.",
                            no_access_info: "Будь ласка, зверніться до створювача асистента, щоб отримати доступ."
                        },
                        department_dropdown: {
                            placeholder: "Пошук відділу...",
                            no_matches: "Немає збігів",
                            own_department_label: "(Ваш відділ)"
                        },
                        terms_of_use: {
                            tooltip: "Показати умови використання",
                            label: "Умови використання",
                            accept: "Прийняти"
                        },
                        versioninfo: {
                            tooltip: "основна версія: {{core_version}}, версія інтерфейсу: {{frontend_version}}, версія помічника: {{assistant_version}}",
                            label: "Версія:",
                            whats_new: "Що нового?"
                        },
                        feedback: {
                            tooltip: "Залишити відгук",
                            aria_label: "Надіслати відгук електронною поштою",
                            label: "Відгук"
                        },
                        helpbutton: {
                            help: "Допомога",
                            label: "Допомога та FAQ",
                            tooltip: "Показати допомогу та часто задавані питання",
                            aria_label: "Відкрити допомогу та FAQ"
                        },
                        language_selector: {
                            change_language: "Змінити мову"
                        },
                        theme_selector: {
                            theme_light: "Світла тема",
                            theme_dark: "Темна тема",
                            change_theme: "Змінити тему",
                            light_short: "Світло",
                            dark_short: "Темно"
                        },
                        sumlength: {
                            sentences: "Два речення",
                            bullets: "П'ять пунктів",
                            quarter: "1/4 довжини"
                        },
                        answererror: {
                            retry: "Спробувати знову"
                        },
                        answer: {
                            regenerate: "Регенерувати відповідь",
                            copy: "Копіювати відповідь",
                            unformat: "Неформатована відповідь"
                        },
                        mermaid: {
                            download: "Завантажити діаграму",
                            render: "Малювати діаграму...",
                            error: "На жаль, діаграму не можна відобразити через помилки.",
                            zoomIn: "Збільшити",
                            zoomOut: "Зменшити",
                            resetZoom: "Скинути масштаб",
                            panHint: "Перетягніть для переміщення • Ctrl+прокрутка для масштабування • Подвійний клік для скидання",
                            zoomHint: "Ctrl+прокрутка для масштабування • Подвійний клік для підгонки"
                        },
                        mindmap: {
                            download: "Завантажити",
                            reset: "Скинути вигляд",
                            source: "Вигляд даних",
                            mindmap: "Вигляд інтелектуальної карти",
                            exitFullscreen: "Вийти з повноекранного режиму",
                            fullscreen: "Повноекранний режим",
                            loading: "Завантаження інтелектуальної карти...",
                            errors: {
                                insufficientContent: "Недостатньо вмісту для інтелектуальної карти",
                                transformationError: "Не вдалося створити інтелектуальну карту через помилку"
                            }
                        },
                        sumanswer: {
                            header: "Унікальні аспекти/сутності:",
                            alternative: "Резюме",
                            copy: "Копіювати резюме"
                        },
                        questioninput: {
                            tokensused: "Використано токени",
                            limit: ". Старіші введення не будуть враховані при генерації!",
                            errorhint: "MUCGPT може помилятися. Перевірте важливу інформацію.",
                            toolsselectorbutton_tooltip: "Вибрати інструменти"
                        },
                        suminput: {
                            tokensused: "Використано токени",
                            limit: ". Старіші введення не будуть враховані при генерації!",
                            removedocument: "Видалити документ"
                        },
                        chattsettingsdrawer: {
                            temperature: "Температура",
                            min_temperature: "консервативна",
                            max_temperatur: "креативна",
                            temperature_article: "Температура",
                            temperature_info: `впливає на "креативність" мовної моделі. Вища вартість призводить до менш передбачуваних відповідей (неймовірні слова порівняно з поточним контекстом генеруються), тоді як нижча вартість створює більш консервативні та точні відповіді.`,
                            max_lenght: "Максимальна довжина відповіді",
                            max_lenght_info: "Яка кількість токенів може бути згенерована при відповіді.",
                            system_prompt_clear: "Очистити системний запит",
                            system_prompt: "Системний запит",
                            system_prompt_info:
                                "це передвизначені запити або вказівки, які спрямовані на точне та контрольоване створення відповідей від MUCGPT. ШІ часто бере на себе певну роль, відповідає в певному форматі або дотримується інших обмежень."
                        },
                        assistantsettingsdrawer: {
                            expand: "Розгорнути вигляд",
                            collapse: "Згорнути вигляд",
                            delete: "Видалити асистента",
                            edit: "Редагувати асистента",
                            finish_edit: "Завершити редагування",
                            show_configutations: "Показати конфігурації",
                            close_configutations: "Закрити конфігурації",
                            "unpublish-button": "Скасувати публікацію",
                            "remove-assistant": "Видалити асистента",
                            publish: "Опублікувати",
                            unpublish: "Скасувати публікацію",
                            deleted_warning: "Цей асистент був видалений з спільноти і більше не доступний.",
                            deleteDialog: {
                                title: "Видалити Бота",
                                content: "Ви впевнені, що хочете видалити бота? Цю дію не можна скасувати.",
                                unpublish: "Ви впевнені, що хочете скасувати публікацію бота? Він стане недоступним для інших.",
                                remove: "Ви впевнені, що хочете видалити асистента? Це видалить усі чати з цим асистентом.",
                                confirm: "Так",
                                cancel: "Ні"
                            }
                        },
                        answericon: {
                            label: "Повідомлення MUCGPT"
                        },
                        usericon: {
                            label: "Ваше повідомлення"
                        },
                        example: {
                            label: "Приклад"
                        },
                        deleteMessage: {
                            label: "Видалити повідомлення"
                        },
                        quickprompt: {
                            name: "Рекомендовані відповіді"
                        },
                        history: {
                            button: "Збережені чати",
                            today: "Сьогодні",
                            yesterday: "Вчора",
                            sevendays: "Останні 7 днів",
                            older: "Старіше",
                            history: "Історія",
                            newchat: "Дайте нову назву чату:",
                            options: "Опції чату",
                            close: "Закрити",
                            lastEdited: "Останній раз редагувалося: ",
                            rename: "Перейменувати чат",
                            delete: "Видалити чат",
                            favourites: "Обране",
                            save: "Додати до обраного",
                            unsave: "Видалити з обраного",
                            error: "Не переходьте на іншу вкладку, доки відповідь не буде згенерована!",
                            saved_in_browser: "Чати, збережені в браузері",
                            loadMore: "Завантажити більше",
                            more: "більше"
                        },
                        add_assistant_button: {
                            add_assistant: "Створи свого власного асистента"
                        },
                        create_assistant_dialog: {
                            what_function: "Що має вміти ваш асистент?",
                            generating_prompt: "Генерація запиту...",
                            dismiss: "Скасувати",
                            create: "Створити",
                            prompt_title_desc: "Пропонований системний запит, заголовок та опис:",
                            back: "Назад",
                            save: "Зберегти",
                            describe: "Опишіть функцію...",
                            skip: "Пропустити",
                            assistant_saved_success: "Асистента успішно збережено!",
                            assistant_saved_message: 'Ваш асистент "{{title}}" був успішно створений і збережений.',
                            assistant_creation_failed: "Асистента не вдалося створити",
                            save_config_failed: "Не вдалося зберегти конфігурацію асистента",
                            assistant_save_failed: "Не вдалося зберегти асистента",
                            save_assistant_failed: "Не вдалося зберегти конфігурацію асистента",
                            assistant_generated_success: "Асистента успішно згенеровано!",
                            assistant_generated_message: "Конфігурацію вашого асистента згенеровано. Тепер ви можете її переглянути та налаштувати.",
                            assistant_generation_failed: "Не вдалося згенерувати конфігурацію асистента"
                        },
                        edit_assistant_dialog: {
                            title: "Редагувати асистента",
                            assistant_title: "Заголовок",
                            assistant_description: "Опис",
                            system_prompt: "Системний запит",
                            advanced_settings: "Розширені налаштування",
                            hide_advanced_settings: "Приховати розширені налаштування",
                            collapse: "Згорнути",
                            temperature: "Температура",
                            max_output_tokens: "Макс. токени виводу",
                            departments: "Відділи",
                            departments_info: "Це відділи, які мають доступ до асистента. Всі відділи в ієрархії під вибраними відділами також мають доступ.",
                            quick_prompts: "Швидкі запити",
                            quick_prompts_placeholder: "Додайте швидкі запити, по одному на рядок (мітка|запит)",
                            quick_prompt_label_placeholder: "Введіть мітку...",
                            quick_prompt_text_placeholder: "Введіть текст запиту...",
                            add_quick_prompt: "Додати швидкий запит",
                            examples: "Приклади",
                            examples_placeholder: "Додайте приклади, по одному на рядок (текст|значення)",
                            example_text_placeholder: "Введіть текст прикладу...",
                            example_value_placeholder: "Введіть значення прикладу...",
                            add_example: "Додати приклад",
                            tools: "Інструменти",
                            select_tools: "Вибрати інструменти",
                            no_tools_selected: "Інструменти не вибрано",
                            no_quick_prompts_selected: "Швидкі запити не додано",
                            no_examples_selected: "Приклади не додано",
                            remove: "Видалити",
                            close: "Закрити",
                            back: "Назад",
                            save: "Зберегти",
                            saved_successfully: "Успішно збережено!",
                            assistant_saved_description: "Асистент {{assistantName}} був успішно збережений.",
                            // Stepper step titles
                            step_title: "Заголовок",
                            step_description: "Опис",
                            step_system_prompt: "Системний запит",
                            step_tools: "Інструменти",
                            step_quick_prompts: "Швидкі запити",
                            step_examples: "Приклади",
                            step_visibility: "Видимість",
                            step_advanced_settings: "Розширені налаштування",
                            // Navigation buttons
                            next: "Далі",
                            previous: "Назад",
                            // Close dialog
                            close_dialog_title: "Закрити діалог",
                            close_dialog_message: "Ви впевнені, що хочете закрити діалог? Всі незбережені зміни будуть втрачені.",
                            cancel: "Скасувати"
                        },
                        publish_assistant_dialog: {
                            title: "Опублікувати асистента",
                            version: "Версія",
                            assistant_info_title: "Безіменний асистент",
                            assistant_info_description: "Опис відсутній",
                            important_info_title: "Важлива інформація",
                            important_info_items: {
                                item1: "Асистент буде доступний відповідно до вашого вибору",
                                item2: "Опубліковані асистенти можуть використовуватися авторизованими користувачами",
                                item3: "Публікацію можна змінити або скасувати пізніше"
                            },
                            publication_options_title: "Параметри публікації",
                            visibility_public: "Публічно видимий",
                            visibility_private: "Приватний (тільки за посиланням)",
                            visibility_public_description: "Асистент з'являється в публічному списку асистентів",
                            visibility_private_description: "Асистент доступний тільки за прямим посиланням",
                            direct_link_label: "Пряме посилання на асистента:",
                            copy_link_tooltip: "Скопіювати посилання в буфер обміну",
                            copy_link_aria: "Скопіювати посилання",
                            departments_title: "Опублікувати для відділів",
                            departments_description: "Виберіть відділи, для яких асистент має бути доступним:",
                            cancel: "Скасувати",
                            confirm: "Підтвердити",
                            publishing: "Публікація...",
                            done: "Готово",
                            publish_assistant_success: "Бот успішно опублікований",
                            publish_assistant_success_message: "Бот '{{title}}' було успішно опубліковано"
                        },
                        search_assistant_button: {
                            search_assistants: "Пошук асистентів"
                        },
                        community_assistants: {
                            title: "Громадські Асистенти", // Ukrainisch
                            search: "Пошук асистентів",
                            filter_by_tag: "Фільтрувати за тегом",
                            sort_by: "Сортувати за",
                            sort_title: "Заголовок",
                            sort_updated: "Останнє оновлення",
                            sort_subscriptions: "Підписки",
                            save: "Зберегти асистента",
                            system_message: "Системний запит",
                            departments: "Авторизовані відділи",
                            departments_description: "Цей асистент авторизований для наступних організаційних підрозділів:",
                            department_single: "Відділ",
                            departments_plural: "Відділи",
                            public_access: "Публічний",
                            description: "Опис",
                            tools: "Інструменти",
                            tool_single: "Інструмент",
                            tools_plural: "Інструменти",
                            loading_assistants: "Завантаження асистентів...",
                            no_assistants_found: "Не знайдено асистентів, що відповідають вашим критеріям.",
                            back_to_search: "Повернутися до пошуку",
                            already_saved: "Вже збережено",
                            assistant_already_saved: "Асистент вже збережено!",
                            subscribe_success_title: "Асистент {{title}} успішно підписаний",
                            subscribe_success_message: "Ви успішно підписалися на асистента.",
                            subscribe_failed_title: "Помилка при підписці на {{title}}",
                            subscribe_failed_default: "Під час підписки на асистента сталася помилка. Будь ласка, спробуйте ще раз.",
                            times_subscribed: "разів підписано",
                            owned_assistant: "Власний Асистент",
                            subscribed_assistant: "Підписаний"
                        },
                        toolsselector: {
                            title: "Доступні інструменти",
                            select_all: "Вибрати всі",
                            none: "Немає доступних інструментів.",
                            apply: "Застосувати",
                            cancel: "Скасувати"
                        }
                    },
                    ...tutorialsTranslations.UK
                }
            }
        }
    });

export default i18n;
