import i18n from "i18next";
import { initReactI18next } from "react-i18next";

i18n
    // pass the i18n instance to react-i18next.
    .use(initReactI18next)
    // init i18next
    // for all options read: https://www.i18next.com/overview/configuration-options
    .init({
        debug: true,
        fallbackLng: "Deutsch",
        interpolation: {
            escapeValue: false // not needed for react as it escapes by default
        },
        resources: {
            Deutsch: {
                translation: {
                    header: {
                        chat: "Chat",
                        nutzungsbedingungen: "Nutzungsbedingungen",
                        create_bot: "Assistent erstellen"
                    },
                    menu: {
                        chat_header: "Hallo {{user}}, was hast du heute vor?",
                        own_bots: "Lokale Assistenten",
                        community_bots: "Community Assistenten",
                        no_bots: "Keine Assistenten gefunden",
                        soon: "In Entwicklung...",
                        owned: "Eigene:",
                        subscribed: "Abonnierte:",
                        select: "Auswählen"
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
                        clear_chat: "Neuer Chat",
                        settings: "Einstellungen",
                        close: "Schließen",
                        messages: "Nachrichten",
                        examples: "Beispiele",
                        sidebar_show: "Sidebar anzeigen",
                        sidebar_hide: "Sidebar ausblenden",
                        errors: {
                            config_not_loaded: "Konfiguration konnte nicht geladen werden.",
                            failed_to_load_config: "Fehler beim Laden der Konfiguration.",
                            configuration_error: "Konfigurationsfehler"
                        }
                    },
                    create_bot: {
                        title: "Titel",
                        description: "Beschreibung",
                        prompt: "System-Prompt",
                        create: "Erstellen"
                    },
                    components: {
                        bot_chat: {
                            load_bot_failed: "Bot konnte nicht geladen werden",
                            bot_not_found: "Bot wurde nicht gefunden",
                            load_bot_failed_message: "Beim Laden des Bots ist ein Fehler aufgetreten",
                            load_chat_failed: "Chat konnte nicht geladen werden",
                            load_chat_failed_message: "Beim Laden des Chat-Verlaufs ist ein Fehler aufgetreten",

                            delete_bot_success: "Bot wurde gelöscht",
                            delete_bot_success_message: "Der Bot '{{title}}' wurde erfolgreich gelöscht",
                            delete_bot_failed: "Bot konnte nicht gelöscht werden",
                            delete_bot_failed_message: "Beim Löschen des Bots ist ein Fehler aufgetreten",

                            update_bot_success: "Bot wurde aktualisiert",
                            update_bot_success_message: "Der Bot '{{title}}' wurde erfolgreich aktualisiert",
                            update_bot_failed: "Bot konnte nicht aktualisiert werden",
                            update_bot_failed_message: "Beim Aktualisieren des Bots ist ein Fehler aufgetreten"
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
                            tooltip: "Anwendungs-Version anzeigen",
                            tooltip_with_commit: "Anwendungs-Version: {{version}}, Commit: {{commit}}",
                            label: "Version:"
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
                        theme_selector: {
                            theme_light: "Helles Thema",
                            theme_dark: "Dunkles Thema",
                            change_theme: "Thema wechseln"
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
                            error: "Das Diagramm kann leider nicht dargestellt werden, da es Fehler enthält."
                        },
                        mindmap: {
                            download: "Herunterladen",
                            reset: "Ansicht zurücksetzen",
                            source: "Datenansicht",
                            mindmap: "Mindmap-Ansicht"
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
                        botsettingsdrawer: {
                            delete: "Assistent löschen",
                            edit: "Assistent bearbeiten",
                            finish_edit: "Bearbeitung abschließen",
                            show_configutations: "Konfigurationen anzeigen",
                            close_configutations: "Konfigurationen schließen",
                            "unpublish-button": "Veröffentlichung aufheben",
                            "remove-assistant": "Assistent entfernen",
                            publish: "Veröffentlichen",
                            unpublish: "Nicht mehr veröffentlichen",
                            deleteDialog: {
                                title: "Bot Löschen",
                                content: "Wollen Sie den Bot wirklich löschen? Dies kann nicht rückgängig gemacht werden.",
                                unpublish: "Wollen Sie die Veröffentlichung des Bots wirklich aufheben? Dies macht ihn für andere nicht mehr verfügbar.",
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
                            saved_in_browser: "Im Browser gespeicherte Chats"
                        },
                        add_bot_button: {
                            add_bot: "Erstelle deinen eigenen Assistenten"
                        },
                        create_bot_dialog: {
                            what_function: "Was soll dein Assistent können?",
                            generating_prompt: "Generiere Prompt...",
                            dismiss: "Abbrechen",
                            create: "Erstellen",
                            prompt_title_desc: "Vorgeschlagener System-Prompt, Titel und Beschreibung:",
                            back: "Zurück",
                            save: "Speichern",
                            describe: "Beschreibe die Funktion...",
                            skip: "Überspringen",
                            bot_saved_success: "Assistent erfolgreich gespeichert!",
                            bot_saved_message: 'Ihr Assistent "{{title}}" wurde erfolgreich erstellt und gespeichert.',
                            bot_creation_failed: "Assistent konnte nicht erstellt werden",
                            save_config_failed: "Speichern der Assistenten-Konfiguration fehlgeschlagen",
                            bot_save_failed: "Speichern des Assistenten fehlgeschlagen",
                            save_bot_failed: "Speichern der Assistenten-Konfiguration fehlgeschlagen",
                            bot_generated_success: "Assistent erfolgreich generiert!",
                            bot_generated_message: "Die Konfiguration Ihres Assistenten wurde generiert. Sie können sie jetzt überprüfen und anpassen.",
                            bot_generation_failed: "Generierung der Assistenten-Konfiguration fehlgeschlagen"
                        },
                        edit_bot_dialog: {
                            title: "Assistent bearbeiten",
                            bot_title: "Titel",
                            bot_description: "Beschreibung",
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
                            bot_saved_description: "Der Assistent {{botName}} wurde erfolgreich gespeichert.",
                            // Stepper step titles
                            step_title: "Titel",
                            step_description: "Beschreibung",
                            step_system_prompt: "System-Prompt",
                            step_tools: "Werkzeuge",
                            step_quick_prompts: "Schnelle Eingaben",
                            step_examples: "Beispiele",
                            step_advanced_settings: "Erweiterte Einstellungen",
                            // Navigation buttons
                            next: "Weiter",
                            previous: "Zurück",
                            // Close dialog
                            close_dialog_title: "Dialog schließen",
                            close_dialog_message: "Sind Sie sicher, dass Sie den Dialog schließen möchten? Alle nicht gespeicherten Änderungen gehen verloren.",
                            cancel: "Abbrechen"
                        },
                        search_bot_button: {
                            search_bots: "Assistenten durchsuchen"
                        },
                        community_bots: {
                            title: "Community Assistenten", // Deutsch
                            search: "Assistenten durchsuchen",
                            filter_by_tag: "Nach Tag filtern",
                            save: "Assistent speichern",
                            system_message: "System-Prompt",
                            departments: "Zugelassene Bereiche",
                            departments_description: "Dieser Assistent ist für folgende Organisationseinheiten freigegeben:",
                            department_single: "Bereich",
                            departments_plural: "Bereiche",
                            public_access: "Öffentlich zugänglich",
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
                            subscribe_failed_default: "Beim Abonnieren des Assistenten ist ein Fehler aufgetreten. Bitte versuche es erneut."
                        },
                        toolsselector: {
                            title: "Verfügbare Tools",
                            select_all: "Alle auswählen",
                            none: "Keine Tools verfügbar.",
                            apply: "Übernehmen",
                            cancel: "Abbrechen"
                        }
                    }
                }
            },
            Englisch: {
                translation: {
                    header: {
                        chat: "Chat",
                        nutzungsbedingungen: "Terms of use",
                        create_bot: "Create assistant"
                    },
                    menu: {
                        chat_header: "Hello {{user}}, what are you planning today?",
                        own_bots: "Local Assistants", // Englisch
                        community_bots: "Community Assistants",
                        no_bots: "No Assistants found",
                        soon: "In Development...",
                        owned: "Owned:",
                        subscribed: "Subscribed:",
                        select: "Select"
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
                            formal: "👕 more formal",
                            informal: "more informal",
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
                        clear_chat: "New chat",
                        settings: "Settings",
                        close: "Close",
                        messages: "Messages",
                        examples: "Examples",
                        sidebar_show: "Show sidebar",
                        sidebar_hide: "Hide sidebar",
                        errors: {
                            config_not_loaded: "Configuration could not be loaded.",
                            failed_to_load_config: "Failed to load configuration.",
                            configuration_error: "Configuration error"
                        }
                    },
                    create_bot: {
                        title: "Title",
                        description: "Description",
                        prompt: "System prompt",
                        create: "Create"
                    },
                    components: {
                        bot_chat: {
                            load_bot_failed: "Bot could not be loaded",
                            bot_not_found: "Bot was not found",
                            load_bot_failed_message: "An error occurred while loading the bot",
                            load_chat_failed: "Chat could not be loaded",
                            load_chat_failed_message: "An error occurred while loading the chat history",

                            delete_bot_success: "Bot has been deleted",
                            delete_bot_success_message: "The bot '{{title}}' has been successfully deleted",
                            delete_bot_failed: "Bot could not be deleted",
                            delete_bot_failed_message: "An error occurred while deleting the bot",

                            update_bot_success: "Bot has been updated",
                            update_bot_success_message: "The bot '{{title}}' has been successfully updated",
                            update_bot_failed: "Bot could not be updated",
                            update_bot_failed_message: "An error occurred while updating the bot"
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
                            tooltip: "Show application version",
                            tooltip_with_commit: "Application version: {{version}}, Commit: {{commit}}",
                            label: "Version:"
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
                        theme_selector: {
                            theme_light: "Light theme",
                            theme_dark: "Dark theme",
                            change_theme: "Change theme"
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
                            mindmap: "Mindmap view"
                        },
                        mermaid: {
                            download: "Download diagram",
                            render: "Draw diagram...",
                            error: "Unfortunately, the diagram cannot be displayed as it contains errors."
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
                            temperature_info: `controls  controls the “creativity” or randomness of the text generated by MUCGPT. A higher temperature (e.g., 0.7) results in more diverse and creative output, while a lower temperature (e.g., 0.2) makes the output more deterministic and focused.`,
                            max_lenght: "Maximum response length",
                            max_lenght_info: "How many tokens (words) can be generated at most in a response.",
                            system_prompt_clear: "Clear system prompt",
                            system_prompt: "System prompt",
                            system_prompt_info:
                                "are predefined queries or instructions that serve to make the responses of MUCGPT more targeted and controlled. The AI often takes on a certain role, responds in a certain format, or observes other restrictions"
                        },
                        botsettingsdrawer: {
                            delete: "Delete assistant",
                            edit: "Edit Assistant",
                            finish_edit: "Finish Edit",
                            show_configutations: "Show configurations",
                            close_configutations: "Close configurations",
                            "unpublish-button": "Unpublish",
                            "remove-assistant": "Remove Assistant",
                            publish: "Publish",
                            unpublish: "Unpublish",
                            deleteDialog: {
                                title: "Delete Bot",
                                content: "Are you sure you want to delete the bot? This action cannot be undone.",
                                unpublish: "Are you sure you want to unpublish the bot? This will make it unavailable to others.",
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
                            saved_in_browser: "Chats saved in Browser"
                        },
                        add_bot_button: {
                            add_bot: "Create your own assistent"
                        },
                        create_bot_dialog: {
                            what_function: "What should your assistant be able to do?",
                            generating_prompt: "Generating prompt...",
                            dismiss: "Cancel",
                            create: "Create",
                            prompt_title_desc: "Suggested system prompt, title, and description:",
                            back: "Back",
                            save: "Save",
                            describe: "Describe the function...",
                            skip: "Skip",
                            bot_saved_success: "Assistant saved successfully!",
                            bot_saved_message: 'Your assistant "{{title}}" has been created and saved.',
                            bot_creation_failed: "Assistant could not be created",
                            save_config_failed: "Failed to save assistant configuration",
                            bot_save_failed: "Failed to save assistant",
                            save_bot_failed: "Failed to save assistant configuration",
                            bot_generated_success: "Assistant generated successfully!",
                            bot_generated_message: "Your assistant configuration has been generated. You can now review and customize it.",
                            bot_generation_failed: "Failed to generate assistant configuration"
                        },
                        edit_bot_dialog: {
                            title: "Edit Assistant",
                            bot_title: "Title",
                            bot_description: "Description",
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
                            bot_saved_description: "The assistant {{botName}} has been successfully saved.",
                            step_title: "Title",
                            step_description: "Description",
                            step_system_prompt: "System Prompt",
                            step_tools: "Tools",
                            step_quick_prompts: "Quick Prompts",
                            step_examples: "Examples",
                            step_advanced_settings: "Advanced Settings",
                            next: "Next",
                            previous: "Previous",
                            close_dialog_title: "Close Dialog",
                            close_dialog_message: "Are you sure you want to close the dialog? All unsaved changes will be lost.",
                            cancel: "Cancel"
                        },
                        search_bot_button: {
                            search_bots: "Search assistants"
                        },
                        community_bots: {
                            title: "Community Assistants", // Englisch
                            search: "Search assistants",
                            filter_by_tag: "Filter by tag",
                            save: "Save assistant",
                            system_message: "System prompt",
                            departments: "Authorized Departments",
                            departments_description: "This assistant is authorized for the following organizational units:",
                            department_single: "Department",
                            departments_plural: "Departments",
                            public_access: "Publicly accessible",
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
                            subscribe_failed_default: "An error occurred while subscribing to the assistant. Please try again."
                        },
                        toolsselector: {
                            title: "Available tools",
                            select_all: "Select all",
                            none: "No tools available.",
                            apply: "Apply",
                            cancel: "Cancel"
                        }
                    }
                }
            },
            Bairisch: {
                translation: {
                    header: {
                        chat: "Redn",
                        nutzungsbedingungen: "Gebrauchsvorschriftn",
                        create_bot: "Assistenten erstoin"
                    },
                    menu: {
                        chat_header: "Griaß di {{user}}, wos host heid vor?",
                        own_bots: "Lokale Assitentn", // Bairisch
                        community_bots: "Community Assistentn",
                        no_bots: "Koane Assitentn gfundn",
                        soon: "In Entwicklung...",
                        owned: "Eigene:",
                        subscribed: "Abonnierte:",
                        select: "Auswähln"
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
                        clear_chat: "Neia Chat",
                        settings: "Konfiguration",
                        close: "Schließen",
                        messages: "Nochrichten",
                        examples: "Beispui",
                        sidebar_show: "Sidebar zoagn",
                        sidebar_hide: "Sidebar ausblenden",
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
                    create_bot: {
                        title: "Titel",
                        description: "Beschreibung",
                        prompt: "System Prompt",
                        create: "Erstellen"
                    },
                    components: {
                        bot_chat: {
                            load_bot_failed: "Bot konnt ned geladen werd'n",
                            bot_not_found: "Bot wurde ned g'funden",
                            load_bot_failed_message: "Beim Laden vom Bot is a Fehler aufgetreten",
                            load_chat_failed: "Chat konnt ned geladen werd'n",
                            load_chat_failed_message: "Beim Laden vom Chatverlauf is a Fehler aufgetreten",

                            delete_bot_success: "Bot is g'schufft worden",
                            delete_bot_success_message: "Da Bot '{{title}}' is erfolgreich g'schufft worden",
                            delete_bot_failed: "Bot konnt ned g'schufft werd'n",
                            delete_bot_failed_message: "Beim Löschn vom Bot is a Fehler aufgetreten",

                            update_bot_success: "Bot is aktualisiert worden",
                            update_bot_success_message: "Da Bot '{{title}}' is erfolgreich aktualisiert worden",
                            update_bot_failed: "Bot konnt ned aktualisiert werd'n",
                            update_bot_failed_message: "Beim Aktualisieren vom Bot is a Fehler aufgetreten"
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
                            tooltip: "Anwendungs-Version zeig'n",
                            tooltip_with_commit: "Anwendungs-Version: {{version}}, Commit: {{commit}}",
                            label: "Version:"
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
                        theme_selector: {
                            theme_light: "Helles Thema",
                            theme_dark: "Dunkles Thema",
                            change_theme: "Thema wechs'l"
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
                            mindmap: "Mindmapoisicht"
                        },
                        mermaid: {
                            download: "Schau-Buidl obalada",
                            render: "Zeichne Schau-Buidl...",
                            error: "Des Schau-Buidl ko leiwa net duagstellt wern, wei's Fehla håd."
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
                        botsettingsdrawer: {
                            delete: "Assistent löschn",
                            edit: "Assistent bearbeit'n",
                            finish_edit: "Bearbeitung abschließ'n",
                            show_configutations: "Konfigurationen anzeigen",
                            close_configutations: "Konfigurationen schließen",
                            "unpublish-button": "Veröffentlichung aufheb'n",
                            "remove-assistant": "Assistent entfern'n",
                            publish: "Veröffentlich'n",
                            unpublish: "Nimma veröffentlich'n",
                            deleteDialog: {
                                title: "Bot Löschn",
                                content: "Wuißt du den Bot echt löschn? Des ko nimma rückgängig gmocht werdn.",
                                unpublish: "Wuißt du de Veröffentlichung vom Bot echt aufheb'n? Dann könn'n andere den nimma nutzen.",
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
                            saved_in_browser: "Im Browser gespeichade Chats"
                        },
                        add_bot_button: {
                            add_bot: "Erstell dein eigenen Assistenten"
                        },
                        create_bot_dialog: {
                            what_function: "Was soll dein Assistent können?",
                            generating_prompt: "Prompt wird erstellt...",
                            dismiss: "Abbrechen",
                            create: "Erstellen",
                            prompt_title_desc: "Vorgeschlagener System-Prompt, Titel und Beschreibung:",
                            back: "Zruck",
                            save: "Speichern",
                            describe: "Beschreib die Funktion...",
                            skip: "Übaspringa",
                            bot_saved_success: "Assistent erfolgreich gspeichert!",
                            bot_saved_message: 'Dei Assistent "{{title}}" is erfolgreich erstellt und gspeichert wordn.',
                            bot_creation_failed: "Assistent konnt ned erstellt werdn",
                            save_config_failed: "Speichern vo da Assistenten-Konfiguration is fehlgschlogn",
                            bot_save_failed: "Speichern vom Assistenten is fehlgschlogn",
                            save_bot_failed: "Speichern vo da Assistenten-Konfiguration is fehlgschlogn",
                            bot_generated_success: "Assistent erfolgreich generiert!",
                            bot_generated_message: "Dei Assistent-Konfiguration is generiert wordn. Du kannst sie jetzt überprüfn und anpassn.",
                            bot_generation_failed: "Generierung vo da Assistenten-Konfiguration is fehlgschlogn"
                        },
                        edit_bot_dialog: {
                            title: "Assistent bearbeiten",
                            bot_title: "Titel",
                            bot_description: "Beschreibung",
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
                            bot_saved_description: "Der Assistent {{botName}} is jetzt erfolgreich g'speichert.",
                            // Stepper step titles
                            step_title: "Titel",
                            step_description: "Beschreibung",
                            step_system_prompt: "System-Prompt",
                            step_tools: "Werkzeig",
                            step_quick_prompts: "Vorgeschlagene Antworn",
                            step_examples: "Beispui",
                            step_advanced_settings: "Erweiterte Einstellungen",
                            // Navigation buttons
                            next: "Weiter",
                            previous: "Zruck",
                            // Close dialog
                            close_dialog_title: "Dialog schließn",
                            close_dialog_message: "Bist da sicha, dass'd den Dialog schließn willst? Olle ned gspeicherten Änderungen gehen verlorn.",
                            cancel: "Obbrecha"
                        },
                        search_bot_button: {
                            search_bots: "Assistentn durchschaun"
                        },
                        community_bots: {
                            title: "Community Assistentn", // Bairisch
                            search: "Assistentn durchschaun",
                            filter_by_tag: "Noch Tag filtern",
                            save: "Assistent speichan",
                            system_message: "System-Prompt",
                            departments: "Zuglassene Bereiche",
                            departments_description: "Der Assistent is für de foigenden Organisationseinheitn freigem:",
                            department_single: "Bereich",
                            departments_plural: "Bereiche",
                            public_access: "Öffentlich zugänglich",
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
                            subscribe_failed_default: "Beim Abonnieren vom Assistentn is a Fehler aufgtretn. Bitte versuch's amoi."
                        },
                        toolsselector: {
                            title: "Verfügbare Werkzeig",
                            select_all: "Olle aussuachn",
                            none: "Koane Werkzeig verfügbar.",
                            apply: "Ibernemma",
                            cancel: "Obbrecha"
                        }
                    }
                }
            },
            French: {
                translation: {
                    header: {
                        chat: "Chat",
                        nutzungsbedingungen: "Conditions d'utilisation"
                    },
                    menu: {
                        chat_header: "Bonjour {{user}}, qu'est-ce que vous prévoyez aujourd'hui ?",
                        own_bots: "Assistants Locaux", // French
                        community_bots: "Assistants Communautaires",
                        no_bots: "Aucun Assistant trouvé",
                        soon: "En Développement...",
                        owned: "Possédés:",
                        subscribed: "Abonnés:",
                        select: "Sélectionner"
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
                        clear_chat: "Nouveau chat",
                        settings: "Paramètres",
                        close: "Fermer",
                        messages: "Messages",
                        examples: "Exemples",
                        sidebar_show: "Afficher la barre latérale",
                        sidebar_hide: "Masquer la barre latérale",
                        errors: {
                            config_not_loaded: "La configuration n'a pas pu être chargée.",
                            failed_to_load_config: "Échec du chargement de la configuration.",
                            configuration_error: "Erreur de configuration"
                        }
                    },
                    create_bot: {
                        title: "Titre",
                        description: "Description",
                        prompt: "System prompt",
                        create: "Créer"
                    },
                    components: {
                        bot_chat: {
                            load_bot_failed: "Le bot n'a pas pu être chargé",
                            bot_not_found: "Le bot n'a pas été trouvé",
                            load_bot_failed_message: "Une erreur s'est produite lors du chargement du bot",
                            load_chat_failed: "Le chat n'a pas pu être chargé",
                            load_chat_failed_message: "Une erreur s'est produite lors du chargement de l'historique du chat",

                            delete_bot_success: "Le bot a été supprimé",
                            delete_bot_success_message: "Le bot '{{title}}' a été supprimé avec succès",
                            delete_bot_failed: "Le bot n'a pas pu être supprimé",
                            delete_bot_failed_message: "Une erreur s'est produite lors de la suppression du bot",

                            update_bot_success: "Le bot a été mis à jour",
                            update_bot_success_message: "Le bot '{{title}}' a été mis à jour avec succès",
                            update_bot_failed: "Le bot n'a pas pu être mis à jour",
                            update_bot_failed_message: "Une erreur s'est produite lors de la mise à jour du bot"
                        },
                        department_dropdown: {
                            placeholder: "Search department...",
                            no_matches: "No matches",
                            own_department_label: "(Your department)"
                        },
                        terms_of_use: {
                            tooltip: "Afficher les conditions d'utilisation",
                            label: "Conditions d'utilisation",
                            accept: "Accepter"
                        },
                        versioninfo: {
                            tooltip: "Afficher la version de l'application",
                            tooltip_with_commit: "Version de l'application : {{version}}, Commit : {{commit}}",
                            label: "Version :"
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
                        theme_selector: {
                            theme_light: "Thème clair",
                            theme_dark: "Thème sombre",
                            change_theme: "Changer de thème"
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
                            regenerate: "Regénérer la réponse",
                            copy: "Copier la réponse",
                            unformat: "Réponse non formatée"
                        },
                        mermaid: {
                            download: "Télécharger le diagramme",
                            render: "Dessiner le diagramme...",
                            error: "Le diagramme ne peut malheureusement pas être affiché en raison d'erreurs."
                        },
                        mindmap: {
                            download: "Télécharger",
                            reset: "Réinitialiser la vue",
                            source: "Vue des données",
                            mindmap: "Vue de la carte mentale"
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
                        botsettingsdrawer: {
                            delete: "Supprimer l'assistant",
                            edit: "Modifier l'assistant",
                            finish_edit: "Terminer la modification",
                            show_configutations: "Afficher les configurations",
                            close_configutations: "Fermer les configurations",
                            "unpublish-button": "Dépublier",
                            "remove-assistant": "Retirer l'assistant",
                            publish: "Publier",
                            unpublish: "Dépublier",
                            deleteDialog: {
                                title: "Supprimer le Bot",
                                content: "Êtes-vous sûr de vouloir supprimer le bot ? Cette action est irréversible.",
                                unpublish: "Êtes-vous sûr de vouloir dépublier le bot ? Il ne sera plus disponible pour les autres.",
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
                            saved_in_browser: "Chats sauvegardés dans le navigateur"
                        },
                        add_bot_button: {
                            add_bot: "Crée ton propre assistant"
                        },
                        create_bot_dialog: {
                            what_function: "Que doit pouvoir faire votre assistant?",
                            generating_prompt: "Génération du prompt...",
                            dismiss: "Annuler",
                            create: "Créer",
                            prompt_title_desc: "Prompt système proposé, titre, et description :",
                            back: "Retour",
                            save: "Enregistrer",
                            describe: "Décrivez la fonction...",
                            skip: "Passer",
                            bot_saved_success: "Assistant enregistré avec succès!",
                            bot_saved_message: 'Votre assistant "{{title}}" a été créé et enregistré avec succès.',
                            bot_creation_failed: "L'assistant n'a pas pu être créé",
                            save_config_failed: "Échec de l'enregistrement de la configuration de l'assistant",
                            bot_save_failed: "Échec de l'enregistrement de l'assistant",
                            save_bot_failed: "Échec de l'enregistrement de la configuration de l'assistant",
                            bot_generated_success: "Assistant généré avec succès!",
                            bot_generated_message: "La configuration de votre assistant a été générée. Vous pouvez maintenant la vérifier et la personnaliser.",
                            bot_generation_failed: "Échec de la génération de la configuration de l'assistant"
                        },
                        edit_bot_dialog: {
                            title: "Modifier l'assistant",
                            bot_title: "Titre",
                            bot_description: "Description",
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
                            bot_saved_description: "L'assistant {{botName}} a été enregistré avec succès.",
                            // Stepper step titles
                            step_title: "Titre",
                            step_description: "Description",
                            step_system_prompt: "Prompt système",
                            step_tools: "Outils",
                            step_quick_prompts: "Prompts rapides",
                            step_examples: "Exemples",
                            step_advanced_settings: "Paramètres avancés",
                            // Navigation buttons
                            next: "Suivant",
                            previous: "Précédent",
                            // Close dialog
                            close_dialog_title: "Fermer le dialogue",
                            close_dialog_message: "Êtes-vous sûr de vouloir fermer le dialogue ? Toutes les modifications non enregistrées seront perdues.",
                            cancel: "Annuler"
                        },
                        search_bot_button: {
                            search_bots: "Rechercher des assistants"
                        },
                        community_bots: {
                            title: "Assistants Communautaires",
                            search: "Rechercher des assistants",
                            filter_by_tag: "Filtrer par tag",
                            save: "Enregistrer l'assistant",
                            system_message: "Prompt système",
                            departments: "Départements autorisés",
                            departments_description: "Cet assistant est autorisé pour les unités organisationnelles suivantes :",
                            department_single: "Département",
                            departments_plural: "Départements",
                            public_access: "Accessible publiquement",
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
                            subscribe_failed_default: "Une erreur est survenue lors de l'abonnement à l'assistant. Veuillez réessayer."
                        },
                        toolsselector: {
                            title: "Outils disponibles",
                            select_all: "Tout sélectionner",
                            none: "Aucun outil disponible.",
                            apply: "Appliquer",
                            cancel: "Annuler"
                        }
                    }
                }
            },
            Ukrainisch: {
                translation: {
                    header: {
                        chat: "Чат",
                        nutzungsbedingungen: "Умови використання"
                    },
                    menu: {
                        chat_header: "Привіт {{user}}, що ти плануєш сьогодні?",
                        own_bots: "Локальні Асистенти", // Ukrainisch
                        community_bots: "Громадські Асистенти",
                        no_bots: "Асистентів не знайдено",
                        soon: "В розробці...",
                        owned: "Власні:",
                        subscribed: "Підписані:",
                        select: "Вибрати"
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
                        clear_chat: "Новий чат",
                        settings: "Налаштування",
                        close: "Закрити",
                        messages: "Повідомлення",
                        examples: "Приклади",
                        sidebar_show: "Показати бічну панель",
                        sidebar_hide: "Сховати бічну панель",
                        errors: {
                            config_not_loaded: "Не вдалося завантажити конфігурацію.",
                            failed_to_load_config: "Помилка завантаження конфігурації.",
                            configuration_error: "Помилка конфігурації"
                        }
                    },
                    create_bot: {
                        title: "Заголовок",
                        description: "Опис",
                        prompt: "Системний запит",
                        create: "Створити"
                    },
                    components: {
                        bot_chat: {
                            load_bot_failed: "Не вдалося завантажити бота",
                            bot_not_found: "Бота не знайдено",
                            load_bot_failed_message: "Сталася помилка під час завантаження бота",
                            load_chat_failed: "Не вдалося завантажити чат",
                            load_chat_failed_message: "Сталася помилка під час завантаження історії чату",

                            delete_bot_success: "Бота було видалено",
                            delete_bot_success_message: "Бота '{{title}}' було успішно видалено",
                            delete_bot_failed: "Не вдалося видалити бота",
                            delete_bot_failed_message: "Сталася помилка під час видалення бота",

                            update_bot_success: "Бота було оновлено",
                            update_bot_success_message: "Бота '{{title}}' було успішно оновлено",
                            update_bot_failed: "Не вдалося оновити бота",
                            update_bot_failed_message: "Сталася помилка під час оновлення бота"
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
                            tooltip: "Показати версію програми",
                            tooltip_with_commit: "Версія програми: {{version}}, Commit: {{commit}}",
                            label: "Версія:"
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
                        theme_selector: {
                            theme_light: "Світла тема",
                            theme_dark: "Темна тема",
                            change_theme: "Змінити тему"
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
                            error: "На жаль, діаграму не можна відобразити через помилки."
                        },
                        mindmap: {
                            download: "Завантажити",
                            reset: "Скинути вигляд",
                            source: "Вигляд даних",
                            mindmap: "Вигляд інтелектуальної карти"
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
                        botsettingsdrawer: {
                            delete: "Видалити асистента",
                            edit: "Редагувати асистента",
                            finish_edit: "Завершити редагування",
                            show_configutations: "Показати конфігурації",
                            close_configutations: "Закрити конфігурації",
                            "unpublish-button": "Скасувати публікацію",
                            "remove-assistant": "Видалити асистента",
                            publish: "Опублікувати",
                            unpublish: "Скасувати публікацію",
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
                            saved_in_browser: "Чати, збережені в браузері"
                        },
                        add_bot_button: {
                            add_bot: "Створи свого власного асистента"
                        },
                        create_bot_dialog: {
                            what_function: "Що має вміти ваш асистент?",
                            generating_prompt: "Генерація запиту...",
                            dismiss: "Скасувати",
                            create: "Створити",
                            prompt_title_desc: "Пропонований системний запит, заголовок та опис:",
                            back: "Назад",
                            save: "Зберегти",
                            describe: "Опишіть функцію...",
                            skip: "Пропустити",
                            bot_saved_success: "Асистента успішно збережено!",
                            bot_saved_message: 'Ваш асистент "{{title}}" був успішно створений і збережений.',
                            bot_creation_failed: "Асистента не вдалося створити",
                            save_config_failed: "Не вдалося зберегти конфігурацію асистента",
                            bot_save_failed: "Не вдалося зберегти асистента",
                            save_bot_failed: "Не вдалося зберегти конфігурацію асистента",
                            bot_generated_success: "Асистента успішно згенеровано!",
                            bot_generated_message: "Конфігурацію вашого асистента згенеровано. Тепер ви можете її переглянути та налаштувати.",
                            bot_generation_failed: "Не вдалося згенерувати конфігурацію асистента"
                        },
                        edit_bot_dialog: {
                            title: "Редагувати асистента",
                            bot_title: "Заголовок",
                            bot_description: "Опис",
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
                            bot_saved_description: "Асистент {{botName}} був успішно збережений.",
                            // Stepper step titles
                            step_title: "Заголовок",
                            step_description: "Опис",
                            step_system_prompt: "Системний запит",
                            step_tools: "Інструменти",
                            step_quick_prompts: "Швидкі запити",
                            step_examples: "Приклади",
                            step_advanced_settings: "Розширені налаштування",
                            // Navigation buttons
                            next: "Далі",
                            previous: "Назад",
                            // Close dialog
                            close_dialog_title: "Закрити діалог",
                            close_dialog_message: "Ви впевнені, що хочете закрити діалог? Всі незбережені зміни будуть втрачені.",
                            cancel: "Скасувати"
                        },
                        search_bot_button: {
                            search_bots: "Пошук асистентів"
                        },
                        community_bots: {
                            title: "Громадські Асистенти", // Ukrainisch
                            search: "Пошук асистентів",
                            filter_by_tag: "Фільтрувати за тегом",
                            save: "Зберегти асистента",
                            system_message: "Системний запит",
                            departments: "Авторизовані відділи",
                            departments_description: "Цей асистент авторизований для наступних організаційних підрозділів:",
                            department_single: "Відділ",
                            departments_plural: "Відділи",
                            public_access: "Публічний доступ",
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
                            subscribe_failed_default: "Під час підписки на асистента сталася помилка. Будь ласка, спробуйте ще раз."
                        },
                        toolsselector: {
                            title: "Доступні інструменти",
                            select_all: "Вибрати всі",
                            none: "Немає доступних інструментів.",
                            apply: "Застосувати",
                            cancel: "Скасувати"
                        }
                    }
                }
            }
        }
    });

export default i18n;
