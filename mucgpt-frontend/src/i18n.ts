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
                        sum: "Zusammenfassen",
                        chat: "Chat",
                        nutzungsbedingungen: "Nutzungsbedingungen",
                        create_bot: "Assistent erstellen"
                    },
                    menu: {
                        own_bots: "Lokale Assistenten",
                        community_bots: "Community Assistenten",
                        no_bots: "Keine Assistenten gefunden",
                        soon: "In Entwicklung..."
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
                    sum: {
                        header: "Lasse Text zusammenfassen oder probiere ein Beispiel",
                        prompt: "Diesen Text zusammenfassen oder ein PDF per Drag und Drop hochladen",
                        rolelabel: "Zusammenfassen für",
                        lengthlabel: "in",
                        answer_loading: "Fasse zusammen",
                        levelofdetail: "Umfang",
                        short: "Kurz",
                        medium: "Mittel",
                        long: "Lang"
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
                        sidebar_hide: "Sidebar ausblenden"
                    },
                    create_bot: {
                        title: "Titel",
                        description: "Beschreibung",
                        prompt: "System-Prompt",
                        create: "Erstellen"
                    },
                    components: {
                        roles: {
                            student: "Student*innen",
                            secondgrader: "Grundschüler*innen",
                            retired: "Rentner*innen"
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
                        settingsdrawer: {
                            settings_button: "Einstellungen und Feedback",
                            feedback_button: "Feedback/Fehler melden",
                            settings_button_close: "Einstellungen und Feedback schließen",
                            settings: "Einstellungen",
                            feedback: "Feedback",
                            about: "Über",
                            help: "Hilfe",
                            snow: "Schnee",
                            snow_checkbox: "Aktiviert",
                            language: "Sprache",
                            fontsize: "Schriftgröße",
                            change_font: "Schriftgröße anpassen",
                            theme: "Design",
                            change_theme: "Design wechseln",
                            theme_light: "Hell",
                            theme_dark: "Dunkel",
                            llm: "Sprachmodell",
                            chat_sidebar: "Chat Sidebar"
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
                            deleteDialog: {
                                title: "Bot Löschen",
                                content: "Wollen Sie den Bot wirklich löschen? Dies kann nicht rückgängig gemacht werden.",
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
                            skip: "Überspringen"
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
                            previous: "Zurück"
                        },
                        search_bot_button: {
                            search_bots: "Assistenten durchsuchen"
                        },
                        community_bots: {
                            title: "Community Assistenten", // Deutsch
                            search: "Assistenten durchsuchen",
                            filter_by_tag: "Nach Tag filtern",
                            save: "Assistent speichern",
                            system_message: "System-Prompt"
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
                        sum: "Summarize",
                        chat: "Chat",
                        nutzungsbedingungen: "Terms of use",
                        create_bot: "Create assistant"
                    },
                    menu: {
                        own_bots: "Local Assistants", // Englisch
                        community_bots: "Community Assistants",
                        no_bots: "No Assistants found",
                        soon: "In Development..."
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
                    sum: {
                        header: "Summarize text or try an example",
                        prompt: "Summarize this text or upload a PDF by using drag and drop",
                        rolelabel: "Summarize for",
                        lengthlabel: "in",
                        answer_loading: "Summarize",
                        levelofdetail: "Scope",
                        short: "Short",
                        medium: "Medium",
                        long: "Long"
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
                        sidebar_hide: "Hide sidebar"
                    },
                    create_bot: {
                        title: "Title",
                        description: "Description",
                        prompt: "System prompt",
                        create: "Create"
                    },
                    components: {
                        roles: {
                            student: "University Students",
                            secondgrader: "Second-Graders",
                            retired: "Pensioners"
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
                        settingsdrawer: {
                            settings_button: "Settings and feedback",
                            feedback_button: "Report Feedback/Fehler",
                            settings_button_close: "Close settings and feedback",
                            settings: "Settings",
                            feedback: "Feedback",
                            about: "About",
                            help: "Help",
                            snow: "Snow",
                            snow_checkbox: "Enabled",
                            language: "Language",
                            fontsize: "Font size",
                            change_font: "Adjust font size",
                            theme: "Theme",
                            change_theme: "Switch theme",
                            theme_light: "Light",
                            theme_dark: "Dark",
                            llm: "language model",
                            chat_sidebar: "Chat Sidebar"
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
                            deleteDialog: {
                                title: "Delete Bot",
                                content: "Are you sure you want to delete the bot? This action cannot be undone.",
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
                            skip: "Skip"
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
                            saved_successfully: "Successfully saved!",
                            // Stepper step titles
                            step_title: "Title",
                            step_description: "Description",
                            step_system_prompt: "System Prompt",
                            step_tools: "Tools",
                            step_quick_prompts: "Quick Prompts",
                            step_examples: "Examples",
                            step_advanced_settings: "Advanced Settings",
                            // Navigation buttons
                            next: "Next",
                            previous: "Previous"
                        },
                        search_bot_button: {
                            search_bots: "Search assistants"
                        },
                        community_bots: {
                            title: "Community Assistants", // Englisch
                            search: "Search assistants",
                            filter_by_tag: "Filter by tag",
                            save: "Save assistant",
                            system_message: "System prompt"
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
                        sum: "Zammfassn",
                        chat: "Redn",
                        nutzungsbedingungen: "Gebrauchsvorschriftn",
                        create_bot: "Assistenten erstoin"
                    },
                    menu: {
                        own_bots: "Lokale Assitentn", // Bairisch
                        community_bots: "Community Assistentn",
                        no_bots: "Koane Assitentn gfundn",
                        soon: "In Entwicklung..."
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
                    sum: {
                        header: "Fassn Text zam oda probier a Beispui",
                        prompt: "Diesn Text zammfassn oda a PDF per Drag und Drop hoachladn",
                        rolelabel: "Zammfassn für",
                        lengthlabel: "in",
                        answer_loading: "Am zammfassn",
                        levelofdetail: "Umfang",
                        short: "Kurz",
                        medium: "Mittel",
                        long: "Lang"
                    },
                    common: {
                        clear_chat: "Neia Chat",
                        settings: "Konfiguration",
                        close: "Schließen",
                        messages: "Nochrichten",
                        examples: "Beispui",
                        sidebar_show: "Sidebar zoagn",
                        sidebar_hide: "Sidebar ausblenden"
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
                        roles: {
                            student: "Studentn",
                            secondgrader: "Grundschüla",
                            retired: "Rentna"
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
                        settingsdrawer: {
                            settings_button: "Eistellunga und Rückmeldung",
                            settings_button_close: "Eistellunga und Rückmeldung zua macha",
                            feedback_button: "Ruckmeldung/Fehla meldn",
                            settings: "Eistellunga",
                            feedback: "Rückmeldung",
                            about: "Iba",
                            help: "Hilf(e)",
                            snow: "Schnee",
                            snow_checkbox: "Freigeschaltet",
                            language: "Sproch",
                            fontsize: "Schriftgrößn",
                            change_font: "Schriftgrößn o'passn",
                            theme: "Design",
                            change_theme: "Design wechseln",
                            theme_light: "Hell",
                            theme_dark: "Dunkel",
                            llm: "Sprachmodell",
                            chat_sidebar: "Chat Sidebar"
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
                            deleteDialog: {
                                title: "Bot Löschn",
                                content: "Wuißt du den Bot echt löschn? Des ko nimma rückgängig gmocht werdn.",
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
                            skip: "Übaspringa"
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
                            previous: "Zruck"
                        },
                        search_bot_button: {
                            search_bots: "Assistentn durchschaun"
                        },
                        community_bots: {
                            title: "Community Assistentn", // Bairisch
                            search: "Assistentn durchschaun",
                            filter_by_tag: "Noch Tag filtern",
                            save: "Assistent speichan",
                            system_message: "System-Prompt"
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
                        sum: "Résumer",
                        chat: "Chat",
                        nutzungsbedingungen: "Conditions d'utilisation"
                    },
                    menu: {
                        own_bots: "Assistants Locaux", // French
                        community_bots: "Assistants Communautaires",
                        no_bots: "Aucun Assistant trouvé",
                        soon: "En Développement..."
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
                    sum: {
                        header: "Faites résumer le texte ou essayez un exemple",
                        prompt: "Résumer ce texte ou faites glisser un PDF ici",
                        rolelabel: "Résumer pour",
                        lengthlabel: "en",
                        answer_loading: "Résumer",
                        levelofdetail: "Portée",
                        short: "Court",
                        medium: "Moyen",
                        long: "Long"
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
                        sidebar_hide: "Masquer la barre latérale"
                    },
                    create_bot: {
                        title: "Titre",
                        description: "Description",
                        prompt: "System prompt",
                        create: "Créer"
                    },
                    components: {
                        roles: {
                            student: "Étudiant·e·s",
                            secondgrader: "Élèves de primaire",
                            retired: "Retraité·e·s"
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
                        settingsdrawer: {
                            settings_button: "Paramètres et feedback",
                            feedback_button: "Retour/Signalement de bug",
                            settings_button_close: "Fermer les paramètres et le feedback",
                            settings: "Paramètres",
                            feedback: "Feedback",
                            about: "À propos",
                            help: "Aide",
                            snow: "Neige",
                            snow_checkbox: "Activé",
                            language: "Langue",
                            fontsize: "Taille de police",
                            change_font: "Ajuster la taille de police",
                            theme: "Thème",
                            change_theme: "Changer de thème",
                            theme_light: "Clair",
                            theme_dark: "Sombre",
                            llm: "Modèle de langage",
                            chat_sidebar: "Barre latérale de chat"
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
                            deleteDialog: {
                                title: "Supprimer le Bot",
                                content: "Êtes-vous sûr de vouloir supprimer le bot ? Cette action est irréversible.",
                                confirm: "Oui",
                                cancel: "Non"
                            }
                        },
                        answericon: {
                            label: "Message de MUCGPT"
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
                            skip: "Passer"
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
                            previous: "Précédent"
                        },
                        community_bots: {
                            title: "Assistants Communautaires", // French
                            search: "Rechercher des assistants",
                            filter_by_tag: "Filtrer par tag",
                            save: "Enregistrer l'assistant",
                            system_message: "Prompt système"
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
                        sum: "Резюме",
                        chat: "Чат",
                        nutzungsbedingungen: "Умови використання"
                    },
                    menu: {
                        own_bots: "Локальні Асистенти", // Ukrainisch
                        community_bots: "Громадські Асистенти",
                        no_bots: "Асистентів не знайдено",
                        soon: "В розробці..."
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
                    sum: {
                        header: "Зробіть резюме тексту або спробуйте приклад",
                        prompt: "Резюме цього тексту або завантажте PDF перетягуванням",
                        rolelabel: "Резюме для",
                        lengthlabel: "в",
                        answer_loading: "Резюме",
                        levelofdetail: "Обсяг",
                        short: "Короткий",
                        medium: "Середній",
                        long: "Довгий"
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
                        sidebar_hide: "Сховати бічну панель"
                    },
                    components: {
                        roles: {
                            student: "Студент(к)и",
                            secondgrader: "Учні початкової школи",
                            retired: "Пенсіонери"
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
                        settingsdrawer: {
                            settings_button: "Налаштування та зворотний зв'язок",
                            feedback_button: "Зворотній зв'язок/Повідомити про помилку",
                            settings_button_close: "Закрити налаштування та зворотний зв'язок",
                            settings: "Налаштування",
                            feedback: "Зворотний зв'язок",
                            about: "Про нас",
                            help: "Допомога",
                            snow: "Сніг",
                            snow_checkbox: "Активувати",
                            language: "Мова",
                            fontsize: "Розмір шрифту",
                            change_font: "Налаштувати розмір шрифту",
                            theme: "Тема",
                            change_theme: "Змінити тему",
                            theme_light: "Світла",
                            theme_dark: "Темна",
                            llm: "Мовна модель",
                            chat_sidebar: "Бічна панель чату"
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
                            deleteDialog: {
                                title: "Видалити Бота",
                                content: "Ви впевнені, що хочете видалити бота? Цю дію не можна скасувати.",
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
                            skip: "Пропустити"
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
                            previous: "Назад"
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
                            search_button: ""
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
