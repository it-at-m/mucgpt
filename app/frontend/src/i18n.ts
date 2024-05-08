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
                        brainstorm: "Brainstorming",
                        nutzungsbedingungen: "Nutzungsbedingungen"
                    },
                    chat: {
                        header: "Stelle eine Frage oder probiere ein Beispiel",
                        prompt: "Stelle eine Frage",
                        answer_loading: "Erstelle Antwort"
                    },
                    sum: {
                        header: "Lasse Text zusammenfassen oder probiere ein Beispiel",
                        prompt: "Diesen Text zusammenfassen oder ein PDF per Drag und Drop hochladen",
                        rolelabel: "Zusammenfassen für",
                        lengthlabel: "in",
                        answer_loading: "Fasse zusammen",
                        levelofdetail: "Detailierungsgrad",
                        short: "Kurz",
                        medium: "Mittel",
                        long: "Lang"
                    },
                    brainstorm: {
                        header: "Finde Ideen zu einem Thema oder probiere ein Beispiel",
                        prompt: "Ideen zu diesem Thema finden",
                        answer_loading: "Denke nach"
                    },
                    common: {
                        clear_chat: "Chat löschen",
                        settings: "Einstellungen",
                        close: "Schließen",
                        messages: "Nachrichten",
                        examples: "Beispiele"
                    },
                    components: {
                        roles: {
                            student: "Student*innnen",
                            secondgrader: "Grundschüler*innen",
                            retired: "Rentner*innen"
                        },
                        sumlength: {
                            sentences: "Zwei Sätzen",
                            bullets: "Fünf Stichpunkten",
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
                        mindmap: {
                            download: "Herunterladen",
                            reset: "Ansicht zurücksetzen",
                            source: "Datenansicht",
                            mindmap: "Mindmapansicht"
                        },
                        sumanswer: {
                            header: "Einzigartige Aspekte/Entitäten:",
                            alternative: "Zusammenfassung ",
                            copy: "Zusammenfassung kopieren"
                        },
                        settingsdrawer: {
                            settings_button: "Einstellungen und Feedback",
                            feedback_button: "Feedback/Fehler melden",
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
                            theme_dark: "Dunkel"
                        },
                        questioninput: {
                            tokensused: "Token verbraucht",
                            limit: ". Ältere Eingaben werden bei der Generierung nicht berücksichtigt!"
                        },
                        suminput: {
                            tokensused: "Token verbraucht",
                            limit: ". Ältere Eingaben werden bei der Generierung nicht berücksichtigt!",
                            removedocument: "Dokument löschen"
                        },
                        chattsettingsdrawer: {
                            settings_button: "Chat-Einstellungen",
                            temperature: "Temperatur",
                            temperature_article: "Die",
                            temperature_info: `beinflusst die "Kreativität" des Sprachmodells. Ein höherer Wert führt zu unvorhersehbareren Antworten (Wörter, die unwahrscheinlich gegenüber dem aktuellem Kontext sind, werden generiert), während ein niedrigerer Wert eher konservative und genauere Antworten erzeugt.`,
                            max_lenght: "Maximale Antwortlänge",
                            max_lenght_info: " Wieviele Token dürfen maximal bei einer Antwort generiert werden.",
                            system_prompt: "System Prompt",
                            system_prompt_info:
                                "sind vordefinierte Abfragen oder Anweisungen, die dazu dienen, die Antworten von MUCGPT gezielter und kontrollierter zu gestalten. Dabei nimmt die KI oft eine bestimmte Rolle ein, antwortet in einem bestimmtes Format oder beachtet andere Einschränkungen."
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
                        recommendanswers: {
                            name: "Vogeschlagene Antworten",
                            shorter_tooltip: "Schreibe eine kürzere Antwort",
                            longer_tooltip: "Schreibe eine längere Antwort",
                            formal_tooltip: "Schreibe eine förmlichere Antwort",
                            informal_tooltip: "Schreibe eine informellere Antwort",
                            shorter: "Kürzer",
                            longer: "Länger",
                            formal: "Förmlicher",
                            informal: "Informeller",
                            shorter_prompt:
                                "Formuliere deine letzte Nachricht zu einem neuen kürzeren Text, der den ursprünglichen Inhalt in einer kürzeren und prägnanteren Form wiedergibt. Dieser Text sollte die wichtigsten Informationen enthalten und das Verständnis des Lesers verbessern.",
                            longer_prompt:
                                "Formuliere deine letzte Nachricht zu einem neuen längeren Text, der den ursprünglichen Inhalt erweitert und mit mehr Details und Hintergrundinformationen versehen ist. Dieser Text sollte das Verständnis des Lesers vertiefen und eine umfassendere Perspektive auf das Thema bieten.",
                            formal_prompt:
                                "Formuliere deine letzte Nachricht zu einem neuen formellen Text, der den ursprünglichen Inhalt in einer akademischen Schreibweise präsentiert. Dieser Text sollte eine klare Struktur aufweisen, präzise und sachliche Ausdrucksweise verwenden und dem Leser ein professionelles Leseerlebnis bieten",
                            informal_prompt:
                                "Formuliere deine letzte Nachricht zu einem neuen informelleren Text, der den ursprünglichen Inhalt in einer lockeren Schreibweise wiedergibt. Dieser Text soll dem Leser ein ungezwungenes Leseerlebnis bieten, indem er leicht verständliche Sprache und gegebenenfalls auch humorvolle Elemente verwendet."
                        }
                    }
                }
            },
            Englisch: {
                translation: {
                    header: {
                        sum: "Summarize",
                        chat: "Chat",
                        brainstorm: "Brainstorming",
                        nutzungsbedingungen: "Terms of use"
                    },
                    chat: {
                        header: "Ask a question or try an example",
                        prompt: "Ask a question",
                        answer_loading: "Generating answer"
                    },
                    sum: {
                        header: "Summarize text or try an example",
                        prompt: "Summarize this text or upload a PDF by using drag and drop",
                        rolelabel: "Summarize for",
                        lengthlabel: "in",
                        answer_loading: "Summarize",
                        levelofdetail: "Level of Detail",
                        short: "Short",
                        medium: "Medium",
                        long: "Long"
                    },
                    brainstorm: {
                        header: "Find ideas for a topic or try an example",
                        prompt: "Find ideas for this topics",
                        answer_loading: "Thinking"
                    },
                    common: {
                        clear_chat: "Clear chat",
                        settings: "Settings",
                        close: "Close",
                        messages: "Messages",
                        examples: "Examples"
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
                        sumanswer: {
                            header: "Unique entities/aspects:",
                            alternative: "Summary ",
                            copy: "Copy summary"
                        },
                        settingsdrawer: {
                            settings_button: "Settings and feedback",
                            feedback_button: "Report Feedback/Fehler",
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
                            theme_dark: "Dark"
                        },
                        questioninput: {
                            tokensused: "Token used",
                            limit: ". Previous inputs are not considered during generation!"
                        },
                        suminput: {
                            tokensused: "Token used",
                            limit: ". Previous inputs are not considered during generation!",
                            removedocument: "Delete document"
                        },
                        chattsettingsdrawer: {
                            settings_button: "Chat settings",
                            temperature: "Temperature",
                            temperature_article: "The",
                            temperature_info: `controls  controls the “creativity” or randomness of the text generated by MUCGPT. A higher temperature (e.g., 0.7) results in more diverse and creative output, while a lower temperature (e.g., 0.2) makes the output more deterministic and focused.`,
                            max_lenght: "Maximum response length",
                            max_lenght_info: "How many tokens (words) can be generated at most in a response.",
                            system_prompt: "System prompt",
                            system_prompt_info:
                                "are predefined queries or instructions that serve to make the responses of MUCGPT more targeted and controlled. The AI often takes on a certain role, responds in a certain format, or observes other restrictions"
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
                        recommendanswers: {
                            name: "Recommended answers",
                            shorter_tooltip: "Shorten your answer",
                            longer_tooltip: "Write a longer response",
                            formal_tooltip: "Write your answer more formal",
                            informal_tooltip: "Write your answer more informal",
                            shorter: "more precise",
                            longer: "more detail",
                            formal: "more formal",
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
                    }
                }
            },
            Bairisch: {
                translation: {
                    header: {
                        sum: "Zammfassn",
                        chat: "Redn",
                        brainstorm: "Gedanknschmarrn",
                        nutzungsbedingungen: "Gebrauchsvorschriftn"
                    },
                    chat: {
                        header: "Stelle a Froog oda probier a Beispui",
                        prompt: "Stelle a Froog ",
                        answer_loading: "I bearbeit grad de Frog"
                    },
                    sum: {
                        header: "Fassn Text zam oda probier a Beispui",
                        prompt: "Diesn Text zammfassn oda a PDF per Drag und Drop hoachladn",
                        rolelabel: "Zammfassn für",
                        lengthlabel: "in",
                        answer_loading: "Am zammfassn",
                        levelofdetail: "Detai-Grad",
                        short: "Kurz",
                        medium: "Mittel",
                        long: "Lang"
                    },
                    brainstorm: {
                        header: "Ideen zu dem Thema aufaspuin oda probier a Beispui",
                        prompt: "Ideen zu dem Thema aufaspuin",
                        answer_loading: "Denk na"
                    },
                    common: {
                        clear_chat: "Nochrichten löschn",
                        settings: "Konfiguration",
                        close: "Schließen",
                        messages: "Nochrichten",
                        examples: "Beispui"
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
                        sumanswer: {
                            header: "Einzigartige Schwerpunkte:",
                            alternative: "Zsammanfassung ",
                            copy: "Zsammanfassung kopiern"
                        },
                        settingsdrawer: {
                            settings_button: "Eistellunga und Rückmeldung",
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
                            theme_dark: "Dunkel"
                        },
                        questioninput: {
                            tokensused: "Token vabrocht",
                            limit: ". Oide Eingabn wean bei da Generierung ned mit einbezogn!"
                        },
                        suminput: {
                            tokensused: "Token vabrocht",
                            limit: ". Oide Eingabn wean bei da Generierung ned mit einbezogn!",
                            removedocument: "Dokument löschn"
                        },
                        chattsettingsdrawer: {
                            settings_button: "Chat-Einstellungen",
                            temperature: "Temperatur",
                            temperature_article: "Da",
                            temperature_info: `	beinflusst de "Kreativität" vom Sprachmodel. A höherer Wert führt zu unvorhersehbareren Antworten (Wörter, de unwahrscheinliche geem de aktuelle Kontext san, werdn generiert), während a niedrigerer Wert eher konservative und genauere Antworten erzeugt.`,
                            max_lenght: "Maximale Antwortläng",
                            max_lenght_info: "Wia vui Token dürfen maximal bei am Antwort generiert werdn.",
                            system_prompt: "System Prompt",
                            system_prompt_info:
                                "san vorgegebene Abfragen oder Anweisungen, de dazu dienen, de Antworten von MUCGPT zielgerichteter und kontrollierter zum doa. Dabei nimmt de KI oft a bestimmte Rolle ei, antwortet in am bestimmten Format oder beachtet andere Einschränkungen."
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
                        recommendanswers: {
                            name: "Vogschlagene Antworten",
                            shorter_tooltip: "Schreib a kürzere Antwort",
                            longer_tooltip: "Schreib a längere Antwort",
                            formal_tooltip: "Schreib a förmlichere Antwort",
                            informal_tooltip: "Schreib a informellere Antwort",
                            shorter: "Kürzer",
                            longer: "Länger",
                            formal: "Förmlicher",
                            informal: "Informeller",
                            shorter_prompt:
                                "Formulier dei letzte Nachricht zu am neuen kürzeren Text, der an ursprünglichen Inhalt in a kürzere und prägnantere Form wiedagibt. Der Text soidad die wichtigsten Informationen enthalten und as Verständnis des Lesers verbessern.",
                            longer_prompt:
                                "Formuliere dei letzte Nachricht zu am neuen längeren Text, der an ursprünglichen Inhalt erweitert und mit mehr Details und Hintergrundinformationen versehen is. Der Text soidad as Verständnis des Lesers vertiefen und a umfassendere Perspektive auf das Thema bieten.",
                            formal_prompt:
                                "Formuliere dei letzte Nachricht zu am neuen formellen Text, der an ursprünglichen Inhalt in na akademischen Schreibweise präsentiert. Der Text soidad a klare Struktur aufweisen, präzise und sachliche Ausdrucksweise benutzn und am Leser a professionelles Leseerlebnis bieten",
                            informal_prompt:
                                "Formuliere dei letzte Nachricht zu am neuen informelleren Text, der an ursprünglichen Inhalt in a lockeren Schreibweise wiedagibt. Dieser Text soi am Leser a ungezwungenes Leseerlebnis bieten, indem er leicht verständliche Sprache und gegebenenfalls auch humorvolle Elemente benutzt."
                        }
                    }
                }
            },
            Ukrainisch: {
                translation: {
                    header: {
                        sum: "підсумовувати",
                        chat: "чат",
                        brainstorm: "мозковий штурм"
                    }
                }
            }
        }
    });

export default i18n;
