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
                    header: "Zusammenfassen",
                    prompt: "Diesen Text zusammenfassen"
                },
                brainstorm: {
                    header: "Brainstorming",
                    prompt: "Ideen zu diesem Thema finden"
                },
                common: {
                    clear_chat: "Chat löschen",
                    settings: "Einstellungen",
                    close: "Schließen",
                    answer_loading: "Erstelle Antwort"
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
                    header: "Summarize",
                    prompt: "Summarize this text"
                },
                brainstorm: {
                    header: "Brainstorming",
                    prompt: "Find ideas for this topics"
                },
                common: {
                    clear_chat: "Clear chat",
                    settings: "Settings",
                    close: "Close",
                    answer_loading: "Generating answer"
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
                    header: "Zammfassn",
                    prompt: "Diesn Text zammfassn"
                },
                brainstorm: {
                    header: "Gedanknschmarrn",
                    prompt: "Ideen zu dem Thema aufaspuin"
                },
                common: {
                    clear_chat: "Nochrichten löschn",
                    settings: "Konfiguration",
                    close: "Schließen",
                    answer_loading: "I bearbeit grad de Frog"
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