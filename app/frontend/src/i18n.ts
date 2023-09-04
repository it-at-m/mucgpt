import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n
  // pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // init i18next
  // for all options read: https://www.i18next.com/overview/configuration-options
  .init({
    debug: true,
    fallbackLng: 'Deutsch',
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
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
                    prompt: "Stelle eine Frage"
                },
                sum: {
                    header: "Lasse Text zusammenfassen oder probiere ein Beispiel",
                    prompt: "Diesen Text zusammenfassen",
                    rolelabel: "Zusammenfassen für",
                    lengthlabel: "in"
                },
                brainstorm: {
                    header: "Finde Ideen zu einem Thema oder probiere ein Beispiel",
                    prompt: "Ideen zu diesem Thema finden"
                },
                common: {
                    clear_chat: "Chat löschen",
                    settings: "Einstellungen",
                    close: "Schließen",
                    answer_loading: "Erstelle Antwort"
                },
                components:{
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
                        regenerate: "Antwort regenerieren"
                    },
                    mindmap: {
                        download: "Herunterladen",
                        reset: "Ansicht zurücksetzen",
                        source: "Datenansicht",
                        mindmap: "Mindmapansicht"
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
                    prompt: "Ask a question"
                },
                sum: {
                    header: "Summarize text or try an example",
                    prompt: "Summarize this text",
                    rolelabel: "Summarize for",
                    lengthlabel: "in"
                },
                brainstorm: {
                    header: "Find ideas for a topic or try an example",
                    prompt: "Find ideas for this topics"
                },
                common: {
                    clear_chat: "Clear chat",
                    settings: "Settings",
                    close: "Close",
                    answer_loading: "Generating answer"
                },
                components:{
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
                        regenerate: "Regenerate response"
                    },
                    mindmap: {
                        download: "Download",
                        reset: "Reset view",
                        source: "Source view",
                        mindmap: "Mindmap view"
                    }
                }
            }
        },
        Bayrisch: {
            translation: {
                header: {
                    sum: "Zammfassn",
                    chat: "Redn",
                    brainstorm: "Gedanknschmarrn",
                    nutzungsbedingungen: "Gebrauchsvorschriftn"
                },
                chat: {
                    header: "Stelle a Froog oda probier a Beispui",
                    prompt: "Stelle a Froog "
                },
                sum: {
                    header: "Fassn Text zam oda probier a Beispui",
                    prompt: "Diesn Text zammfassn",
                    rolelabel: "Zammfassn für",
                    lengthlabel: "in"
                },
                brainstorm: {
                    header: "Ideen zu dem Thema aufaspuin oda probier a Beispui",
                    prompt: "Ideen zu dem Thema aufaspuin"
                },
                common: {
                    clear_chat: "Nochrichten löschn",
                    settings: "Konfiguration",
                    close: "Schließen",
                    answer_loading: "I bearbeit grad de Frog"
                },
                components:{
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
                        retry: "No amoi probiern"
                    },
                    answer: {
                        regenerate: "No amoi probiern"
                    },
                    mindmap: {
                        download: "Obalada",
                        reset: "Oisicht zrucksetzn",
                        source: "Datenoisicht",
                        mindmap: "Mindmapoisicht"
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