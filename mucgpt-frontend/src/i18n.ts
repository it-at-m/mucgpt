import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { tutorialsTranslations } from "./i18n.tutorials";
import { versionTranslations } from "./i18n.version";
import { faqTranslation } from "./i18n.faq";

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
                        nutzungsbedingungen: "Nutzungsbedingungen",
                        create_assistant: "Assistent erstellen",
                        go_to_tutorials_tooltip: "Tutorials und Anleitungen zu Fragments und Tools",
                        go_to_tutorials_aria: "Zu Tutorials und Anleitungen navigieren",
                        go_to_tutorials: "Tutorials"
                    },
                    home: {
                        assistants: "Assistenten",
                        last_used: "Zuletzt verwendet",
                        recommended: "Empfohlen",
                        chat_header: "Hallo {{user}}, was hast du heute vor?",
                        discover_all: "Alle Assistenten entdecken",
                        explore_badge: "Entdecken",
                        discover_all_description: "Entdecke und verwalte alle verfügbaren Assistenten.",
                        discover_assistants: "Assistenten entdecken",
                        no_assistants_yet: "Du hast noch keine Assistenten verwendet. Entdecke jetzt verfügbare Assistenten!",
                        no_assistants_available: "Keine Assistenten verfügbar.",
                        load_error: "Die Startseite konnte nicht geladen werden. Bitte versuchen Sie es erneut."
                    },
                    chat: {
                        header: "Stelle eine Frage oder probiere ein Beispiel",
                        prompt: "Stelle eine Frage oder lade ein Dokument hoch",
                        prompt_no_upload: "Stelle eine Frage",
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
                        organization_name: "Landeshauptstadt München, RIT/it@M KIES",
                        footer_credit: "Made with ❤️ & ☕ by",
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
                        create: "Erstellen",
                        back: "Zurück",
                        ok: "OK",
                        next: "Weiter",
                        loading: "Lade Konfiguration...",
                        hint: "Hinweis:",
                        edit: "Bearbeiten",
                        delete: "Löschen",
                        errors: {
                            config_not_loaded: "Konfiguration konnte nicht geladen werden.",
                            failed_to_load_config: "Fehler beim Laden der Konfiguration.",
                            configuration_error: "Konfigurationsfehler",
                            unauthorized_title: "Zugriff verweigert",
                            unauthorized_message: "Hallo {{name}}, Sie haben keine Berechtigung, auf diese Anwendung zuzugreifen.",
                            unauthorized_link_text: "Zugriff beantragen "
                        }
                    },
                    components: {
                        table_renderer: {
                            download_csv: "Als CSV herunterladen",
                            table_aria_label: "Datentabelle"
                        },
                        assistant_chat: {
                            actions: "Aktionen",

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
                            update_assistant_failed_message: "Beim Aktualisieren des Assistenten ist ein Fehler aufgetreten",

                            default_model_unavailable: "Standard-Modell nicht verfügbar",
                            default_model_unavailable_message:
                                "Das konfigurierte Standard-Modell '{{modelName}}' ist nicht mehr verfügbar. Bitte wählen Sie ein anderes Modell aus."
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
                            own_department_label: "(Ihre Abteilung)",
                            load_error: "Konnte Verzeichnis nicht laden",
                            collapse: "Einklappen",
                            expand: "Ausklappen",
                            me: "Ich",
                            loading: "Lädt...",
                            loading_short: "...",
                            clear_all: "Alle entfernen",
                            remove_department: "Abteilung {{name}} entfernen"
                        },
                        terms_of_use: {
                            tooltip: "Nutzungsbedingungen anzeigen",
                            label: "Nutzungsbedingungen",
                            accept: "Zustimmen"
                        },
                        versioninfo: {
                            label: "Version",
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
                            toolsselectorbutton_tooltip: "Werkzeuge auswählen",
                            tutorial_help: "Tutorial öffnen",
                            tool_header: "Zusätzliche Werkzeuge wählen:",
                            tutorial_help_aria: "Tutorial für {{tool}} öffnen",
                            send_question: "Frage senden",
                            add_tool: "Werkzeuge hinzufügen",
                            no_tools_active: "Keine Werkzeuge aktiv",
                            more_tools: "+{{count}} weitere",
                            enable_all: "Alle aktivieren",
                            disable_all: "Alle deaktivieren",
                            available_tools: "Verfügbare Werkzeuge",
                            remove_tool_aria: "{{tool}} entfernen",
                            assistant_tool_locked: "Für diesen Assistenten fest aktiviert",
                            assistant_tools_section: "Vom Assistenten vorgegeben",
                            optional_tools_section: "Weitere Werkzeuge",
                            upload_data: "Dokument hochladen",
                            uploaded_data_label: "Hinzugefügte Dokumente",
                            remove_data: "Dokument entfernen",
                            uploading: "Wird hochgeladen..."
                        },
                        contextmanagerdialog: {
                            title: "Meine Dokumente",
                            subtitle: "Ausgewählte Dokumente werden im Chat als Kontext verwendet.",
                            uploading: "Wird hochgeladen...",
                            upload_btn: "Hochladen",
                            select_label: "Dateien auswählen",
                            no_saved: "Noch keine gespeicherten Dokumente.",
                            use: "Verwenden",
                            remove_saved: "Dokument entfernen",
                            parsed_at: "Verarbeitet am",
                            clear_saved: "Alle löschen",
                            download: "Text herunterladen",
                            selection_count: "Im Chat verwendet: {{selected}} von {{total}}",
                            storage_error: "Dokument konnte nicht gespeichert werden (Speicherplatz voll).",
                            upload_success_title: "Upload erfolgreich",
                            upload_success_one: "1 Dokument wurde hochgeladen.",
                            upload_success_other: "{{count}} Dokumente wurden hochgeladen.",
                            upload_error_title: "Upload fehlgeschlagen",
                            upload_error_one: "1 Dokument konnte nicht hochgeladen werden.",
                            upload_error_other: "{{count}} Dokumente konnten nicht hochgeladen werden.",
                            storage_error_title: "Speichern fehlgeschlagen",
                            storage_error_one: "1 Dokument konnte nicht lokal gespeichert werden.",
                            storage_error_other: "{{count}} Dokumente konnten nicht lokal gespeichert werden."
                        },
                        suminput: {
                            tokensused: "Token verbraucht",
                            limit: ". Ältere Eingaben werden bei der Generierung nicht berücksichtigt!",
                            removedocument: "Dokument löschen"
                        },
                        chattsettingsdrawer: {
                            title: "Chat Einstellungen",
                            creativity: "Kreativität",
                            creativity_low: "Niedrig",
                            creativity_medium: "Normal",
                            creativity_high: "Hoch",
                            creativity_low_description: "Konzentriert sich auf Genauigkeit und sachliche Antworten",
                            creativity_medium_description: "Hält einen neutralen und informativen Ton bei",
                            creativity_high_description: "Fördert besonders kreative und vielfältige Antworten",
                            creativity_info: `bestimmt, wie kreativ oder vorhersehbar die Antworten des Sprachmodells sind. "low" liefert konservative und genaue Antworten, "Normal" ist ausgewogen, und "Hoch" führt zu kreativeren und unvorhersehbareren Antworten.`,
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
                            show_configurations: "Konfigurationen anzeigen",
                            close_configurations: "Konfigurationen schließen",
                            "unpublish-button": "Veröffentlichung aufheben",
                            "remove-assistant": "Assistent entfernen",
                            publish: "Veröffentlichen",
                            unpublish: "Nicht mehr veröffentlichen",
                            export: "Exportieren",
                            export_failed: "Der Assistent konnte nicht exportiert werden",
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
                            add_assistant: "Neu erstellen"
                        },
                        import_assistant: {
                            import: "Importieren",
                            import_success: "Import erfolgreich",
                            import_success_message: 'Der Assistent "{{title}}" wurde importiert und kann nun verwendet werden.',
                            import_error: "Import fehlgeschlagen",
                            import_failed: "Die Datei konnte nicht importiert werden",
                            import_invalid_format: "Ungültiges Dateiformat. Die Datei muss einen Titel und System-Prompt enthalten.",
                            import_save_failed: "Fehler beim Speichern des importierten Assistenten"
                        },
                        assistant_editor: {
                            // Page titles (differ between create and edit)
                            create_title: "Assistent erstellen",
                            edit_title: "Assistent bearbeiten",

                            // Create-only: Mode selector
                            subtitle_mode_select: "Wähle, wie du starten möchtest",
                            create_manually: "Manuell erstellen",
                            create_manually_description: "Starte von Grund auf. Definiere Werkzeuge, Verhalten und Prompts selbst.",
                            create_manually_hint: "Für volle Kontrolle von Anfang an",
                            generate_with_mucgpt: "Mit MUCGPT generieren",
                            generate_with_mucgpt_description: "Beschreibe deine Anforderungen und lass MUCGPT die Konfiguration generieren.",
                            generate_with_mucgpt_hint: "Für einen schnellen ersten Entwurf",
                            recommended: "Empfohlen",

                            // Create-only: AI description input
                            subtitle_ai_input: "Beschreibe deinen Assistenten und erstelle einen ersten Entwurf",
                            ai_input_label: "Was soll dein Assistent tun?",
                            ai_input_placeholder: "Zum Beispiel: Der Assistent übersetzt den eingegebenen Text ins Englische.",
                            try_example: "BEISPIEL AUSPROBIEREN:",
                            generate_button: "Assistent generieren",
                            generating: "Generiere...",
                            description_required: "Bitte geben Sie eine Beschreibung ein, damit MUCGPT den Assistenten generieren kann",
                            example_one: "Sprache übersetzen",
                            example_two: "Email schreiben",
                            example_three: "Synonyme finden",
                            create_example_one: "Englisch Übersetzer: Der Assistent übersetzt den eingegebenen Text ins Englische.",
                            create_example_two:
                                "Der Assistent ist ein Mitarbeiter der Stadt München und antwortet höflich sowie individuell auf die eingehenden E-Mails.",
                            create_example_three:
                                "Der Assistent erstellt für das eingegebene Wort oder den eingegebenen Satz zehn verschiedene Umformulierungen oder Synonyme.",

                            // Shared field labels
                            title: "Titel",
                            title_placeholder: "Zum Beispiel: Englisch Übersetzer",
                            description: "Beschreibung",
                            description_placeholder: "Zum Beispiel: Der Assistent übersetzt den eingegebenen Text ins Englische.",
                            default_assistant_title: "Assistent",
                            default_assistant_description: "Assistent",
                            system_prompt: "System-Prompt",
                            prompt_placeholder:
                                "# Anforderung\n# Schritte\n# Output Format\n# Beispiele\n\nZum Beispiel:\nStelle sicher, dass die Übersetzung den ursprünglichen Satzbau und die Bedeutung beibehält. Achte auf kontextabhängige Wörter und kulturelle Unterschiede die möglicherweise vorliegen könnten.",

                            // Settings section headers
                            section_basic: "Grundlegende Informationen",
                            section_behaviour: "Verhalten & Konfiguration",
                            section_tools: "Werkzeuge",
                            section_prompts: "Prompts & Beispiele",
                            section_access: "Zugriff & Sichtbarkeit",

                            // Advanced settings fields
                            creativity: "Kreativität",
                            creativity_placeholder: "Wählen Sie eine Kreativitätsstufe...",
                            creativity_low: "Aus (konservativ)",
                            creativity_medium: "Normal (ausgewogen)",
                            creativity_high: "Hoch (kreativ)",
                            default_model: "Standard-Modell",
                            default_model_info:
                                "Das Standard-Modell, das für diesen Assistenten verwendet wird. Wenn kein Modell ausgewählt ist, wird das Benutzer-ausgewählte Modell verwendet.",
                            default_model_placeholder: "Wählen Sie ein Standard-Modell...",
                            no_default_model: "Kein Standard-Modell (Benutzer wählt)",
                            departments: "Abteilungen",
                            departments_info:
                                "Dies sind die Abteilungen, die Zugriff auf den Assistenten haben. Alle Abteilungen in der Hierarchie unter den ausgewählten Abteilungen haben ebenfalls Zugriff.",

                            // Quick prompts
                            quick_prompts: "Vorgeschlagene Antworten",
                            quick_prompts_placeholder: "Fügen Sie Vorgeschlagene Antworten hinzu, eine pro Zeile (Label|Prompt)",
                            quick_prompt_label_placeholder: "Geben Sie das Label ein...",
                            quick_prompt_text_placeholder: "Geben Sie den Prompt-Text ein...",
                            add_quick_prompt: "Vorgeschlagene Antwort hinzufügen",
                            no_quick_prompts_selected: "Keine vorgeschlagenen Antworten hinzugefügt",

                            // Examples
                            examples: "Beispiele",
                            examples_placeholder: "Fügen Sie Beispiele hinzu, eine pro Zeile (Text|Wert)",
                            example_text_placeholder: "Geben Sie den Beispiel-Text ein...",
                            example_value_placeholder: "Geben Sie den Beispiel-Wert ein...",
                            add_example: "Beispiel hinzufügen",
                            no_examples_selected: "Keine Beispiele hinzugefügt",

                            // Tools
                            select_tools: "Werkzeuge auswählen",
                            no_tools_selected: "Keine Werkzeuge ausgewählt",

                            // DnD / list controls
                            dnd_reorder_hint: "Ziehen Sie die Elemente am Griff, um die Reihenfolge zu ändern.",
                            drag_to_reorder: "Ziehen zum Neu-Anordnen",
                            dnd_aria_label: "Element {{position}} von {{total}} neu anordnen",
                            move_up: "Nach oben",
                            move_down: "Nach unten",
                            remove: "Entfernen",

                            // Save feedback
                            save: "Speichern",
                            saved_successfully: "Erfolgreich gespeichert!",
                            assistant_saved_description: "Der Assistent {{assistantName}} wurde erfolgreich gespeichert.",
                            assistant_saved_success: "Assistent erfolgreich gespeichert!",
                            assistant_saved_message: 'Ihr Assistent "{{title}}" wurde erfolgreich erstellt und gespeichert.',

                            // Error messages
                            assistant_creation_failed: "Assistent konnte nicht erstellt werden",
                            save_config_failed: "Speichern der Assistenten-Konfiguration fehlgeschlagen",
                            assistant_save_failed: "Speichern des Assistenten fehlgeschlagen",
                            assistant_generated_success: "Assistent erfolgreich generiert!",
                            assistant_generated_message: "Die Konfiguration Ihres Assistenten wurde generiert. Sie können sie jetzt überprüfen und anpassen.",
                            assistant_generation_failed: "Generierung der Assistenten-Konfiguration fehlgeschlagen",

                            // Discard confirmation
                            discard_title: "Änderungen verwerfen?",
                            discard_message: "Sie haben ungespeicherte Änderungen. Möchten Sie wirklich abbrechen?"
                        },
                        expandable_textarea: {
                            default_title: "Bearbeiten"
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
                            no_departments_selected:
                                "Keine Abteilungen ausgewählt – die Veröffentlichung wird verhindert, bis mindestens eine Abteilung ausgewählt wurde.",
                            cancel: "Abbrechen",
                            confirm: "Bestätigen",
                            publishing: "Veröffentliche...",
                            done: "Fertig",
                            publish_assistant_success: "Assistent erfolgreich veröffentlicht",
                            publish_assistant_success_message: "Der Assistent '{{title}}' wurde erfolgreich veröffentlicht"
                        },
                        search_assistant_button: {
                            search_assistants: "Assistenten suchen"
                        },
                        community_assistants: {
                            title: "Community Assistenten",
                            about: "Über", // Deutsch
                            search: "Assistenten suchen",
                            filter_by_tag: "Nach Tag filtern",
                            filter_all: "Community",
                            filter_yours: "Eigene",
                            filter_subscribed: "Abonniert",
                            system_prompt: "System-Prompt",
                            enabled_tools: "Aktivierte Werkzeuge",
                            start_chat: "Chat starten",
                            sort_by: "Sortieren nach",
                            sort_title: "Titel",
                            sort_updated: "Zuletzt aktualisiert",
                            sort_subscriptions: "Abonnements",
                            sort_by_tooltip: "Sortierung der Assistenten ändern",
                            save: "Assistent speichern",

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
                            subscribed_assistant: "Abonniert",
                            more_options: "Weitere Optionen",
                            duplicate: "Private Kopie erstellen",
                            duplicate_confirm_title: "Eigene private Kopie erstellen",
                            duplicate_confirm_message:
                                'Du kannst "{{title}}" auch ohne eigene Kopie weiter verwenden. Möchtest du trotzdem eine eigene Kopie erstellen? Spätere Änderungen des ursprünglichen Assistenten werden nicht auf deine Kopie übernommen.',
                            duplicate_confirm_message_deleted:
                                'Der ursprüngliche Assistent "{{title}}" ist nicht mehr verfügbar. Wenn du weiter damit arbeiten möchtest, kannst du jetzt eine eigene Kopie aus der zuletzt gespeicherten Version erstellen.',
                            duplicate_confirm_action: "Kopie erstellen",
                            duplicate_title_suffix: "[Kopie]",
                            duplicate_success_title: "Assistent dupliziert",
                            duplicate_success_message: 'Der Assistent "{{title}}" wurde erfolgreich dupliziert.',
                            duplicate_failed_title: "Assistent konnte nicht dupliziert werden",
                            duplicate_failed_default: "Beim Duplizieren des Assistenten ist ein Fehler aufgetreten.",
                            duplicate_failed_rate_limited: "Zu viele Anfragen. Bitte versuchen Sie es später erneut.",
                            duplicate_failed_forbidden: "Sie haben keine Berechtigung, diesen Assistenten zu duplizieren.",
                            duplicate_failed_not_found: "Der Assistent wurde nicht gefunden und kann nicht dupliziert werden.",
                            local_badge: "Veraltet - Lokal",
                            local_state_title: "Dieser lokale Assistent ist veraltet",
                            discovery_local_hint:
                                "Dieser Assistent ist nur lokal in Ihrem Browser gesichert und geht verloren, falls Sie das Gerät wechseln. Sichern Sie ihn jetzt, damit er dauerhaft erhalten bleibt.",
                            local_chat_warning:
                                "Dieser Assistent ist nur lokal in Ihrem Browser gesichert und geht verloren, falls Sie das Gerät wechseln. Sichern Sie ihn jetzt, damit er dauerhaft erhalten bleibt.",
                            local_state_publish_action: "Sichern",
                            local_migration_confirm_title: "Assistent sichern?",
                            local_migration_confirm_message:
                                "Wir sichern diesen Assistenten, damit er dauerhaft erhalten bleibt. Wenn Sie ihn später mit anderen teilen möchten, können Sie das jederzeit in den Einstellungen ändern.",
                            local_migration_confirm_action: "Sichern",
                            local_migration_success_title: "Assistent gesichert",
                            local_migration_success_message: 'Der Assistent "{{title}}" wurde gesichert.',
                            local_migration_failed_title: "Assistent konnte nicht gesichert werden",
                            local_migration_failed_default: "Beim Sichern des Assistenten ist ein Fehler aufgetreten.",
                            deleted_badge: "Gelöscht",
                            deleted_state_title: "Dieser Community-Assistent ist nicht mehr verfügbar",
                            deleted_state_body:
                                "Der ursprüngliche Assistent ist nicht mehr verfügbar und wird nicht mehr unterstützt. Sie können ihn nicht weiter direkt verwenden.",
                            deleted_state_body_continue:
                                "Wenn Sie mit dieser Konfiguration weiterarbeiten möchten, speichern Sie sie als eigenen Assistenten. Frühere Chats können Sie weiterhin nur lesend ansehen.",
                            discovery_deleted_hint:
                                "Dieser Community-Assistent wurde vom Ersteller gelöscht. Er ist nicht mehr verfügbar. Die letzte Version liegt nur noch lokal im Browser und kann verloren gehen. Sichern Sie sie jetzt als eigenen Assistenten oder sehen Sie nur den alten Chatverlauf an.",
                            deleted_chat_warning:
                                "Dieser Community-Assistent wurde vom Ersteller gelöscht und ist nicht mehr verfügbar. Diese Version liegt nur noch lokal im Browser und kann verloren gehen. Der Chatverlauf ist schreibgeschützt. Sichern Sie sie als eigenen Assistenten, wenn Sie weiter damit arbeiten möchten.",
                            deleted_state_save_action: "Als eigenen Assistenten speichern",
                            deleted_state_history_action: "Alten Chatverlauf ansehen",
                            deleted_state_no_history: "Für diesen Assistenten ist kein lokaler Chatverlauf verfügbar."
                        },
                        toolsselector: {
                            title: "Verfügbare Werkzeuge",
                            select_all: "Alle auswählen",
                            none: "Keine Werkzeuge verfügbar.",
                            apply: "Übernehmen",
                            cancel: "Abbrechen"
                        },
                        globaltoasthandler: {
                            dismiss_aria_label: "Toast schließen"
                        },
                        llmSelector: {
                            title: "Sprachmodell Auswahl",
                            bestFor: "Ideal für:",
                            knowledge: "Wissensstand:",
                            knowledge_description:
                                "Datum der letzten Informationen, mit denen das Modell trainiert wurde. Es kann über nichts bescheid wissen, was neuer ist.",
                            notAvailable: "Nicht verfügbar",
                            capability_reasoning: "Reasoning",
                            capability_functionCalling: "Function Calling",
                            capability_vision: "Vision",
                            provider: "Anbieter:",
                            region: "Region:",
                            location: "Standort:",
                            features: "Funktionen:",
                            features_description: "Funktionalitäten, die das Sprachmodell mitbringt.",
                            context: "Kontext",
                            origin: "Herkunft",
                            token: "Token",
                            tokens: "Tokens",
                            maxInput: "Max. Eingabelänge:",
                            maxInput_description:
                                "Die Maximale Anzahl an Tokens die das Sprachmodel als Eingabe verarbeiten kann. Ein Token ist ein Wortbestandteil. Im Deutschen ist ein Wort ca 1,3 Token. Als Eingabe gelten alle Nachrichten im Chat.",
                            maxOutput: "Max. Ausgabelänge:",
                            maxOutput_description:
                                "Die Maximale Anzahl an Tokens die das Sprachmodel mit einer Antwort generieren kann. Ein Token ist ein Wortbestandteil. Im Deutschen ist ein Wort ca 1,3 Token.",
                            inputPrice: "Eingabe Preis:",
                            inputPrice__description:
                                "Preis pro 1 Millionen Eingabetoken. Ein Token ist ein Wortbestandteil. Im Deutschen ist ein Wort ca 1,3 Token. Als Eingabe gelten alle Nachrichten im Chat.",
                            outputPrice: "Ausgabe Preis:",
                            outputPrice_description:
                                "Preis pro eine Milionen Ausgabetoken.  Ein Token ist ein Wortbestandteil. Im Deutschen ist ein Wort ca 1,3 Token. Als Ausgabe gilt eine Nachricht, die generiert wird.",
                            price: "Preis",
                            selectButton: "Auswählen"
                        }
                    },
                    discovery: {
                        title: "Assistenten entdecken",
                        subtitle: "Optimiere deinen Workflow mit spezialisierten KI-Agenten."
                    },
                    ...tutorialsTranslations.DE,
                    ...versionTranslations.DE,
                    ...faqTranslation.DE
                }
            },
            EN: {
                translation: {
                    header: {
                        nutzungsbedingungen: "Terms of use",
                        create_assistant: "Create assistant",
                        go_to_tutorials_tooltip: "Tutorials and guides for fragments and tools",
                        go_to_tutorials_aria: "Go to tutorials and guides",
                        go_to_tutorials: "Tutorials"
                    },
                    home: {
                        assistants: "Assistants",
                        last_used: "Last used",
                        recommended: "Recommended",
                        chat_header: "Hello {{user}}, what are you planning today?",
                        discover_all: "Discover all assistants",
                        explore_badge: "Discover",
                        discover_all_description: "Discover and manage all available assistants.",
                        discover_assistants: "Discover Assistants",
                        no_assistants_yet: "You haven't used any assistants yet. Discover available assistants now!",
                        no_assistants_available: "No assistants available.",
                        load_error: "The home page could not be loaded. Please try again."
                    },
                    chat: {
                        header: "Ask a question or try an example",
                        prompt: "Ask a question or upload a document",
                        prompt_no_upload: "Ask a question",
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
                        organization_name: "City of Munich, RIT/it@M KIES",
                        footer_credit: "Made with ❤️ & ☕ by",
                        user_settings: "User settings",
                        main_content: "Main content",
                        footer_info: "Footer information",
                        clear_chat: "New chat",
                        settings: "Settings",
                        messages: "Messages",
                        examples: "Examples",
                        sidebar_show: "Show sidebar",
                        sidebar_hide: "Hide sidebar",
                        cancel: "Cancel",
                        close: "Close",
                        create: "Create",
                        back: "Back",
                        ok: "OK",
                        next: "Next",
                        loading: "Loading...",
                        hint: "Hint:",
                        edit: "Edit",
                        delete: "Delete",
                        errors: {
                            config_not_loaded: "Configuration could not be loaded.",
                            failed_to_load_config: "Failed to load configuration.",
                            configuration_error: "Configuration error",
                            unauthorized_title: "Access Denied",
                            unauthorized_message: "Hello {{name}}, you do not have permission to access this application.",
                            unauthorized_link_text: "Get permission"
                        }
                    },
                    components: {
                        table_renderer: {
                            download_csv: "Download as CSV",
                            table_aria_label: "Data table"
                        },
                        assistant_chat: {
                            actions: "Actions",

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
                            update_assistant_failed_message: "An error occurred while updating the assistant",

                            default_model_unavailable: "Default model unavailable",
                            default_model_unavailable_message:
                                "The configured default model '{{modelName}}' is no longer available. Please select a different model."
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
                            own_department_label: "(Your department)",
                            load_error: "Could not load directory",
                            collapse: "Collapse",
                            expand: "Expand",
                            me: "Me",
                            loading: "Loading...",
                            loading_short: "...",
                            clear_all: "Clear all",
                            remove_department: "Remove department {{name}}"
                        },
                        terms_of_use: {
                            tooltip: "Show terms of use",
                            label: "Terms of use",
                            accept: "Accept"
                        },
                        versioninfo: {
                            label: "Version",
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
                            toolsselectorbutton_tooltip: "Select tools",
                            tutorial_help: "Open tutorial",
                            tool_header: "Choose additional tools:",
                            tutorial_help_aria: "Open Tutorial for Werkzeug {{tool}} ",
                            send_question: "Send question",
                            add_tool: "Add tools",
                            no_tools_active: "No tools active",
                            more_tools: "+{{count}} more",
                            enable_all: "Enable all",
                            disable_all: "Disable all",
                            available_tools: "Available Tools",
                            remove_tool_aria: "Remove {{tool}}",
                            assistant_tool_locked: "Required by this assistant",
                            assistant_tools_section: "Provided by the assistant",
                            optional_tools_section: "Additional tools",
                            upload_data: "Upload document",
                            uploaded_data_label: "Attached documents",
                            remove_data: "Remove document",
                            uploading: "Uploading..."
                        },
                        contextmanagerdialog: {
                            title: "My Documents",
                            subtitle: "Selected documents will be used as context in the chat.",
                            uploading: "Uploading...",
                            upload_btn: "Upload",
                            select_label: "Choose files",
                            no_saved: "No saved documents yet.",
                            use: "Use",
                            remove_saved: "Remove document",
                            parsed_at: "Processed on",
                            clear_saved: "Clear all",
                            download: "Download text",
                            selection_count: "Used in chat: {{selected}} of {{total}}",
                            storage_error: "Document could not be saved (storage full).",
                            upload_success_title: "Upload successful",
                            upload_success_one: "1 document was uploaded.",
                            upload_success_other: "{{count}} documents were uploaded.",
                            upload_error_title: "Upload failed",
                            upload_error_one: "1 document could not be uploaded.",
                            upload_error_other: "{{count}} documents could not be uploaded.",
                            storage_error_title: "Saving failed",
                            storage_error_one: "1 document could not be saved locally.",
                            storage_error_other: "{{count}} documents could not be saved locally."
                        },
                        suminput: {
                            tokensused: "Token used",
                            limit: ". Previous inputs are not considered during generation!",
                            removedocument: "Delete document"
                        },
                        chattsettingsdrawer: {
                            title: "Chat Settings",
                            creativity: "Creativity",
                            creativity_low: "Low",
                            creativity_medium: "Normal",
                            creativity_high: "High",
                            creativity_low_description: "Focuses on accuracy and factual responses",
                            creativity_medium_description: "Maintains a neutral and informative tone",
                            creativity_high_description: "Encourages highly creative and diverse responses",
                            creativity_info: `determines how creative or predictable the language model's responses are. "Low" provides conservative and precise answers, "Normal" is balanced, and "High" leads to more creative and unpredictable responses.`,
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
                            show_configurations: "Show configurations",
                            close_configurations: "Close configurations",
                            "unpublish-button": "Unpublish",
                            "remove-assistant": "Remove Assistant",
                            publish: "Publish",
                            unpublish: "Unpublish",
                            export: "Export",
                            export_failed: "Assistant could not be exported",
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
                            add_assistant: "Create New"
                        },
                        import_assistant: {
                            import: "Import",
                            import_success: "Import successful",
                            import_success_message: 'The assistant "{{title}}" has been imported and is ready to use.',
                            import_error: "Import failed",
                            import_failed: "The file could not be imported",
                            import_invalid_format: "Invalid file format. The file must contain a title and system prompt.",
                            import_save_failed: "Error saving imported assistant"
                        },
                        assistant_editor: {
                            // Page titles (differ between create and edit)
                            create_title: "Create Assistant",
                            edit_title: "Edit Assistant",

                            // Create-only: Mode selector
                            subtitle_mode_select: "Choose how you want to start",
                            create_manually: "Create Manually",
                            create_manually_description: "Start from scratch. Define tools, behavior and prompts yourself.",
                            create_manually_hint: "For full control from the beginning",
                            generate_with_mucgpt: "Generate with MUCGPT",
                            generate_with_mucgpt_description: "Describe your requirements and let MUCGPT generate the configuration.",
                            generate_with_mucgpt_hint: "For a quick first draft",
                            recommended: "Recommended",

                            // Create-only: AI description input
                            subtitle_ai_input: "Describe your assistant and create a first draft",
                            ai_input_label: "What should your assistant do?",
                            ai_input_placeholder: "For example: The assistant translates the entered text into English.",
                            try_example: "TRY AN EXAMPLE:",
                            generate_button: "Generate Assistant",
                            generating: "Generating...",
                            description_required: "Please enter a description so MUCGPT can generate the assistant",
                            example_one: "Example 1: Translator",
                            example_two: "Example 2: Email",
                            example_three: "Example 3: Synonyms",
                            create_example_one: "English translator: The assistant translates the text entered into English.",
                            create_example_two: "The assistant is an employee of the City of Munich and responds politely and individually to incoming emails.",
                            create_example_three: "The assistant creates ten different rephrasings or synonyms for the word or sentence entered.",

                            // Shared field labels
                            title: "Title",
                            title_placeholder: "For example: English Translator",
                            description: "Description",
                            description_placeholder: "For example: The assistant translates the entered text into English.",
                            default_assistant_title: "Assistant",
                            default_assistant_description: "Assistant",
                            system_prompt: "System Prompt",
                            prompt_placeholder:
                                "# Requirement\n# Steps\n# Output Format\n# Examples\n\nFor example:\nEnsure that the translation maintains the original sentence structure and meaning. Pay attention to context-dependent words and cultural differences that may exist.",

                            // Settings section headers
                            section_basic: "Basic Information",
                            section_behaviour: "Behaviour & Configuration",
                            section_tools: "Tools",
                            section_prompts: "Prompts & Examples",
                            section_access: "Access & Visibility",

                            // Advanced settings fields
                            creativity: "Creativity",
                            creativity_placeholder: "Select a creativity level...",
                            creativity_low: "Off (conservative)",
                            creativity_medium: "Normal (balanced)",
                            creativity_high: "High (creative)",
                            default_model: "Default Model",
                            default_model_info: "The default model to use for this assistant. If no model is selected, the user-selected model will be used.",
                            default_model_placeholder: "Select a default model...",
                            no_default_model: "No default model (user chooses)",
                            departments: "Departments",
                            departments_info:
                                "These are the departments that have access to the assistant. All departments in the hierarchy below the selected departments also have access.",

                            // Quick prompts
                            quick_prompts: "Quick Prompts",
                            quick_prompts_placeholder: "Add quick prompts, one per line (label|prompt)",
                            quick_prompt_label_placeholder: "Enter the label...",
                            quick_prompt_text_placeholder: "Enter the prompt text...",
                            add_quick_prompt: "Add Quick Prompt",
                            no_quick_prompts_selected: "No quick prompts added",

                            // Examples
                            examples: "Examples",
                            examples_placeholder: "Add examples, one per line (text|value)",
                            example_text_placeholder: "Enter the example text...",
                            example_value_placeholder: "Enter the example value...",
                            add_example: "Add Example",
                            no_examples_selected: "No examples added",

                            // Tools
                            select_tools: "Select Tools",
                            no_tools_selected: "No tools selected",

                            // DnD / list controls
                            dnd_reorder_hint: "Drag items by the handle to change their order.",
                            drag_to_reorder: "Drag to reorder",
                            dnd_aria_label: "Reorder item {{position}} of {{total}}",
                            move_up: "Move up",
                            move_down: "Move down",
                            remove: "Remove",

                            // Save feedback
                            save: "Save",
                            saved_successfully: "Successfully saved!",
                            assistant_saved_description: "The assistant {{assistantName}} has been successfully saved.",
                            assistant_saved_success: "Assistant saved successfully!",
                            assistant_saved_message: 'Your assistant "{{title}}" has been created and saved.',

                            // Error messages
                            assistant_creation_failed: "Assistant could not be created",
                            save_config_failed: "Failed to save assistant configuration",
                            assistant_save_failed: "Failed to save assistant",
                            assistant_generated_success: "Assistant generated successfully!",
                            assistant_generated_message: "Your assistant configuration has been generated. You can now review and customize it.",
                            assistant_generation_failed: "Failed to generate assistant configuration",

                            // Discard confirmation
                            discard_title: "Discard changes?",
                            discard_message: "You have unsaved changes. Are you sure you want to cancel?"
                        },
                        expandable_textarea: {
                            default_title: "Edit"
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
                            no_departments_selected: "No departments selected — publishing will be prevented until at least one department is chosen.",
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
                            title: "Community Assistants",
                            about: "About", // Englisch
                            search: "Search assistants",
                            filter_by_tag: "Filter by tag",
                            filter_all: "Community",
                            filter_yours: "Yours",
                            filter_subscribed: "Subscribed",
                            system_prompt: "System prompt",
                            enabled_tools: "Enabled tools",
                            start_chat: "Start conversation",
                            sort_by: "Sort by",
                            sort_title: "Title",
                            sort_updated: "Last updated",
                            sort_subscriptions: "Subscriptions",
                            sort_by_tooltip: "Change sorting of assistants",
                            save: "Save assistant",

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
                            subscribed_assistant: "Subscribed",
                            more_options: "More options",
                            duplicate: "Create private copy",
                            duplicate_confirm_title: "Create your own private copy",
                            duplicate_confirm_message:
                                'You can keep using "{{title}}" without creating your own copy. Do you still want to create one? Future changes to the original assistant will not be applied to your copy.',
                            duplicate_confirm_message_deleted:
                                'The original assistant "{{title}}" is no longer available. If you want to keep using it, you can create your own copy now from the last cached version.',
                            duplicate_confirm_action: "Create copy",
                            duplicate_title_suffix: "[Copy]",
                            duplicate_success_title: "Assistant duplicated",
                            duplicate_success_message: 'The assistant "{{title}}" was duplicated successfully.',
                            duplicate_failed_title: "Assistant could not be duplicated",
                            duplicate_failed_default: "An error occurred while duplicating the assistant.",
                            duplicate_failed_rate_limited: "Too many requests. Please try again later.",
                            duplicate_failed_forbidden: "You do not have permission to duplicate this assistant.",
                            duplicate_failed_not_found: "The assistant was not found and cannot be duplicated.",
                            local_badge: "Deprecated - Local",
                            local_state_title: "This local assistant is deprecated",
                            discovery_local_hint:
                                "This assistant is only saved locally in your browser and will be lost if you switch devices. Save it now so it remains available.",
                            local_chat_warning:
                                "This assistant is only saved locally in your browser and will be lost if you switch devices. Save it now so it remains available.",
                            local_state_publish_action: "Save",
                            local_migration_confirm_title: "Save assistant?",
                            local_migration_confirm_message:
                                "We will save this assistant so it remains available. If you want to share it with others later, you can change that at any time in the assistant settings.",
                            local_migration_confirm_action: "Save",
                            local_migration_success_title: "Assistant saved",
                            local_migration_success_message: 'The assistant "{{title}}" was saved.',
                            local_migration_failed_title: "Assistant could not be saved",
                            local_migration_failed_default: "An error occurred while saving the assistant.",
                            deleted_badge: "Deleted",
                            deleted_state_title: "This community assistant is no longer available",
                            deleted_state_body: "The original assistant is no longer available or supported. You can no longer continue using it directly.",
                            deleted_state_body_continue:
                                "If you want to keep using this setup, save it as your own assistant. You can still inspect previous chats in read-only mode.",
                            discovery_deleted_hint:
                                "This community assistant was deleted by its creator and is no longer available. The last version only exists locally in this browser and may be lost. Save it now as your own assistant, or only view the old chat history.",
                            deleted_chat_warning:
                                "This community assistant was deleted by its creator and is no longer available. This version only exists locally in this browser and may be lost. The chat history is read-only. Save it as your own assistant if you want to keep using it.",
                            deleted_state_save_action: "Save as own assistant",
                            deleted_state_history_action: "View old chat history",
                            deleted_state_no_history: "No local chat history is available for this assistant."
                        },
                        toolsselector: {
                            title: "Available tools",
                            select_all: "Select all",
                            none: "No tools available.",
                            apply: "Apply",
                            cancel: "Cancel"
                        },
                        globaltoasthandler: {
                            dismiss_aria_label: "Dismiss toast"
                        },
                        llmSelector: {
                            title: "Language Model Selection",
                            bestFor: "Ideal for:",
                            knowledge: "Knowledge Level:",
                            knowledge_description: "Date of the last information the model was trained on. It may not be aware of anything newer.",
                            notAvailable: "Not available",
                            capability_reasoning: "Reasoning",
                            capability_functionCalling: "Function Calling",
                            capability_vision: "Vision",
                            provider: "Provider:",
                            region: "Region:",
                            location: "Location:",
                            features: "Features:",
                            features_description: "Functionalities that the language model offers.",
                            context: "Context",
                            origin: "Origin",
                            token: "Token",
                            tokens: "Tokens",
                            maxInput: "Max. Input Length:",
                            maxInput_description:
                                "The maximum number of tokens that the language model can process as input. A token is a component of a word. In German, a word is approximately 1.3 tokens. All messages in the chat count as input.",
                            maxOutput: "Max. Output Length:",
                            maxOutput_description:
                                "The maximum number of tokens that the language model can generate in a response. A token is a component of a word. In German, a word is approximately 1.3 tokens.",
                            inputPrice: "Input Price:",
                            inputPrice__description:
                                "Price per 1 million input tokens. A token is a component of a word. In German, a word is approximately 1.3 tokens. All messages in the chat count as input.",
                            outputPrice: "Output Price:",
                            outputPrice_description:
                                "Price per 1 million output tokens. A token is a component of a word. In German, a word is approximately 1.3 tokens. A generated message counts as output.",
                            price: "Price",
                            selectButton: "Select"
                        }
                    },
                    discovery: {
                        title: "Discover Assistants",
                        subtitle: "Supercharge your workflow with specialized AI agents."
                    },
                    ...tutorialsTranslations.EN,
                    ...versionTranslations.EN,
                    ...faqTranslation.EN
                }
            },
            BA: {
                translation: {
                    header: {
                        nutzungsbedingungen: "Gebrauchsvorschriftn",
                        create_assistant: "Assistenten erstoin",
                        go_to_tutorials_tooltip: "Tutorials und Anleitungen fia Fragments und Tools",
                        go_to_tutorials_aria: "Zu de Tutorials und Anleitungen navigiern",
                        go_to_tutorials: "Tutorials"
                    },
                    home: {
                        assistants: "Assistentn",
                        last_used: "Zuletzt verwendet",
                        recommended: "Empfohlen",
                        chat_header: "Griaß di {{user}}, wos host heid vor?",
                        discover_all: "Alle Assistentn entdecka",
                        explore_badge: "Entdecka",
                        discover_all_description: "Entdeck und verwalt olle verf??gbaren Assistentn.",
                        discover_assistants: "Assistentn entdecka",
                        no_assistants_yet: "Du host no koane Assistentn verwendet. Entdeck jetzt verf??gbare Assistentn!",
                        no_assistants_available: "Koane Assistentn verf??gbar.",
                        load_error: "De Startseit hod ned glodn wern kenna. Bitte probier's no amoi."
                    },
                    chat: {
                        header: "Stelle a Froog oda probier a Beispui",
                        prompt: "Stell a Froog oder lad a Dokument hoch",
                        prompt_no_upload: "Stell a Froog",
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
                        organization_name: "Landeshauptstod Minga, RIT/it@M KIES",
                        footer_credit: "Made with ❤️ & ☕ by",
                        user_settings: "Nutzereinstellungen",
                        main_content: "Hauptinhalt",
                        footer_info: "Fußzeilen-Info",
                        clear_chat: "Neia Chat",
                        settings: "Konfiguration",
                        messages: "Nochrichten",
                        examples: "Beispui",
                        sidebar_show: "Sidebar zoagn",
                        sidebar_hide: "Sidebar ausblenden",
                        cancel: "Obbrecha",
                        close: "Schließn",
                        create: "Anlegn",
                        back: "Zruck",
                        ok: "OK",
                        next: "Weida",
                        loading: "Lade Konfiguration...",
                        hint: "Hinweis:",
                        edit: "Beorbeitn",
                        delete: "Löschn",
                        errors: {
                            config_not_loaded: "Konfiguration konnt ned g'laden werdn.",
                            failed_to_load_config: "Fehler beim Laden vo da Konfiguration.",
                            configuration_error: "Konfigurationsfehler",
                            unauthorized_title: "Zugriff verweigert",
                            unauthorized_message: "Servus {{name}}, du host koa Berechtigung, dass du auf desah Applikation zugreifen kannst.",
                            unauthorized_link_text: "Berechtigung holn"
                        }
                    },
                    version: {
                        header: "Wos gibts neis?",
                        added: "Nei",
                        fixed: "Fehla beseitigt",
                        changed: "Änderunga"
                    },
                    components: {
                        table_renderer: {
                            download_csv: "Als CSV runterladn",
                            table_aria_label: "Datentabell"
                        },
                        assistant_chat: {
                            actions: "Aktionen",

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
                            update_assistant_failed_message: "Beim Aktualisiern vom Assistent'n is a Fehla aufg'reng",
                            default_model_unavailable: "Standard-Modell ned verfügbar",
                            default_model_unavailable_message: "Des eigstellt Standard-Modell '{{modelName}}' gibts nimma. Bitte such da a anders Modell aus."
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
                            own_department_label: "(Dei Abteilung)",
                            load_error: "Konnte Verzeichnis ned lodn",
                            collapse: "Zammklappn",
                            expand: "Aufklappn",
                            me: "I",
                            loading: "Lodt...",
                            loading_short: "...",
                            clear_all: "Ois wecka",
                            remove_department: "Abteilung {{name}} wecka"
                        },
                        terms_of_use: {
                            tooltip: "Nutzungsbedingunga zeig'n",
                            label: "Nutzungsbedingunga",
                            accept: "Zustimm'n"
                        },
                        versioninfo: {
                            label: "Version",
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
                            toolsselectorbutton_tooltip: "Werkzeig aussuachn",
                            tutorial_help: "Tutorial aufmachn",
                            tool_header: "Zusätzliche Werkzeig auswähln:",
                            tutorial_help_aria: "Tutorial zum Werkzeig {{tool}} aufmachn",
                            send_question: "Froog senden",
                            add_tool: "Werkzeig dazua doa",
                            no_tools_active: "Koane Werkzeig aktiv",
                            more_tools: "+{{count}} mehr",
                            enable_all: "Ois aktiviern",
                            disable_all: "Ois deaktivieren",
                            available_tools: "Verfügbare Werkzeig",
                            remove_tool_aria: "{{tool}} wegmachn",
                            assistant_tool_locked: "Für den Assistentn fest aktiv",
                            assistant_tools_section: "Vom Assistentn vorgem",
                            optional_tools_section: "Weiterne Werkzeig",
                            upload_data: "Dokument hochladn",
                            uploaded_data_label: "Dazua gladne Dokumente",
                            remove_data: "Dokument wegdoa",
                            uploading: "Wird grod hochglodn..."
                        },
                        contextmanagerdialog: {
                            title: "Meine Dokumente",
                            subtitle: "Ausgwähte Dokumente wean im Ratsch ois Kontext hergnomma.",
                            uploading: "Wird obagloodn...",
                            upload_btn: "Obalodn",
                            select_label: "Dateien aussuachn",
                            no_saved: "No koane gspeicherten Dokumente.",
                            use: "Verwenden",
                            remove_saved: "Dokument entfernen",
                            parsed_at: "Vaorbeitet am",
                            clear_saved: "Ois löschen",
                            download: "Text obalodn",
                            selection_count: "Im Ratsch verwendet: {{selected}} vo {{total}}",
                            storage_error: "Dokument hod ned gspeichert wern kenna (Speicher voi)."
                        },
                        suminput: {
                            tokensused: "Token vabrocht",
                            limit: ". Oide Eingabn wean bei da Generierung ned mit einbezogn!",
                            removedocument: "Dokument löschn"
                        },
                        chattsettingsdrawer: {
                            title: "Ratsch Einstellunga",
                            creativity: "Kreativität",
                            creativity_low: "Niadrig",
                            creativity_medium: "Normal",
                            creativity_high: "Hoch",
                            creativity_low_description: "Konzentriert si auf Genauigkeit und sachliche Antwortn",
                            creativity_medium_description: "Hoit an neutralen und informativen Ton bei",
                            creativity_high_description: "Fördert bsonders kreative und vielfältige Antwortn",
                            creativity_info: `entscheidt, wia kreativ oda vorhersehbar de Antowortn vom Sprachmodell san. "Niadrig" liefert konservative und genaue Antwortn, "Normal" is ausgwogen, und "Hoch" führt zu kreativeren und spinnerten Antwortn.`,
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
                            show_configurations: "Konfigurationen anzeigen",
                            close_configurations: "Konfigurationen schließen",
                            "unpublish-button": "Veröffentlichung aufheb'n",
                            "remove-assistant": "Assistent entfern'n",
                            publish: "Veröffentlich'n",
                            unpublish: "Nimma veröffentlich'n",
                            export: "Exportier'n",
                            export_failed: "Da Assistent konnt ned exportiert werd'n",
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
                            add_assistant: "Nei anlegn"
                        },
                        import_assistant: {
                            import: "Importiern",
                            import_success: "Import erfolgreich",
                            import_success_message: 'Dea Assistent "{{title}}" is importiert wordn und ko jetzt verwendet werdn.',
                            import_error: "Import fehlgschlogn",
                            import_failed: "De Datei konnt ned importiert werdn",
                            import_invalid_format: "Ungültigs Dateiformat. De Datei muass an Titel und System-Prompt enthoidn.",
                            import_save_failed: "Fehler beim Speichern vom importierten Assistentn"
                        },
                        assistant_editor: {
                            // Page titles (differ between create and edit)
                            create_title: "An neia Assistentn o'legn",
                            edit_title: "Assistent bearbeiten",

                            // Create-only: Mode selector
                            subtitle_mode_select: "Wia möchst da starten?",
                            create_manually: "Selber mocha",
                            create_manually_description: "Fang von vorn o. Leg Werkzeig, Verhoitn und Prompts selber fest.",
                            create_manually_hint: "Für volle Kontrolle von Anfang o",
                            generate_with_mucgpt: "Mit MUCGPT generieren",
                            generate_with_mucgpt_description: "Beschreib dei Anforderungen und lass MUCGPT de Konfiguration generieren.",
                            generate_with_mucgpt_hint: "Für an schnellen ersten Entwurf",
                            recommended: "Empfohlen",

                            // Create-only: AI description input
                            subtitle_ai_input: "Beschreib dei'n Assistenten und erstell an ersten Entwurf",
                            ai_input_label: "Was soi dei'n Assistent doa?",
                            ai_input_placeholder: "Zum Beispiel: Der Assistent übersetzt ois, was'd eam gibst, ins Englische.",
                            try_example: "BEISPUI AUSPROBIERN:",
                            generate_button: "Assistentn generieren",
                            generating: "Wird generiert...",
                            description_required: "Bittschön gib a Beschreibung ei, damit MUCGPT den Assistentn generieren ko",
                            example_one: "Beispui 1: Übersetzer",
                            example_two: "Beispui 2: Email",
                            example_three: "Beispui 3: Synonyme",
                            create_example_one: "Englisch Übersetzer: Dea Assistent übersetzt den eingemen Text ins Englische.",
                            create_example_two: "Der Assistent is a Mitarbatr dea Stod Minga und antwortet höflich sowie individuell af de eingehnden E-Mails.",
                            create_example_three:
                                "Der Assistent erstäit fia des eingeme Wort oda den eingemen Satz zehn verschiedene Umformulierungen oda Synonyme.",

                            // Shared field labels
                            title: "Titel",
                            title_placeholder: "Zum Beispiel: Englisch-Ibasatza",
                            description: "Beschreibung",
                            description_placeholder: "Zum Beispiel: Der Assistent übersetzt ois, was'd eam gibst, ins Englische.",
                            default_assistant_title: "Assistent",
                            default_assistant_description: "Assistent",
                            system_prompt: "System-Prompt",
                            prompt_placeholder:
                                "# Anforderung\n# Schritt für Schritt\n# Format\n# Beispiele\n\nZum Beispiel:\nSchau drauf, dass de Ibasetzung an originalen Satzbau und an Sinn beihoid. Pass auf bei Wörtern, de auf'n Zusammenhang okemma, und auf de feinen kulturelln Untaschiede, de 's gebn ko.",

                            // Settings section headers
                            section_basic: "Grundlegnde Infos",
                            section_behaviour: "Verhoitn & Konfiguration",
                            section_tools: "Werkzeig",
                            section_prompts: "Prompts & Beispui",
                            section_access: "Zugriff & Sichtbarkeit",

                            // Advanced settings fields
                            creativity: "Kreativität",
                            creativity_placeholder: "Wähl a Kreativitätsstufn...",
                            creativity_low: "Aus (konservativ)",
                            creativity_medium: "Normal (ausgwogen)",
                            creativity_high: "Hoch (kreativ)",
                            default_model: "Standard-Modell",
                            default_model_info:
                                "Des Standard-Modell, des da Assistent hernimmt. Wenn koa Modell ausgewählt is, nimmt ma des, wos da Nutzer aussucht.",
                            default_model_placeholder: "Such da a Standard-Modell aus...",
                            no_default_model: "Koan Standard-Modell (da Nutzer entscheidet)",
                            departments: "Abteilungen",
                            departments_info:
                                "Des san de Abteilungen, de Zugriff auf den Assistenten ham. Olle Abteilungen in da Hierarchie unter de ausgsuachten Abteilungen ham a Zugriff.",

                            // Quick prompts
                            quick_prompts: "Vorgeschlagene Antworten",
                            quick_prompts_placeholder: "Füg vorgschlagene Antworn hinzu, oane pro Zeile (Label|Prompt)",
                            quick_prompt_label_placeholder: "Gib des Label ei...",
                            quick_prompt_text_placeholder: "Gib den Prompt-Text ei...",
                            add_quick_prompt: "Vorgeschlagene Antwort hinzufügn",
                            no_quick_prompts_selected: "Koane vorgeschlagene Antworn hinzugfügt",

                            // Examples
                            examples: "Beispui",
                            examples_placeholder: "Füg Beispui hinzu, oans pro Zeile (Text|Wert)",
                            example_text_placeholder: "Gib den Beispui-Text ei...",
                            example_value_placeholder: "Gib den Beispui-Wert ei...",
                            add_example: "Beispui hinzufügn",
                            no_examples_selected: "Koane Beispui hinzugfügt",

                            // Tools
                            select_tools: "Werkzeig aussuachn",
                            no_tools_selected: "Koane Werkzeig ausgsuacht",

                            // DnD / list controls
                            dnd_reorder_hint: "Ziag de Elementa am Griff, um de Reihenfoig zum ändern.",
                            drag_to_reorder: "Ziagn zum Nei-Ordna",
                            dnd_aria_label: "Element {{position}} vo {{total}} nei ordna",
                            move_up: "Nach obm",
                            move_down: "Nach untn",
                            remove: "Entfernen",

                            // Save feedback
                            save: "Speichan",
                            saved_successfully: "Erfolgreich gspeichert!",
                            assistant_saved_description: "Der Assistent {{assistantName}} is jetzt erfolgreich g'speichert.",
                            assistant_saved_success: "Assistent erfolgreich gspeichert!",
                            assistant_saved_message: 'Dei Assistent "{{title}}" is erfolgreich erstellt und gspeichert wordn.',

                            // Error messages
                            assistant_creation_failed: "Assistent konnt ned erstellt werdn",
                            save_config_failed: "Speichern vo da Assistenten-Konfiguration is fehlgschlogn",
                            assistant_save_failed: "Speichern vom Assistenten is fehlgschlogn",
                            assistant_generated_success: "Assistent erfolgreich generiert!",
                            assistant_generated_message: "Dei Assistent-Konfiguration is generiert wordn. Du kannst sie jetzt überprüfn und anpassn.",
                            assistant_generation_failed: "Generierung vo da Assistenten-Konfiguration is fehlgschlogn",

                            // Discard confirmation
                            discard_title: "Änderungen verwerfn?",
                            discard_message: "Du hosd ungespeicherte Änderungen. Wuißt du wirklich abbrechen?"
                        },
                        expandable_textarea: {
                            default_title: "Bearbeiten"
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
                            no_departments_selected:
                                "Koane Abteilungen ausgewählt – de Veröffentlichung werd verhindert, bis mindestens a Abteilung ausgewählt wurd.",
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
                            about: "Über",
                            search: "Assistentn durchschaun",
                            filter_by_tag: "Noch Tag filtern",
                            filter_all: "Community",
                            filter_yours: "Eigne",
                            filter_subscribed: "Abonniert",
                            system_prompt: "System-Prompt",
                            enabled_tools: "Aktivierte Werkzeig",
                            start_chat: "Ratsch o'fanga",
                            sort_by: "Sortieren noch",
                            sort_title: "Titel",
                            sort_updated: "Zletzt aktualisiert",
                            sort_subscriptions: "Abonnements",
                            sort_by_tooltip: "Sortierung vo de Assistentn ändern",
                            save: "Assistent speichan",

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
                            subscribed_assistant: "Abonniert",
                            more_options: "Weitere Optionen",
                            duplicate: "Private Kopie erstoin",
                            duplicate_confirm_title: "Eigene private Kopie erstoin",
                            duplicate_confirm_message:
                                'Du konnst "{{title}}" aa ohne eigene Kopie weiternutzn. Magst trotzdem a eigene Kopie erstoin? Spätere Änderungen vom ursprünglichen Assistentn wearn ned auf dei Kopie übernomma.',
                            duplicate_confirm_message_deleted:
                                'Da ursprüngliche Assistent "{{title}}" is nimmer verfuegbar. Wennst weitermacha mogst, koanst jetz a eigene Kopie aus da zletzt gspeicherten Version erstoin.',
                            duplicate_confirm_action: "Kopie erstoin",
                            duplicate_title_suffix: "[Kopie]",
                            duplicate_success_title: "Assistent dupliziert",
                            duplicate_success_message: 'Da Assistent "{{title}}" is erfolgreich dupliziert worn.',
                            duplicate_failed_title: "Assistent hod ned dupliziert wern kina",
                            duplicate_failed_default: "Beim Dupliziern vom Assistentn is a Fehler aufgtretn.",
                            duplicate_failed_rate_limited: "Zvui Anfragen. Bitte probier's spada nomoi.",
                            duplicate_failed_forbidden: "Du host koa Berechtigung, den Assistentn zum Dupliziern.",
                            duplicate_failed_not_found: "Da Assistent is ned gfundn worn und ko ned dupliziert wern.",
                            local_badge: "Veraltet - Lokal",
                            local_state_title: "Der lokale Assistent is veraltet",
                            discovery_local_hint:
                                "Der Assistent is bloß lokal in deim Browser gesichert und geht verloren, wennst des Gerät wechselst. Sicher eam jetzt, damit a dauerhaft erhalten bleibt.",
                            local_chat_warning:
                                "Der Assistent is bloß lokal in deim Browser gesichert und geht verloren, wennst des Gerät wechselst. Sicher eam jetzt, damit a dauerhaft erhalten bleibt.",
                            local_state_publish_action: "Sichern",
                            local_migration_confirm_title: "Assistent sichern?",
                            local_migration_confirm_message:
                                "Mir sichern den Assistenten, damit a dauerhaft erhalten bleibt. Wennst eam später für andere freigebn magst, kannst des jederzeit in de Einstellungen ändern.",
                            local_migration_confirm_action: "Sichern",
                            local_migration_success_title: "Assistent gesichert",
                            local_migration_success_message: 'Da Assistent "{{title}}" is gesichert worn.',
                            local_migration_failed_title: "Assistent hod ned gesichert wern kina",
                            local_migration_failed_default: "Beim Sichern vom Assistentn is a Fehler aufgtretn.",
                            deleted_badge: "Glascht",
                            deleted_state_title: "Der Community-Assistent is nimmer verfuegbar",
                            deleted_state_body:
                                "Da urspruengliche Assistent is nimmer verfuegbar und werd aa nimmer unterstuetzt. Direkt weiternutzn geht nimmer.",
                            deleted_state_body_continue:
                                "Wennst mit dera Konfiguration weitermacha mogst, speicherst as ois dein eigenen Assistenten. Fruahere Chats koanst weiterhin nur lesend anschaugn.",
                            discovery_deleted_hint:
                                "Der Community-Assistent is vom Ersteller glascht worn und nimmer verfuegbar. De letzte Version liegt bloß no lokal im Browser und ko verloren geh. Sicherst as jetz ois eigenen Assistenten oder schaust bloß den oidn Chatverlauf o.",
                            deleted_chat_warning:
                                "Der Community-Assistent is vom Ersteller glascht worn und nimmer verfuegbar. De Version liegt bloß no lokal im Browser und ko verloren geh. Der Chatverlauf is nur lesend. Sicherst as ois eigenen Assistenten, wennst weitermacha mogst.",
                            deleted_state_save_action: "Ois eigenen Assistenten speichern",
                            deleted_state_history_action: "Oidn Chatverlauf anschaugn",
                            deleted_state_no_history: "Fuer den Assistenten gibt's koan lokalen Chatverlauf."
                        },
                        toolsselector: {
                            title: "Verfügbare Werkzeig",
                            select_all: "Olle aussuachn",
                            none: "Koane Werkzeig verfügbar.",
                            apply: "Ibernemma",
                            cancel: "Obbrecha"
                        },
                        globaltoasthandler: {
                            dismiss_aria_label: "Toast schließn"
                        },
                        llmSelector: {
                            title: "Sprachmodell-Auswahl",
                            bestFor: "Ideal für:",
                            knowledge: "Wissensstand:",
                            knowledge_description: "Datum von de letzten Infos, mit denen des Modell trainiert woan is. Es ko nix wissen, was neuer is.",
                            notAvailable: "Ned verfügbar",
                            capability_reasoning: "Denka",
                            capability_functionCalling: "Funktions-Aufrufe",
                            capability_vision: "Visioon",
                            provider: "Anbieter:",
                            region: "Region:",
                            location: "Standort:",
                            features: "Funktionen:",
                            features_description: "Funktionalitäten, die des Sprachmodell mitbringt.",
                            context: "Kontext",
                            origin: "Herkunft",
                            token: "Token",
                            tokens: "Tokens",
                            maxInput: "Max. Eingabeläng:",
                            maxInput_description:
                                "De maximale Anzahl an Tokens, die des Sprachmodell als Eingabe verarbeiten ko. A Token is a Wortbestandteil. Im Deutschen is a Wort ungefähr 1,3 Tokens. Alle Nachrichten im Chat gängan als Eingabe.",
                            maxOutput: "Max. Ausgabeläng:",
                            maxOutput_description:
                                "De maximale Anzahl an Tokens, die des Sprachmodell mit einer Antwort generieren ko. A Token is a Wortbestandteil. Im Deutschen is a Wort ungefähr 1,3 Tokens.",
                            inputPrice: "Eingabe-Preis:",
                            inputPrice__description:
                                "Preis pro 1 Million Eingabetokens. A Token is a Wortbestandteil. Im Deutschen is a Wort ungefähr 1,3 Tokens. Alle Nachrichten im Chat gängan als Eingabe.",
                            outputPrice: "Ausgabe-Preis:",
                            outputPrice_description:
                                "Preis pro 1 Million Ausgabetokens. A Token is a Wortbestandteil. Im Deutschen is a Wort ungefähr 1,3 Tokens. Eine generierte Nachricht gängan als Ausgabe.",
                            price: "Preis",
                            selectButton: "Auswähln"
                        }
                    },
                    discovery: {
                        title: "Assistentn entdeckn",
                        subtitle: "Optimier dein Workflow mit spezialisierten KI-Agenten."
                    },
                    ...tutorialsTranslations.BA,
                    ...versionTranslations.BA,
                    ...faqTranslation.BA
                }
            },
            FR: {
                translation: {
                    header: {
                        nutzungsbedingungen: "Conditions d'utilisation",
                        create_assistant: "Créer un assistant",
                        go_to_tutorials_tooltip: "Tutoriels et guides pour les fragments et les outils",
                        go_to_tutorials_aria: "Aller aux tutoriels et guides",
                        go_to_tutorials: "Tutoriels"
                    },
                    home: {
                        assistants: "Assistants",
                        last_used: "Derniers utilis?s",
                        recommended: "Recommand?s",
                        chat_header: "Bonjour {{user}}, qu'est-ce que vous pr?voyez aujourd'hui ?",
                        discover_all: "D?couvrir tous les assistants",
                        explore_badge: "Découvrir",
                        discover_all_description: "D?couvrez et g?rez tous les assistants disponibles.",
                        discover_assistants: "D?couvrir les assistants",
                        no_assistants_yet: "Vous n'avez encore utilis? aucun assistant. D?couvrez maintenant les assistants disponibles !",
                        no_assistants_available: "Aucun assistant disponible.",
                        load_error: "La page d’accueil n’a pas pu être chargée. Veuillez réessayer."
                    },
                    chat: {
                        header: "Posez une question ou essayez un exemple",
                        prompt: "Posez une question ou téléchargez un document",
                        prompt_no_upload: "Posez une question",
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
                        organization_name: "Ville de Munich, RIT/it@M KIES",
                        footer_credit: "Made with ❤️ & ☕ by",
                        user_settings: "Paramètres utilisateur",
                        main_content: "Contenu principal",
                        footer_info: "Informations du pied de page",
                        clear_chat: "Nouveau chat",
                        settings: "Paramètres",
                        messages: "Messages",
                        examples: "Exemples",
                        sidebar_show: "Afficher la barre latérale",
                        sidebar_hide: "Masquer la barre latérale",
                        cancel: "Annuler",
                        close: "Fermer",
                        create: "Créer",
                        back: "Retour",
                        ok: "OK",
                        next: "Suivant",
                        loading: "Chargement de la configuration...",
                        hint: "Conseil :",
                        edit: "Modifier",
                        delete: "Supprimer",
                        errors: {
                            config_not_loaded: "La configuration n'a pas pu être chargée.",
                            failed_to_load_config: "Échec du chargement de la configuration.",
                            configuration_error: "Erreur de configuration",
                            unauthorized_title: "Accès refusé",
                            unauthorized_message: "Bonjour {{name}}, vous n'avez pas la permission d'accéder à cette application.",
                            unauthorized_link_text: "Obtenir la permission"
                        }
                    },
                    components: {
                        table_renderer: {
                            download_csv: "Télécharger en CSV",
                            table_aria_label: "Table de données"
                        },
                        assistant_chat: {
                            actions: "Actions",

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
                            update_assistant_failed_message: "Une erreur s'est produite lors de la mise à jour de l'assistant",
                            default_model_unavailable: "Modèle par défaut non disponible",
                            default_model_unavailable_message:
                                "Le modèle par défaut configuré '{{modelName}}' n'est plus disponible. Veuillez choisir un autre modèle."
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
                            own_department_label: "(Votre département)",
                            load_error: "Impossible de charger le répertoire",
                            collapse: "Réduire",
                            expand: "Développer",
                            me: "Moi",
                            loading: "Chargement...",
                            loading_short: "...",
                            clear_all: "Tout effacer",
                            remove_department: "Supprimer le département {{name}}"
                        },
                        terms_of_use: {
                            tooltip: "Afficher les conditions d'utilisation",
                            label: "Conditions d'utilisation",
                            accept: "Accepter"
                        },
                        versioninfo: {
                            label: "Version",
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
                            toolsselectorbutton_tooltip: "Sélectionner des outils",
                            tutorial_help: "Ouvrir le tutoriel",
                            tool_header: "Choisir des outils supplémentaires:",
                            tutorial_help_aria: "Ouvrir le tutoriel pour l'outil {{tool}}",
                            send_question: "Envoyer la question",
                            add_tool: "Ajouter des outils",
                            no_tools_active: "Aucun outil actif",
                            more_tools: "+{{count}} de plus",
                            enable_all: "Tout activer",
                            disable_all: "Tout désactiver",
                            available_tools: "Outils disponibles",
                            remove_tool_aria: "Supprimer {{tool}}",
                            assistant_tool_locked: "Activé par cet assistant",
                            assistant_tools_section: "Fourni par l'assistant",
                            optional_tools_section: "Outils supplémentaires",
                            upload_data: "Télécharger un document",
                            uploaded_data_label: "Documents ajoutés",
                            remove_data: "Supprimer le document",
                            uploading: "Téléchargement..."
                        },
                        contextmanagerdialog: {
                            title: "Mes documents",
                            subtitle: "Les documents sélectionnés seront utilisés comme contexte dans le chat.",
                            uploading: "Téléversement...",
                            upload_btn: "Téléverser",
                            select_label: "Choisir des fichiers",
                            no_saved: "Aucun document enregistré pour l'instant.",
                            use: "Utiliser",
                            remove_saved: "Supprimer le document",
                            parsed_at: "Traité le",
                            clear_saved: "Tout effacer",
                            download: "Télécharger le texte",
                            selection_count: "{{selected}} sur {{total}} sélectionné(s)",
                            storage_error: "Le document n'a pas pu être enregistré (stockage plein)."
                        },
                        suminput: {
                            tokensused: "Tokens utilisés",
                            limit: ". Les entrées plus anciennes ne seront pas prises en compte lors de la génération !",
                            removedocument: "Supprimer le document"
                        },
                        chattsettingsdrawer: {
                            title: "Paramètres de discussion",
                            creativity: "Créativité",
                            creativity_low: "Faible",
                            creativity_medium: "Normal",
                            creativity_high: "Élevé",
                            creativity_low_description: "Se concentre sur la précision et les réponses factuelles",
                            creativity_medium_description: "Maintient un ton neutre et informatif",
                            creativity_high_description: "Favorise des réponses particulièrement créatives et variées",
                            creativity_info: `détermine à quel point les réponses du modèle linguistique sont créatives ou prévisibles. "Faible" fournit des réponses conservatrices et précises, "Normal" est équilibré, et "Élevé" conduit à des réponses plus créatives et imprévisibles.`,
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
                            show_configurations: "Afficher les configurations",
                            close_configurations: "Fermer les configurations",
                            "unpublish-button": "Dépublier",
                            "remove-assistant": "Retirer l'assistant",
                            publish: "Publier",
                            unpublish: "Dépublier",
                            export: "Exporter",
                            export_failed: "L'assistant n'a pas pu être exporté",
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
                            add_assistant: "Créer"
                        },
                        import_assistant: {
                            import: "Importer",
                            import_success: "Importation réussie",
                            import_success_message: 'L\'assistant "{{title}}" a été importé et est prêt à être utilisé.',
                            import_error: "Échec de l'importation",
                            import_failed: "Le fichier n'a pas pu être importé",
                            import_invalid_format: "Format de fichier invalide. Le fichier doit contenir un titre et un prompt système.",
                            import_save_failed: "Erreur lors de l'enregistrement de l'assistant importé"
                        },
                        assistant_editor: {
                            // Page titles (differ between create and edit)
                            create_title: "Créer un assistant",
                            edit_title: "Modifier l'assistant",

                            // Create-only: Mode selector
                            subtitle_mode_select: "Choisissez comment vous souhaitez commencer",
                            create_manually: "Créer manuellement",
                            create_manually_description: "Commencez de zéro. Définissez vous-même les outils, le comportement et les prompts.",
                            create_manually_hint: "Pour un contrôle total dès le début",
                            generate_with_mucgpt: "Générer avec MUCGPT",
                            generate_with_mucgpt_description: "Décrivez vos besoins et laissez MUCGPT générer la configuration.",
                            generate_with_mucgpt_hint: "Pour obtenir rapidement une première version",
                            recommended: "Recommandé",

                            // Create-only: AI description input
                            subtitle_ai_input: "Décrivez votre assistant et créez une première version",
                            ai_input_label: "Que doit faire votre assistant ?",
                            ai_input_placeholder: "Par exemple : l'assistant traduit le texte saisi en anglais.",
                            try_example: "ESSAYER UN EXEMPLE :",
                            generate_button: "Générer l'assistant",
                            generating: "Génération...",
                            description_required: "Veuillez saisir une description pour que MUCGPT puisse générer l'assistant",
                            example_one: "Exemple 1 : Traducteur",
                            example_two: "Exemple 2 : E-mail",
                            example_three: "Exemple 3 : Synonymes",
                            create_example_one: "Traducteur anglais : l'assistant traduit le texte saisi en anglais.",
                            create_example_two:
                                "L'assistant est un agent de la Ville de Munich et répond de manière polie et personnalisée aux e-mails entrants.",
                            create_example_three: "L'assistant crée dix reformulations ou synonymes pour le mot ou la phrase saisi(e).",

                            // Shared field labels
                            title: "Titre",
                            title_placeholder: "Par exemple : Traducteur anglais",
                            description: "Description",
                            description_placeholder: "Par exemple : l'assistant traduit le texte saisi en anglais.",
                            default_assistant_title: "Assistant",
                            default_assistant_description: "Assistant",
                            system_prompt: "Prompt système",
                            prompt_placeholder:
                                "# Exigence\n# Étapes\n# Format de sortie\n# Exemples\n\nPar exemple :\nAssurez-vous que la traduction conserve la structure et le sens de la phrase d'origine. Tenez compte des nuances contextuelles et des différences culturelles.",

                            // Settings section headers
                            section_basic: "Informations de base",
                            section_behaviour: "Comportement et configuration",
                            section_tools: "Outils",
                            section_prompts: "Prompts et exemples",
                            section_access: "Accès et visibilité",

                            // Advanced settings fields
                            creativity: "Créativité",
                            creativity_placeholder: "Sélectionnez un niveau de créativité...",
                            creativity_low: "Désactivée (conservateur)",
                            creativity_medium: "Normale (équilibrée)",
                            creativity_high: "Élevée (créative)",
                            default_model: "Modèle par défaut",
                            default_model_info:
                                "Le modèle par défaut utilisé pour cet assistant. Si aucun modèle n'est sélectionné, le modèle choisi par l'utilisateur sera utilisé.",
                            default_model_placeholder: "Sélectionnez un modèle par défaut...",
                            no_default_model: "Aucun modèle par défaut (l'utilisateur choisit)",
                            departments: "Départements",
                            departments_info:
                                "Ce sont les départements qui ont accès à l'assistant. Tous les départements situés en dessous dans la hiérarchie y ont également accès.",

                            // Quick prompts
                            quick_prompts: "Prompts rapides",
                            quick_prompts_placeholder: "Ajouter des prompts rapides, un par ligne (label|prompt)",
                            quick_prompt_label_placeholder: "Saisir le libellé...",
                            quick_prompt_text_placeholder: "Saisir le texte du prompt...",
                            add_quick_prompt: "Ajouter un prompt rapide",
                            no_quick_prompts_selected: "Aucun prompt rapide ajouté",

                            // Examples
                            examples: "Exemples",
                            examples_placeholder: "Ajouter des exemples, un par ligne (texte|valeur)",
                            example_text_placeholder: "Saisir le texte de l'exemple...",
                            example_value_placeholder: "Saisir la valeur de l'exemple...",
                            add_example: "Ajouter un exemple",
                            no_examples_selected: "Aucun exemple ajouté",

                            // Tools
                            select_tools: "Sélectionner des outils",
                            no_tools_selected: "Aucun outil sélectionné",

                            // DnD / list controls
                            dnd_reorder_hint: "Faites glisser les éléments avec la poignée pour modifier l'ordre.",
                            drag_to_reorder: "Glisser pour réordonner",
                            dnd_aria_label: "Réorganiser l'élément {{position}} sur {{total}}",
                            move_up: "Monter",
                            move_down: "Descendre",
                            remove: "Supprimer",

                            // Save feedback
                            save: "Enregistrer",
                            saved_successfully: "Enregistré avec succès !",
                            assistant_saved_description: "L'assistant {{assistantName}} a été enregistré avec succès.",
                            assistant_saved_success: "Assistant enregistré avec succès !",
                            assistant_saved_message: 'Votre assistant "{{title}}" a été créé et enregistré.',

                            // Error messages
                            assistant_creation_failed: "Impossible de créer l'assistant",
                            save_config_failed: "Échec de l'enregistrement de la configuration de l'assistant",
                            assistant_save_failed: "Échec de l'enregistrement de l'assistant",
                            assistant_generated_success: "Assistant généré avec succès !",
                            assistant_generated_message:
                                "La configuration de votre assistant a été générée. Vous pouvez maintenant la vérifier et la personnaliser.",
                            assistant_generation_failed: "Échec de la génération de la configuration de l'assistant",

                            // Discard confirmation
                            discard_title: "Annuler les modifications ?",
                            discard_message: "Vous avez des modifications non enregistrées. Voulez-vous vraiment annuler ?"
                        },
                        expandable_textarea: {
                            default_title: "Modifier"
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
                            no_departments_selected:
                                "Aucun département sélectionné — la publication sera bloquée jusqu'à ce qu'au moins un département soit choisi.",
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
                            about: "À propos",
                            search: "Rechercher des assistants",
                            filter_by_tag: "Filtrer par tag",
                            filter_all: "Communauté",
                            filter_yours: "Vos",
                            filter_subscribed: "Abonnés",
                            system_prompt: "Prompt système",
                            enabled_tools: "Outils activés",
                            start_chat: "Démarrer la conversation",
                            sort_by: "Trier par",
                            sort_title: "Titre",
                            sort_updated: "Dernière mise à jour",
                            sort_subscriptions: "Abonnements",
                            sort_by_tooltip: "Modifier le tri des assistants",
                            save: "Enregistrer l'assistant",

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
                            subscribed_assistant: "Abonné",
                            more_options: "Plus d'options",
                            duplicate: "Créer une copie privée",
                            duplicate_confirm_title: "Créer votre propre copie privée",
                            duplicate_confirm_message: `Vous pouvez continuer à utiliser "{{title}}" sans créer votre propre copie. Voulez-vous quand même en créer une ? Les modifications futures de l'assistant d'origine ne seront pas appliquées à votre copie.`,
                            duplicate_confirm_message_deleted: `L'assistant d'origine "{{title}}" n'est plus disponible. Si vous voulez continuer à l'utiliser, vous pouvez créer maintenant votre propre copie à partir de la dernière version en cache.`,
                            duplicate_confirm_action: "Créer la copie",
                            duplicate_title_suffix: "[Copie]",
                            duplicate_success_title: "Assistant dupliqué",
                            duplicate_success_message: `L'assistant "{{title}}" a été dupliqué avec succès.`,
                            duplicate_failed_title: "L'assistant n'a pas pu être dupliqué",
                            duplicate_failed_default: "Une erreur est survenue lors de la duplication de l'assistant.",
                            duplicate_failed_rate_limited: "Trop de requêtes. Veuillez réessayer plus tard.",
                            duplicate_failed_forbidden: "Vous n'avez pas la permission de dupliquer cet assistant.",
                            duplicate_failed_not_found: "L'assistant n'a pas été trouvé et ne peut pas être dupliqué.",
                            local_badge: "Obsolète - Local",
                            local_state_title: "Cet assistant local est obsolète",
                            discovery_local_hint:
                                "Cet assistant est uniquement enregistré localement dans votre navigateur et sera perdu si vous changez d'appareil. Enregistrez-le maintenant pour le conserver durablement.",
                            local_chat_warning:
                                "Cet assistant est uniquement enregistré localement dans votre navigateur et sera perdu si vous changez d'appareil. Enregistrez-le maintenant pour le conserver durablement.",
                            local_state_publish_action: "Enregistrer",
                            local_migration_confirm_title: "Enregistrer l'assistant ?",
                            local_migration_confirm_message:
                                "Nous allons enregistrer cet assistant pour le conserver durablement. Si vous souhaitez plus tard le partager avec d'autres, vous pourrez le modifier à tout moment dans les paramètres de l'assistant.",
                            local_migration_confirm_action: "Enregistrer",
                            local_migration_success_title: "Assistant enregistré",
                            local_migration_success_message: `L'assistant "{{title}}" a été enregistré.`,
                            local_migration_failed_title: "L'assistant n'a pas pu être enregistré",
                            local_migration_failed_default: "Une erreur est survenue lors de l'enregistrement de l'assistant.",
                            deleted_badge: "Supprimé",
                            deleted_state_title: "Cet assistant communautaire n'est plus disponible",
                            deleted_state_body:
                                "L'assistant d'origine n'est plus disponible ni pris en charge. Vous ne pouvez plus continuer à l'utiliser directement.",
                            deleted_state_body_continue:
                                "Si vous voulez continuer avec cette configuration, enregistrez-la comme votre propre assistant. Vous pouvez encore consulter les anciens chats en lecture seule.",
                            discovery_deleted_hint:
                                "Cet assistant communautaire a été supprimé par son créateur et n'est plus disponible. La dernière version n'existe plus que localement dans ce navigateur et peut être perdue. Enregistrez-la maintenant comme votre propre assistant, ou consultez seulement l'ancien historique de chat.",
                            deleted_chat_warning:
                                "Cet assistant communautaire a été supprimé par son créateur et n'est plus disponible. Cette version n'existe plus que localement dans ce navigateur et peut être perdue. L'historique du chat est en lecture seule. Enregistrez-la comme votre propre assistant si vous voulez continuer à l'utiliser.",
                            deleted_state_save_action: "Enregistrer comme assistant personnel",
                            deleted_state_history_action: "Voir l'ancien historique de chat",
                            deleted_state_no_history: "Aucun historique de chat local n'est disponible pour cet assistant."
                        },
                        toolsselector: {
                            title: "Outils disponibles",
                            select_all: "Tout sélectionner",
                            none: "Aucun outil disponible.",
                            apply: "Appliquer",
                            cancel: "Annuler"
                        },
                        globaltoasthandler: {
                            dismiss_aria_label: "Fermer la notification"
                        },
                        llmSelector: {
                            title: "Sélection du modèle de langage",
                            bestFor: "Idéal pour:",
                            knowledge: "Niveau de connaissance :",
                            knowledge_description:
                                "Date des dernières informations avec lesquelles le modèle a été entraîné. Il peut ne pas être au courant des informations plus récentes.",
                            notAvailable: "Non disponible",
                            capability_reasoning: "Raisonnement",
                            capability_functionCalling: "Appel de fonction",
                            capability_vision: "Vision",
                            provider: "Fournisseur:",
                            region: "Région:",
                            location: "Région:",
                            features: "Fonctionnalités :",
                            features_description: "Fonctionnalités que le modèle de langage offre.",
                            context: "Contexte",
                            origin: "Origine",
                            token: "Jeton",
                            tokens: "Jetons",
                            maxInput: "Longueur maximale d'entrée:",
                            maxInput_description:
                                "Le nombre maximal de tokens que le modèle de langage peut traiter en entrée. Un token est une partie de mot. En français, un mot représente environ 1,3 tokens. Toutes les messages dans le chat sont considérées comme des entrées.",
                            maxOutput: "Longueur maximale de sortie:",
                            maxOutput_description:
                                "Le nombre maximal de tokens que le modèle de langage peut générer dans une réponse. Un token est une partie de mot. En français, un mot représente environ 1,3 tokens.",
                            inputPrice: "Prix d'entrée:",
                            inputPrice__description:
                                "Prix par 1 million de tokens d'entrée. Un token est une partie de mot. En français, un mot représente environ 1,3 tokens. Toutes les messages dans le chat sont considérées comme des entrées.",
                            outputPrice: "Prix de sortie:",
                            outputPrice_description:
                                "Prix par 1 million de tokens de sortie. Un token est une partie de mot. En français, un mot représente environ 1,3 tokens. Une message générée est considérée comme une sortie.",
                            price: "Prix",
                            selectButton: "Sélectionner"
                        }
                    },
                    discovery: {
                        title: "Découvrir les Assistants",
                        subtitle: "Boostez votre flux de travail avec des agents IA spécialisés."
                    },
                    ...tutorialsTranslations.FR,
                    ...versionTranslations.FR,
                    ...faqTranslation.FR
                }
            },
            UK: {
                translation: {
                    header: {
                        go_to_tutorials_tooltip: "Навчальні матеріали та інструкції для фрагментів та інструментів",
                        go_to_tutorials_aria: "Перейти до навчальних матеріалів та інструкцій",
                        go_to_tutorials: "Навчальні матеріали",
                        create_assistant: "Створити асистента",
                        nutzungsbedingungen: "Умови використання"
                    },
                    home: {
                        assistants: "Асистенти",
                        last_used: "Останні використані",
                        recommended: "Рекомендовані",
                        chat_header: "Привіт {{user}}, що ти плануєш сьогодні?",
                        discover_all: "Переглянути всіх асистентів",
                        explore_badge: "Відкрити",
                        discover_all_description: "Переглядайте та керуйте всіма доступними асистентами.",
                        discover_assistants: "Відкрити асистентів",
                        no_assistants_yet: "Ви ще не використовували жодного асистента. Перегляньте доступних асистентів зараз!",
                        no_assistants_available: "Асистенти недоступні.",
                        load_error: "Не вдалося завантажити головну сторінку. Будь ласка, спробуйте ще раз."
                    },
                    chat: {
                        header: "Задайте питання або спробуйте приклад",
                        prompt: "Задайте питання або завантажте документ",
                        prompt_no_upload: "Задайте питання",
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
                        organization_name: "Місто Мюнхен, RIT/it@M KIES",
                        footer_credit: "Made with ❤️ & ☕ by",
                        user_settings: "Налаштування користувача",
                        main_content: "Основний контент",
                        footer_info: "Інформація у футері",
                        clear_chat: "Новий чат",
                        settings: "Налаштування",
                        messages: "Повідомлення",
                        examples: "Приклади",
                        sidebar_show: "Показати бічну панель",
                        sidebar_hide: "Сховати бічну панель",
                        cancel: "Скасувати",
                        close: "Закрити",
                        create: "Створити",
                        back: "Назад",
                        ok: "OK",
                        next: "Далі",
                        loading: "Завантаження конфігурації...",
                        hint: "Підказка:",
                        edit: "Редагувати",
                        delete: "Видалити",
                        errors: {
                            config_not_loaded: "Не вдалося завантажити конфігурацію.",
                            failed_to_load_config: "Помилка завантаження конфігурації.",
                            configuration_error: "Помилка конфігурації",
                            unauthorized_title: "Доступ заборонено",
                            unauthorized_message: "Привіт, {{name}}, у вас немає дозволу на доступ до цього додатку.",
                            unauthorized_link_text: "Отримати дозвіл"
                        }
                    },
                    components: {
                        table_renderer: {
                            download_csv: "Завантажити у форматі CSV",
                            table_aria_label: "Таблиця даних"
                        },
                        assistant_chat: {
                            actions: "Дії",

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
                            update_assistant_failed_message: "Під час оновлення асистента виникла помилка",
                            default_model_unavailable: "Стандартна модель недоступна",
                            default_model_unavailable_message:
                                "Налаштована стандартна модель '{{modelName}}' більше недоступна. Будь ласка, виберіть іншу модель."
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
                            own_department_label: "(Ваш відділ)",
                            load_error: "Не вдалося завантажити каталог",
                            collapse: "Згорнути",
                            expand: "Розгорнути",
                            me: "Я",
                            loading: "Завантаження...",
                            loading_short: "...",
                            clear_all: "Очистити все",
                            remove_department: "Видалити відділ {{name}}"
                        },
                        terms_of_use: {
                            tooltip: "Показати умови використання",
                            label: "Умови використання",
                            accept: "Прийняти"
                        },
                        versioninfo: {
                            label: "Версія",
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
                            toolsselectorbutton_tooltip: "Вибрати інструменти",
                            tutorial_help: "Відкрити навчальний посібник",
                            tool_header: "Вибрати додаткові інструменти:",
                            tutorial_help_aria: "Відкрити навчальний посібник для інструменту {{tool}}",
                            send_question: "Надіслати питання",
                            add_tool: "Додати інструменти",
                            no_tools_active: "Немає активних інструментів",
                            more_tools: "+{{count}} ще",
                            enable_all: "Активувати всі",
                            disable_all: "Деактивувати всі",
                            available_tools: "Доступні інструменти",
                            remove_tool_aria: "Видалити {{tool}}",
                            assistant_tool_locked: "Обов'язково для цього асистента",
                            assistant_tools_section: "Надані асистентом",
                            optional_tools_section: "Додаткові інструменти",
                            upload_data: "Завантажити документ",
                            uploaded_data_label: "Додані документи",
                            remove_data: "Видалити документ",
                            uploading: "Завантаження..."
                        },
                        contextmanagerdialog: {
                            title: "Мої документи",
                            subtitle: "Вибрані документи будуть використані як контекст у чаті.",
                            uploading: "Завантаження...",
                            upload_btn: "Завантажити",
                            select_label: "Вибрати файли",
                            no_saved: "Ще немає збережених документів.",
                            use: "Використати",
                            remove_saved: "Видалити документ",
                            parsed_at: "Оброблено",
                            clear_saved: "Очистити все",
                            download: "Завантажити текст",
                            selection_count: "{{selected}} з {{total}} вибрано",
                            storage_error: "Документ не вдалося зберегти (сховище переповнене)."
                        },
                        suminput: {
                            tokensused: "Використано токени",
                            limit: ". Старіші введення не будуть враховані при генерації!",
                            removedocument: "Видалити документ"
                        },
                        chattsettingsdrawer: {
                            title: "Налаштування чату",
                            creativity: "Креативність",
                            creativity_low: "Низька",
                            creativity_medium: "Нормальна",
                            creativity_high: "Висока",
                            creativity_low_description: "Зосереджується на точності та фактичних відповідях",
                            creativity_medium_description: "Підтримує нейтральний та інформативний тон",
                            creativity_high_description: "Сприяє створенню дуже креативних і різноманітних відповідей",
                            creativity_info: `визначає, наскільки креативними чи передбачуваними є відповіді мовної моделі. "Низька" забезпечує консервативні та точні відповіді, "Нормальна" є збалансованою, а "Висока" призводить до більш креативних та непередбачуваних відповідей.`,
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
                            show_configurations: "Показати конфігурації",
                            close_configurations: "Закрити конфігурації",
                            "unpublish-button": "Скасувати публікацію",
                            "remove-assistant": "Видалити асистента",
                            publish: "Опублікувати",
                            unpublish: "Скасувати публікацію",
                            export: "Експортувати",
                            export_failed: "Не вдалося експортувати асистента",
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
                            add_assistant: "Створити"
                        },
                        import_assistant: {
                            import: "Імпортувати",
                            import_success: "Імпорт успішний",
                            import_success_message: 'Асистент "{{title}}" було імпортовано і готовий до використання.',
                            import_error: "Помилка імпорту",
                            import_failed: "Не вдалося імпортувати файл",
                            import_invalid_format: "Недійсний формат файлу. Файл повинен містити назву та системний запит.",
                            import_save_failed: "Помилка збереження імпортованого асистента"
                        },
                        assistant_editor: {
                            // Page titles (differ between create and edit)
                            create_title: "Створити асистента",
                            edit_title: "Редагувати асистента",

                            // Create-only: Mode selector
                            subtitle_mode_select: "Оберіть, як ви хочете почати",
                            create_manually: "Створити вручну",
                            create_manually_description: "Почніть з нуля. Самостійно визначте інструменти, поведінку та промпти.",
                            create_manually_hint: "Для повного контролю з самого початку",
                            generate_with_mucgpt: "Згенерувати з MUCGPT",
                            generate_with_mucgpt_description: "Опишіть ваші вимоги, і MUCGPT згенерує конфігурацію.",
                            generate_with_mucgpt_hint: "Для швидкого першого чернеткового варіанту",
                            recommended: "Рекомендовано",

                            // Create-only: AI description input
                            subtitle_ai_input: "Опишіть вашого асистента та створіть перший чернетковий варіант",
                            ai_input_label: "Що має робити ваш асистент?",
                            ai_input_placeholder: "Наприклад: асистент перекладає введений текст англійською.",
                            try_example: "СПРОБУЙТЕ ПРИКЛАД:",
                            generate_button: "Згенерувати асистента",
                            generating: "Генерування...",
                            description_required: "Будь ласка, введіть опис, щоб MUCGPT міг згенерувати асистента",
                            example_one: "Приклад 1: Перекладач",
                            example_two: "Приклад 2: Електронний лист",
                            example_three: "Приклад 3: Синоніми",
                            create_example_one: "Англійський перекладач: асистент перекладає введений текст англійською.",
                            create_example_two: "Асистент є працівником міста Мюнхен і ввічливо та індивідуально відповідає на вхідні електронні листи.",
                            create_example_three: "Асистент створює десять різних перефразувань або синонімів до введеного слова чи речення.",

                            // Shared field labels
                            title: "Назва",
                            title_placeholder: "Наприклад: Англійський перекладач",
                            description: "Опис",
                            description_placeholder: "Наприклад: асистент перекладає введений текст англійською.",
                            default_assistant_title: "Асистент",
                            default_assistant_description: "Асистент",
                            system_prompt: "Системний промпт",
                            prompt_placeholder:
                                "# Вимога\n# Кроки\n# Формат відповіді\n# Приклади\n\nНаприклад:\nПереконайтеся, що переклад зберігає структуру та зміст оригінального речення. Звертайте увагу на контекстно-залежні слова та культурні відмінності.",

                            // Settings section headers
                            section_basic: "Основна інформація",
                            section_behaviour: "Поведінка та конфігурація",
                            section_tools: "Інструменти",
                            section_prompts: "Промпти та приклади",
                            section_access: "Доступ і видимість",

                            // Advanced settings fields
                            creativity: "Креативність",
                            creativity_placeholder: "Оберіть рівень креативності...",
                            creativity_low: "Вимкнено (консервативно)",
                            creativity_medium: "Нормально (збалансовано)",
                            creativity_high: "Високо (креативно)",
                            default_model: "Модель за замовчуванням",
                            default_model_info:
                                "Модель за замовчуванням для цього асистента. Якщо модель не вибрано, використовуватиметься модель, яку обрав користувач.",
                            default_model_placeholder: "Оберіть модель за замовчуванням...",
                            no_default_model: "Без моделі за замовчуванням (обирає користувач)",
                            departments: "Підрозділи",
                            departments_info: "Це підрозділи, які мають доступ до асистента. Усі підрозділи нижче у вибраній ієрархії також матимуть доступ.",

                            // Quick prompts
                            quick_prompts: "Швидкі промпти",
                            quick_prompts_placeholder: "Додайте швидкі промпти, по одному в рядку (label|prompt)",
                            quick_prompt_label_placeholder: "Введіть мітку...",
                            quick_prompt_text_placeholder: "Введіть текст промпту...",
                            add_quick_prompt: "Додати швидкий промпт",
                            no_quick_prompts_selected: "Швидкі промпти не додано",

                            // Examples
                            examples: "Приклади",
                            examples_placeholder: "Додайте приклади, по одному в рядку (text|value)",
                            example_text_placeholder: "Введіть текст прикладу...",
                            example_value_placeholder: "Введіть значення прикладу...",
                            add_example: "Додати приклад",
                            no_examples_selected: "Приклади не додано",

                            // Tools
                            select_tools: "Обрати інструменти",
                            no_tools_selected: "Інструменти не обрано",

                            // DnD / list controls
                            dnd_reorder_hint: "Перетягуйте елементи за ручку, щоб змінити порядок.",
                            drag_to_reorder: "Перетягнути для зміни порядку",
                            dnd_aria_label: "Змінити порядок елемента {{position}} з {{total}}",
                            move_up: "Вгору",
                            move_down: "Вниз",
                            remove: "Видалити",

                            // Save feedback
                            save: "Зберегти",
                            saved_successfully: "Успішно збережено!",
                            assistant_saved_description: "Асистента {{assistantName}} успішно збережено.",
                            assistant_saved_success: "Асистента успішно збережено!",
                            assistant_saved_message: 'Вашого асистента "{{title}}" створено та збережено.',

                            // Error messages
                            assistant_creation_failed: "Не вдалося створити асистента",
                            save_config_failed: "Не вдалося зберегти конфігурацію асистента",
                            assistant_save_failed: "Не вдалося зберегти асистента",
                            assistant_generated_success: "Асистента успішно згенеровано!",
                            assistant_generated_message: "Конфігурацію вашого асистента згенеровано. Тепер ви можете переглянути та налаштувати її.",
                            assistant_generation_failed: "Не вдалося згенерувати конфігурацію асистента",

                            // Discard confirmation
                            discard_title: "Скасувати зміни?",
                            discard_message: "У вас є незбережені зміни. Ви впевнені, що хочете скасувати?"
                        },
                        expandable_textarea: {
                            default_title: "Редагувати"
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
                            no_departments_selected: "Не вибрано жодного відділу — публікація буде заблокована, доки не буде вибрано хоча б один відділ.",
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
                            about: "Про",
                            search: "Пошук асистентів",
                            filter_by_tag: "Фільтрувати за тегом",
                            filter_all: "Спільнота",
                            filter_yours: "Ваші",
                            filter_subscribed: "Підписані",
                            system_prompt: "Системний запит",
                            enabled_tools: "Увімкнені інструменти",
                            start_chat: "Розпочати розмову",
                            sort_by: "Сортувати за",
                            sort_title: "Заголовок",
                            sort_updated: "Останнє оновлення",
                            sort_subscriptions: "Підписки",
                            sort_by_tooltip: "Змінити сортування асистентів",
                            save: "Зберегти асистента",

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
                            subscribed_assistant: "Підписаний",
                            more_options: "Додаткові параметри",
                            duplicate: "Створити приватну копію",
                            duplicate_confirm_title: "Створити власну приватну копію",
                            duplicate_confirm_message:
                                'Ви можете й далі користуватися "{{title}}" без створення власної копії. Усе ж хочете створити її? Майбутні зміни в оригінальному асистенті не будуть застосовані до вашої копії.',
                            duplicate_confirm_message_deleted:
                                'Оригінальний асистент "{{title}}" більше недоступний. Якщо ви хочете й далі ним користуватися, зараз можна створити власну копію з останньої кешованої версії.',
                            duplicate_confirm_action: "Створити копію",
                            duplicate_title_suffix: "[Копія]",
                            duplicate_success_title: "Асистента дубльовано",
                            duplicate_success_message: 'Асистента "{{title}}" успішно дубльовано.',
                            duplicate_failed_title: "Не вдалося дублювати асистента",
                            duplicate_failed_default: "Під час дублювання асистента сталася помилка.",
                            duplicate_failed_rate_limited: "Забагато запитів. Будь ласка, спробуйте пізніше.",
                            duplicate_failed_forbidden: "У вас немає дозволу на дублювання цього асистента.",
                            duplicate_failed_not_found: "Асистента не знайдено, дублювання неможливе.",
                            local_badge: "Застарілий - локальний",
                            local_state_title: "Цей локальний асистент застарів",
                            discovery_local_hint:
                                "Цей асистент збережено лише локально у вашому браузері, і він буде втрачений, якщо ви зміните пристрій. Збережіть його зараз, щоб він залишався доступним.",
                            local_chat_warning:
                                "Цей асистент збережено лише локально у вашому браузері, і він буде втрачений, якщо ви зміните пристрій. Збережіть його зараз, щоб він залишався доступним.",
                            local_state_publish_action: "Зберегти",
                            local_migration_confirm_title: "Зберегти асистента?",
                            local_migration_confirm_message:
                                "Ми збережемо цього асистента, щоб він залишався доступним. Якщо пізніше ви захочете поділитися ним з іншими, це можна буде будь-коли змінити в налаштуваннях асистента.",
                            local_migration_confirm_action: "Зберегти",
                            local_migration_success_title: "Асистента збережено",
                            local_migration_success_message: 'Асистента "{{title}}" збережено.',
                            local_migration_failed_title: "Не вдалося зберегти асистента",
                            local_migration_failed_default: "Під час збереження асистента сталася помилка.",
                            deleted_badge: "Видалено",
                            deleted_state_title: "Цей асистент спільноти більше недоступний",
                            deleted_state_body:
                                "Оригінальний асистент більше недоступний і не підтримується. Ви більше не можете користуватися ним безпосередньо.",
                            deleted_state_body_continue:
                                "Якщо ви хочете й надалі користуватися цією конфігурацією, збережіть її як власного асистента. Попередні чати все ще можна переглядати лише для читання.",
                            discovery_deleted_hint:
                                "Цей асистент спільноти був видалений автором і більше недоступний. Остання версія зберігається лише локально в цьому браузері й може бути втрачена. Збережіть її зараз як власного асистента або лише перегляньте стару історію чату.",
                            deleted_chat_warning:
                                "Цей асистент спільноти був видалений автором і більше недоступний. Ця версія зберігається лише локально в цьому браузері й може бути втрачена. Історія чату доступна лише для читання. Збережіть її як власного асистента, якщо хочете й далі нею користуватися.",
                            deleted_state_save_action: "Зберегти як власного асистента",
                            deleted_state_history_action: "Переглянути стару історію чату",
                            deleted_state_no_history: "Для цього асистента немає локальної історії чату."
                        },
                        toolsselector: {
                            title: "Доступні інструменти",
                            select_all: "Вибрати всі",
                            none: "Немає доступних інструментів.",
                            apply: "Застосувати",
                            cancel: "Скасувати"
                        },
                        globaltoasthandler: {
                            dismiss_aria_label: "Закрити тост"
                        },
                        llmSelector: {
                            title: "Вибір мовної моделі",
                            bestFor: "Ідеально для:",
                            knowledge: "Рівень знань:",
                            knowledge_description: "Дата останніх інформацій, за якими модель була навчена. Модель може не знати нічого нового.",
                            notAvailable: "Недоступно",
                            capability_reasoning: "Міркування",
                            capability_functionCalling: "Виклик функцій",
                            capability_vision: "Зір",
                            provider: "Постачальник:",
                            region: "Регіон:",
                            location: "Регіон:",
                            features: "Функції:",
                            features_description: "Функціональність, яку пропонує мовна модель.",
                            context: "Контекст",
                            origin: "Походження",
                            token: "Токен",
                            tokens: "Токени",
                            maxInput: "Макс. довжина введення:",
                            maxInput_description:
                                "Максимальна кількість токенів, яку мовна модель може обробити як введення. Токен - це частина слова. В українській мові слово приблизно дорівнює 1,3 токенам. Всі повідомлення в чаті вважаються введенням.",
                            maxOutput: "Макс. довжина виведення:",
                            maxOutput_description:
                                "Максимальна кількість токенів, яку мовна модель може згенерувати у відповіді. Токен - це частина слова. В українській мові слово приблизно дорівнює 1,3 токенам.",
                            inputPrice: "Ціна введення:",
                            inputPrice__description:
                                "Ціна за 1 мільйон токенів введення. Токен - це частина слова. В українській мові слово приблизно дорівнює 1,3 токенам. Всі повідомлення в чаті вважаються введенням.",
                            outputPrice: "Ціна виведення:",
                            outputPrice_description:
                                "Ціна за 1 мільйон токенів виведення. Токен - це частина слова. В українській мові слово приблизно дорівнює 1,3 токенам. Згенероване повідомлення вважається виведенням.",
                            price: "Ціна",
                            selectButton: "Обрати"
                        }
                    },
                    discovery: {
                        title: "Відкрийте асистентів",
                        subtitle: "Прискорте свою роботу за допомогою спеціалізованих ШІ-агентів."
                    },
                    ...tutorialsTranslations.UK,
                    ...versionTranslations.UK,
                    ...faqTranslation.UK
                }
            }
        }
    });

export default i18n;
