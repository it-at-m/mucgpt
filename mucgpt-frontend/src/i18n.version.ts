export const versionTranslations = {
    DE: {
        versions: {
            v2_0: {
                date: "[2.0] 15.10.2025",
                communityAssistants: {
                    title: "Community-Assistenten",
                    share: "Eigene Assistenten können als Community-Assistenten geteilt werden.",
                    subscribe: "Community-Assistenten können abonniert werden.",
                    searchable: "Community-Assistenten sind durchsuchbar.",
                    manage: "Community-Assistenten können verwaltet und gelöscht werden."
                },
                tools: {
                    title: "Werkzeuge",
                    brainstorming: "Neues Brainstorming-Werkzeug: Ein Agentensystem erstellt neue Mindmaps oder erweitert bestehende Mindmaps.",
                    fullscreen: "Vollbildansicht für generierte Brainstorming-Mindmaps.",
                    simplify:
                        'Neues "Vereinfachen"-Werkzeug: Vereinfacht Texte iterativ nach Regeln für einfache Sprache, kritisiert und verbessert Texte und wiederholt den Prozess, bis das Ergebnis zufriedenstellend ist.',
                    interfaces: "Perspektivisch können viele verschiedene Schnittstellen und Anwendungen an MUCGPT angebunden werden."
                },
                misc: {
                    title: "Diverses",
                    mermaid: "Verbesserte Darstellung von Mermaid-Diagrammen (inkl. Steuerung zum Zoomen).",
                    username: "Anzeige des Benutzernamens aus Single Sign-On.",
                    tutorial: "Beginn eines interaktiven Tutorials in MUCGPT, das erklärt, wie Sprachmodelle und Systeme wie MUCGPT funktionieren."
                },
                redesign: {
                    title: "Beginn des Redesigns",
                    languageSelection: "Verbesserte Sprachauswahl.",
                    settings: "Einstellungen wurden in die Navigationsleiste / den Footer verlagert."
                },
                technical: {
                    title: "Technische Änderungen",
                    services: "Aufteilung in mehrere Services; kompletter Betrieb ist nun lokal möglich (SSO, API-Gateway, ...).",
                    agents: "Das System basiert nun auf einem agentenbasierten Ansatz."
                },
                changed: {
                    summarizeRemoved: "Zusammenfassen wurde entfernt"
                }
            },
            v1_2_5: {
                date: "[1.2.5] 24.04.2025",
                fixed: {
                    tokenSetting: "Fehler beim Einstellen der Tokenanzahl im Assistentenchat gefixt.",
                    messageRecall: 'Fehler mit "Nachricht zurückrufen" und "Nachricht neu generieren" der ersten Nachricht gefixt.',
                    messageDisplay: "Fehler beim Darstellen des Generierens einer Nachricht wurde behoben.",
                    latex: "Mathematische Formeln werden nun mit LaTeX korrekt gerendert.",
                    latexAlt: "Bild von mathematischen Formeln in MUCGPT"
                },
                changed: {
                    simpleLanguagePrompt: "Der Prompt für <i>einfache Sprache</i> wurde an neue Guidelines angepasst.",
                    generalImprovements: "Allgemeine Verbesserungen der Benutzeroberfläche und des Quellcodes."
                }
            },
            v1_2_4: {
                date: "[1.2.4] 4.03.2025",
                added: {
                    communityAssistantsTitle: "Community Assistenten:",
                    examplesAndSuggestions: "Community-Assistenten können nun eigene Beispiele und vorgeschlagene Antworten haben.",
                    newVersionsTitle: "Neue Versionen von Community-Assistenten",
                    sherlock: "Sherlock🕵Testfallgenerator: Erstellt und exportiert Tesftälle. Von itm.km73",
                    consultor: "Consultor: Berät zum Angebot von consult.in.M. Von consult.in.M",
                    arielle: "🧜Arielle: Erstellt Mermaid Diagramme",
                    centralConfig: "Community-Assistenten können zentral konfiguriert werden und es wird stets die neueste Version verwendet"
                },
                fixed: {
                    performance: "Performanceprobleme bei langen Chats (mehr als 20k Tokens).",
                    policyViolation:
                        'Wird ein Prompt als gefährlich identifziert, wird nun nur noch "Es wurde ein Richtlinienverstoß festgestellt und der Chat wird hier beendet" zurückgegeben.',
                    codeBlocks: "Code-Blöcke passen sich nun an die Schriftgröße an.",
                    settingsButton: '"Einstellungen & Feedback"-Button bleiben jetzt im Header beim Vergrößern der Schriftgröße.',
                    versionFaq: "Version & FAQ: Stil angepasst sowie Rechtschreib- und Grammatikfehler korrigiert.",
                    tokenUsageTitle: "Token-Nutzung:",
                    tokenDisplay: "Anzeigeproblem beim Neuladen behoben.",
                    tokenRemoved: "Token-Usage aus den Features <i>Zusammenfassen</i> und <i>Brainstorming</i> entfernt.",
                    tokenHidden: "Wenn keine Tokens verwendet werden, wird die Token-Usage nicht angezeigt, um eine übersichtlichere Oberfläche zu bieten.",
                    typos: "Zahlreiche Rechtschreib- und Grammatikfehler wurden korrigiert."
                },
                changed: {
                    simpleLanguageTitle: "Einfache Sprache:",
                    easyLanguageRemoved:
                        "<i>Leichte Sprache</i> wurde entfernt, da wir keine vollständige Übersetzung in leichte Sprache durchführen können und der Name deswegen irreführend ist.",
                    simpleLanguagePrompt: "Der Prompt für <i>einfache Sprache</i> wurde angepasst und erweitert.",
                    ownAssistantsTitle: "Eigene Assistenten:",
                    settingsEditOnly: "Einstellungen wie <i>System-Prompt</i> oder <i>Maximale Token-Anzahl</i> werden nur beim Bearbeiten angezeigt.",
                    sidebarExpands: "Beim Bearbeiten eines Assistenten verbreitert sich die Einstellungs-Sidebar.",
                    communityReadOnly: "Community-Assistenten sind Read-Only und können von den Benutzern nicht verändert werden."
                }
            },
            v1_2_3: {
                date: "[1.2.3] 30.01.2025",
                added: {
                    sherlock: "Neuer Community-Assistent Sherlock 🕵️‍♂️. Unterstützt beim Review und der Erstellung von Testfällen. Entwickelt von itm.km73."
                },
                fixed: {
                    brainstormingTitle: "Brainstorming:",
                    darkMode: "Mindmaps werden nun im dunklen Design richtig dargestellt.",
                    simpleLanguageTitle: "Einfache Sprache:",
                    linksIgnored: "Links werden nun beim Übersetzen in einfache Sprache ignoriert. Dies hatte zuvor zu Halluzinationen geführt.",
                    codeCopy: "Es ist nun möglich, partielle Codeblöcke in Chrome zu kopieren. Dies hatte zuvor zu Zeilenumbrüchen nach jedem Wort geführt.",
                    mistralApi: "Ein Fehler bei der Kommunikation mit Mistral-Modellen über die API wurde behoben."
                },
                changed: {
                    brainstormingTitle: "Brainstorming:",
                    mindmapImproved: "Mindmap-Erstellung wurde verbessert. Mehr Kindknoten werden generiert, was zu größeren, detaillierteren Mindmaps führt.",
                    assistantsTitle: "Assistenten:",
                    multipleChats:
                        "Assistenten können nun mehrere Chatverläufe haben. Ähnlich wie bei der Chatfunktion kann ein Chatverlauf umbenannt und favorisiert werden. Die Daten werden ausschließlich lokal im Browser gespeichert.",
                    simpleLanguageTitle: "Einfache Sprache:",
                    titleRenamed:
                        "Der Titel des <i>leichte Sprache</i> Beispiels wurde umbenannt. Es handelt sich hierbei richtigerweise um einen Artikel zum Arbeitsschutzgesetz.",
                    uiImprovementsTitle: "Generelle Oberflächenverbesserungen:",
                    sidebar: "Jede Funktion (z.B. Chat, Zusammenfassen) hat nun die Aktionselemente in einer immer geöffneten Sidebar auf der linken Seite.",
                    storage:
                        "Das lokale Speichermanagement in der Browserdatenbank wurde verbessert und vereinheitlicht. Bestehende Daten (alte Chats und Assistenten) werden migriert. ⚠ Konversationen in <i>Zusammenfassen</i>, <i>Brainstorming</i> und <i>Einfache Sprache</i> bleiben nicht erhalten."
                }
            },
            v1_2_2: {
                date: "[1.2.2] 07.11.2024",
                added: {
                    customAssistants:
                        "Es besteht nun die Möglichkeit, eigene Assistenten zu erstellen. Diese Funktion ermöglicht es den Benutzern, für wiederkehrende Aufgaben spezialisierte Assistenten zu entwickeln, die mit einem Systemprompt ausgestattet sind.",
                    examplesTitle: "Beispiele für Assistenten sind:",
                    translator: "Englisch-Übersetzer: Übersetzt alle Eingaben ins Englische.",
                    testGenerator: "Testgenerator: Erstellt hilfreiche Testfälle basierend auf dem eingegebenen Programmcode.",
                    editor: "Lektor: Korrigiert eingegebene Texte und schlägt alternative Formulierungen vor.",
                    creation:
                        "Um einen Assistenten zu erstellen, beschreibt der Benutzer die gewünschte Funktion in einem Textfeld. MUCGPT generiert daraufhin einen passenden Titel, eine Beschreibung und einen Systemprompt, die anschließend weiter angepasst werden können."
                },
                fixed: {
                    frontendBugs: "Verschiedene Fehler im Frontend wurden behoben."
                },
                changed: {
                    design: "Das Design der Benutzeroberfläche von MUCGPT wurde aktualisiert.",
                    arielle: '🧜‍♀️ Arielle, die Diagramm-Assistentin, ist jetzt unter "Community Assistenten" zu finden und nicht mehr im Chat.'
                }
            },
            v1_2_1: {
                date: "[1.2.1] 27.09.2024",
                added: {
                    simpleLanguageFeature:
                        'Neben den Funktionen Chat, Zusammenfassen und Brainstorming bieten wir nun als viertes Feature "Leichte Sprache" an.',
                    simpleLanguageAlt: "Bild zur Leichten Sprache",
                    chat: "Über einen Chat können Texte an das Sprachmodell gesendet werden, die in leichte oder einfache Sprache übersetzt werden.",
                    selection: "Oben rechts können Sie auswählen, ob der Text in leichte oder einfache Sprache übersetzt werden soll.",
                    easyLanguageDef:
                        "Einfache Sprache ist eine vereinfachte Form der Standardsprache, die auf Komplexität verzichtet, um eine breitere Zielgruppe zu erreichen.",
                    plainLanguageDef: "Leichte Sprache verwendet einfache Wörter und kurze Sätze, um Informationen klar und verständlich zu vermitteln.",
                    modelRecommendation:
                        'Das Feature "Leichte Sprache" nutzt dasselbe Sprachmodell wie die anderen Features, das über die Einstellungen ausgewählt wird. Wir empfehlen jedoch für die Nutzung von "Leichte Sprache" die Modelle <strong>mistral-large-2407</strong> oder <strong>gpt-4o</strong> zu verwenden.'
                },
                fixed: {
                    serviceNowRedirect:
                        "Benutzer, die sich noch nicht in ServiceNow für MUCGPT registriert haben, werden beim Aufrufen des Dienstes automatisch zu ServiceNow weitergeleitet.",
                    performance: "Die Performance bei längeren Chats mit einer hohen Anzahl an generierten Tokens wurde optimiert."
                }
            },
            v1_2_0: {
                date: "[1.2.0] 18.09.2024",
                fixed: {
                    codeDisplay: "Generierter Code wurde manchmal nicht korrekt dargestellt (Klammern entfernt)."
                }
            },
            v1_1_4: {
                date: "[1.1.4] 11.09.2024",
                fixed: {
                    versionNumber: "Versionsnummer wird wieder richtig gespeichert und in den Einstellungen angezeigt.",
                    tokenSplit:
                        "Maximale Tokens aus der Config aufgeteilt in Input- und Output-Tokens. Dadurch laufen Modelle mit kleineren Kontextfenstern (wie z.B. Mistral) nicht mehr in einen Fehler."
                }
            },
            v1_1_3: {
                date: "[1.1.3] 28.08.2024",
                added: {
                    modelSelection:
                        "Benutzer haben nun die Möglichkeit, zwischen 3 verschiedenen Sprachmodellen zu wählen, welches für ihren Anwendungsfall am besten passt."
                },
                changed: {
                    defaultModel: "Das standardmäßig benutzte Sprachmodell wurde von GPT-3.5 auf die neuere Version GPT-4o-mini geändert.",
                    summarizeTitle: 'Verbesserung der "Zusammenfassen"-Funktion:',
                    fewerErrors: "Weniger Fehler",
                    reliableSummaries: "Zuverlässigere Zusammenfassungen in der gewünschten Struktur"
                }
            },
            v1_1_2: {
                date: "[1.1.2] 31.07.2024",
                added: {
                    chatHistory: "Für die Chat-Funktion gibt es nun eine Historie aller durchgeführten Konversationen.",
                    autoSave: 'Alle Chat-Verläufe im Tab "Chat" werden automatisch gespeichert.',
                    management: 'Chats können im "Historie"-Fenster gelöscht, umbenannt oder favorisiert werden.',
                    favorites: "Favorisierte Chats werden immer ganz oben angezeigt.",
                    sorting:
                        'Die Chats werden nach dem letzten Bearbeitungszeitpunkt sortiert und gruppiert in "Heute", "Gestern", "Letzte 7 Tage" und "Älter".'
                }
            },
            v1_1_1: {
                date: "[1.1.1] 04.06.2024",
                added: {
                    errorHint: "Neuer Hinweis im Antwortfeld vom Chat: MUCGPT macht Fehler."
                },
                fixed: {
                    systempromptHelp: "Der Hilfstext für den Systemprompt ist nicht mehr transparent."
                },
                changed: {
                    arielleDescription: "Die Beschreibung des Arielle-Chat-Beispiels wurde verbessert."
                }
            },
            v1_1_0: {
                date: "[1.1.0] 22.05.2024",
                added: {
                    chatSummarizeBrainstormTitle: "Chat/Zusammenfassen/Brainstorming:",
                    recallMessages:
                        "Eigene Nachrichten können zurückgenommen werden. Beim Klicken des entsprechenden Buttons werden alle darunter liegenden Nachrichten und die ausgewählte Nachricht gelöscht. In das Eingabefeld wird die ausgewählte Nachricht eingefügt und kann abgeändert werden:",
                    browserCache: "Der aktuelle Chatverlauf wird im Browser zwischengespeichert und bleibt somit beim Verlassen der Seite bestehen.",
                    updateHistory: "Was gibt's Neues?: Updatehistorie kann angezeigt werden.",
                    chatTitle: "Chat:",
                    suggestedResponses:
                        "Auf eine Antwort von MUCGPT werden nun <b>Antwortmöglichkeiten</b> vorgeschlagen. Beim Auswählen einer Antwortmöglichkeit wird ein entsprechender Prompt in das Eingabefeld geladen:",
                    mermaidDiagrams: "<b>Mermaid-Diagramme</b> können im Chat angezeigt und heruntergeladen werden.",
                    arielle: "Es gibt Arielle, die Diagramm-Assistentin. Diese begleitet den Nutzer beim Erstellen von Mermaid-Diagrammen.",
                    systempromptSpace: "Mehr Platz für die Eingabe des Systemprompts.",
                    systempromptWarning: "Warnmeldung wird angezeigt, falls ein Systemprompt gesetzt ist.",
                    temperatureDescription: "Bessere Beschreibungen für die Temperatureinstellung."
                },
                fixed: {
                    systempromptToken: "Der Systemprompt wird nun ins Tokenlimit miteinbezogen."
                }
            },
            v1_0_0: {
                date: "[1.0.0] 26.02.2024",
                added: {
                    production: "Produktivumgebung aufgebaut.",
                    faq: "FAQ wurde ergänzt.",
                    communityExamples: "Chat-Beispiele von der Community wurden eingepflegt."
                },
                fixed: {
                    streamingErrors: "Fehlermeldungen anzeigen, falls das Sprachmodell während des Streamings überlastet ist.",
                    typos: "Rechtschreibfehler in Hilfetexten verbessert."
                },
                changed: {
                    termsDaily: "Nutzungsbedingungen müssen nun einmal am Tag bestätigt werden.",
                    termsUpdated: "Nutzungsbedingungen wurden ergänzt.",
                    servicedesk: "Hinweis auf Servicedesk.",
                    wilmaLink: "Link zum Wilma-Arbeitsraum."
                }
            },
            v0_3_0: {
                date: "[0.3.0] 06.02.2024",
                added: {
                    settingsSaved: "Bereits getätigte Einstellungen werden gespeichert (z.B. Sprache, Systemprompt, Nutzungsbedingungen gelesen).",
                    accessibilityTitle: "Barrierefreiheit:",
                    screenreader: "Optimierte Darstellung für Screenreader.",
                    colorblind: "Bessere Unterscheidbarkeit für Farbenblinde.",
                    highContrast: "Unterstützung von Windows High Contrast Mode.",
                    moreOptimizations: "Und noch viele weitere Optimierungen ..."
                },
                fixed: {
                    inlineCode:
                        "Als Code (mit Single-Backticks, ` ) formatierte Wörter in Antworten werden nun nicht mehr als Codeblock dargestellt, da dies zu sehr den Lesefluss gestört hat."
                },
                changed: {
                    brainstormTitle: "Brainstorm:",
                    mindmapDownload: "Mindmaps sind nun im .mm-Format herunterladbar und können mit dem Mindmap-Tool Freeplane weiterverarbeitet werden.",
                    summarizeTitle: "Zusammenfassen:",
                    summaryLength:
                        "Die Länge der Zusammenfassung hängt nun von der Gesamtlänge des Eingabetexts ab - längere Eingabetexte führen zu längeren Zusammenfassungen.",
                    detailLevel: "Der Detaillierungsgrad (kurz, mittel, lang) lässt sich über eine eigene Einstellung setzen.",
                    designUnified: "Design vereinheitlicht.",
                    darkMode: "Dark Mode hinzugefügt.",
                    termsUpdated: "Nutzungsbedingungen aktualisiert."
                }
            },
            v0_2_0: {
                date: "[0.2.0] 06.02.2024",
                subtitle: "❄Neujahrsupdate❄",
                added: {
                    markdownTitle: "Bessere Darstellung von Antworten, die Markdown enthalten:",
                    codeLanguage: "Bei Codeblöcken wird die Programmiersprache mit angezeigt.",
                    lineNumbers: "Bei Codeblöcken werden die Zeilennummern mit angegeben.",
                    summarizeTitle: "Zusammenfassen:",
                    copySummary: "Zusammenfassungen können kopiert werden.",
                    noTokenLimit: "Tokenlimit (Wörterlimit) wurde entfernt.",
                    pdfUpload: "Es können PDFs hochgeladen werden, die anschließend zusammengefasst werden.",
                    chatTitle: "Chat:",
                    unformattedView:
                        "Antworten können nun optional unformatiert angezeigt werden (Alternative zur automatischen Darstellung als HTML/Markdown).",
                    moreSettingsTitle: "Mehr Einstellungen für den Chat:",
                    temperature: "Temperatur: Kreativität der Antworten festlegen.",
                    maxLength: "Maximale Antwortlänge.",
                    systemprompt: "Systemprompt: Verhalten des Sprachmodells festlegen, indem man z.B. eine bestimmte Rolle vergibt."
                },
                fixed: {
                    textFieldGrowth: "Bei längeren Eingaben ist das Eingabetextfeld nicht mitgewachsen.",
                    htmlEntities:
                        "Falls Antworten HTML enthalten wie &lt;, wird dies nicht mehr in &amp;lt; übersetzt. R-Skripte oder Bash Skripte sollten nun wieder korrekt generiert werden.",
                    codeBlockWrapping:
                        "Generierte Antworten mit Codeblöcken in Markdown: Falls keine Sprache im zurückgegebenen Codeblock definiert war und dieser sehr lange Zeilen enthalten hat, gab es keinen Zeilenumbruch.",
                    authExpiration:
                        "Falls die Authentifizierungsinformationen ausgelaufen sind (Fenster zu lange offen ohne Interaktion), wird die Seite neu geladen."
                }
            }
        }
    },
    EN: {
        versions: {
            v2_0: {
                date: "[2.0] 15.10.2025",
                communityAssistants: {
                    title: "Community Assistants",
                    share: "Custom assistants can be shared as community assistants.",
                    subscribe: "Community assistants can be subscribed to.",
                    searchable: "Community assistants are searchable.",
                    manage: "Community assistants can be managed and deleted."
                },
                tools: {
                    title: "Tools",
                    brainstorming: "New brainstorming tool: an agent system creates new mindmaps or expands existing mindmaps.",
                    fullscreen: "Fullscreen view for generated brainstorming mindmaps.",
                    simplify:
                        'New "Simplify" tool: Iteratively simplifies texts according to plain-language rules, criticizes and improves texts and repeats the process until the result is satisfactory.',
                    interfaces: "In future many different interfaces and applications can be connected to MUCGPT."
                },
                misc: {
                    title: "Misc",
                    mermaid: "Improved rendering of Mermaid diagrams (including zoom controls).",
                    username: "Display of the username from Single Sign-On.",
                    tutorial: "Start of an interactive tutorial in MUCGPT that explains how language models and systems like MUCGPT work."
                },
                redesign: {
                    title: "Start of the redesign",
                    languageSelection: "Improved language selection.",
                    settings: "Settings were moved to the navigation bar / footer."
                },
                technical: {
                    title: "Technical changes",
                    services: "Split into multiple services; full operation is now possible locally (SSO, API gateway, ...).",
                    agents: "The system is now based on an agent-based approach."
                },
                changed: {
                    summarizeRemoved: "Summarize feature was removed"
                }
            },
            v1_2_5: {
                date: "[1.2.5] 24.04.2025",
                fixed: {
                    tokenSetting: "Fixed bug when setting the token count in the assistant chat.",
                    messageRecall: 'Fixed issue with "recall message" and "regenerate message" for the first message.',
                    messageDisplay: "Fixed issue displaying the generation of a message.",
                    latex: "Mathematical formulas are now rendered correctly with LaTeX.",
                    latexAlt: "Image of mathematical formulas in MUCGPT"
                },
                changed: {
                    simpleLanguagePrompt: "The prompt for <i>simple language</i> was adjusted to new guidelines.",
                    generalImprovements: "General improvements to the user interface and source code."
                }
            },
            v1_2_4: {
                date: "[1.2.4] 4.03.2025",
                added: {
                    communityAssistantsTitle: "Community Assistants:",
                    examplesAndSuggestions: "Community assistants can now have their own examples and suggested answers.",
                    newVersionsTitle: "New versions of community assistants",
                    sherlock: "Sherlock🕵Test case generator: Creates and exports test cases. By itm.km73",
                    consultor: "Consultor: Advises on the offering from consult.in.M. By consult.in.M",
                    arielle: "🧜Arielle: Creates Mermaid diagrams",
                    centralConfig: "Community assistants can be centrally configured and always use the latest version"
                },
                fixed: {
                    performance: "Performance issues with long chats (more than 20k tokens).",
                    policyViolation:
                        'If a prompt is identified as dangerous, the response now only returns "A policy violation was detected and the chat is terminated here".',
                    codeBlocks: "Code blocks now adapt to the font size.",
                    settingsButton: '"Settings & Feedback" button now stays in the header when increasing the font size.',
                    versionFaq: "Version & FAQ: style adjusted and spelling/grammar mistakes corrected.",
                    tokenUsageTitle: "Token usage:",
                    tokenDisplay: "Fixed display issue when reloading.",
                    tokenRemoved: "Token usage removed from the <i>Summarize</i> and <i>Brainstorming</i> features.",
                    tokenHidden: "If no tokens are used, the token usage is not shown to provide a cleaner UI.",
                    typos: "Numerous spelling and grammar mistakes were corrected."
                },
                changed: {
                    simpleLanguageTitle: "Simple language:",
                    easyLanguageRemoved:
                        "<i>Easy language</i> was removed because we cannot provide a complete translation into easy language and the name is therefore misleading.",
                    simpleLanguagePrompt: "The prompt for <i>simple language</i> was adapted and expanded.",
                    ownAssistantsTitle: "Custom assistants:",
                    settingsEditOnly: "Settings like <i>system prompt</i> or <i>maximum token count</i> are only shown when editing.",
                    sidebarExpands: "When editing an assistant the settings sidebar expands.",
                    communityReadOnly: "Community assistants are read-only and cannot be changed by users."
                }
            },
            v1_2_3: {
                date: "[1.2.3] 30.01.2025",
                added: {
                    sherlock: "New community assistant Sherlock 🕵️‍♂️. Helps review and create test cases. Developed by itm.km73."
                },
                fixed: {
                    brainstormingTitle: "Brainstorming:",
                    darkMode: "Mindmaps are now displayed correctly in dark mode.",
                    simpleLanguageTitle: "Simple language:",
                    linksIgnored: "Links are now ignored when translating to simple language. This previously led to hallucinations.",
                    codeCopy: "It is now possible to copy partial code blocks in Chrome. Previously this caused line breaks after every word.",
                    mistralApi: "Fixed an error in communication with Mistral models via the API."
                },
                changed: {
                    brainstormingTitle: "Brainstorming:",
                    mindmapImproved: "Mindmap generation was improved. More child nodes are generated, resulting in larger, more detailed mindmaps.",
                    assistantsTitle: "Assistants:",
                    multipleChats:
                        "Assistants can now have multiple chat histories. Similar to the chat feature, a chat history can be renamed and favorited. Data is stored locally in the browser only.",
                    simpleLanguageTitle: "Simple language:",
                    titleRenamed:
                        "The title of the <i>easy language</i> example was renamed. It is actually an article about the Occupational Health and Safety Act.",
                    uiImprovementsTitle: "General UI improvements:",
                    sidebar: "Each feature (e.g., Chat, Summarize) now has action elements in a permanently opened sidebar on the left.",
                    storage:
                        "Local storage management in the browser database was improved and standardized. Existing data (old chats and assistants) are migrated. ⚠ Conversations in <i>Summarize</i>, <i>Brainstorming</i> and <i>Simple language</i> will not be preserved."
                }
            },
            v1_2_2: {
                date: "[1.2.2] 07.11.2024",
                added: {
                    customAssistants:
                        "It is now possible to create custom assistants. This feature allows users to develop specialized assistants for recurring tasks that come with a system prompt.",
                    examplesTitle: "Examples of assistants include:",
                    translator: "English translator: Translates all input into English.",
                    testGenerator: "Test generator: Creates helpful test cases based on the entered source code.",
                    editor: "Editor: Proofreads entered texts and suggests alternative formulations.",
                    creation:
                        "To create an assistant the user describes the desired function in a text field. MUCGPT then generates a suitable title, description and a system prompt which can be further edited."
                },
                fixed: {
                    frontendBugs: "Various frontend bugs were fixed."
                },
                changed: {
                    design: "The design of the MUCGPT user interface was updated.",
                    arielle: '🧜‍♀️ Arielle, the diagram assistant, is now listed under "Community Assistants" and no longer in the chat.'
                }
            },
            v1_2_1: {
                date: "[1.2.1] 27.09.2024",
                added: {
                    simpleLanguageFeature: 'In addition to Chat, Summarize and Brainstorming, we now offer "Plain Language" as a fourth feature.',
                    simpleLanguageAlt: "Image for Plain Language",
                    chat: "Via a chat texts can be sent to the language model which are translated into plain or simple language.",
                    selection: "In the top right you can choose whether the text should be translated into plain or simple language.",
                    easyLanguageDef: "Simple language is a simplified form of standard language that avoids complexity to reach a broader audience.",
                    plainLanguageDef: "Plain Language uses simple words and short sentences to communicate information clearly and understandably.",
                    modelRecommendation:
                        'The "Plain Language" feature uses the same language model as the other features selectable in the settings. However, we recommend the models <strong>mistral-large-2407</strong> or <strong>gpt-4o</strong> for this feature.'
                },
                fixed: {
                    serviceNowRedirect:
                        "Users who haven't registered in ServiceNow for MUCGPT are automatically redirected to ServiceNow when accessing the service.",
                    performance: "Performance for longer chats with a high number of generated tokens was optimized."
                }
            },
            v1_2_0: {
                date: "[1.2.0] 18.09.2024",
                fixed: {
                    codeDisplay: "Generated code was sometimes not displayed correctly (brackets removed)."
                }
            },
            v1_1_4: {
                date: "[1.1.4] 11.09.2024",
                fixed: {
                    versionNumber: "Version number is saved correctly again and shown in the settings.",
                    tokenSplit:
                        "Maximum tokens from the config split into input and output tokens. This prevents models with smaller context windows (e.g., Mistral) from failing."
                }
            },
            v1_1_3: {
                date: "[1.1.3] 28.08.2024",
                added: {
                    modelSelection: "Users can now choose between 3 different language models to find the one that best fits their use case."
                },
                changed: {
                    defaultModel: "The default language model was changed from GPT-3.5 to the newer GPT-4o-mini.",
                    summarizeTitle: 'Improvement of the "Summarize" feature:',
                    fewerErrors: "Fewer errors",
                    reliableSummaries: "More reliable summaries in the desired structure"
                }
            },
            v1_1_2: {
                date: "[1.1.2] 31.07.2024",
                added: {
                    chatHistory: "A history of all conversations is now available for the Chat feature.",
                    autoSave: 'All chat histories in the "Chat" tab are automatically saved.',
                    management: 'Chats can be deleted, renamed or favorited in the "History" window.',
                    favorites: "Favorited chats are always shown at the top.",
                    sorting: 'Chats are sorted by last edited time and grouped into "Today", "Yesterday", "Last 7 days" and "Older".'
                }
            },
            v1_1_1: {
                date: "[1.1.1] 04.06.2024",
                added: {
                    errorHint: "New hint in the chat response field: MUCGPT makes mistakes."
                },
                fixed: {
                    systempromptHelp: "The help text for the system prompt is no longer transparent."
                },
                changed: {
                    arielleDescription: "The description of the Arielle chat example was improved."
                }
            },
            v1_1_0: {
                date: "[1.1.0] 22.05.2024",
                added: {
                    chatSummarizeBrainstormTitle: "Chat/Summarize/Brainstorming:",
                    recallMessages:
                        "Users can recall their own messages. Clicking the corresponding button deletes the selected message and all messages below it. The selected message is inserted into the input field and can be edited:",
                    browserCache: "The current chat is cached in the browser so it persists when leaving the page.",
                    updateHistory: "What's new?: Update history can be displayed.",
                    chatTitle: "Chat:",
                    suggestedResponses:
                        "MUCGPT now suggests <b>response options</b> to a reply. Selecting an option loads a corresponding prompt into the input field:",
                    mermaidDiagrams: "<b>Mermaid diagrams</b> can be displayed and downloaded in the chat.",
                    arielle: "There is Arielle, the diagram assistant. She guides the user in creating Mermaid diagrams.",
                    systempromptSpace: "More space for entering the system prompt.",
                    systempromptWarning: "A warning is shown if a system prompt is set.",
                    temperatureDescription: "Better descriptions for the temperature setting."
                },
                fixed: {
                    systempromptToken: "The system prompt is now included in the token limit."
                }
            },
            v1_0_0: {
                date: "[1.0.0] 26.02.2024",
                added: {
                    production: "Production environment set up.",
                    faq: "FAQ was added.",
                    communityExamples: "Chat examples from the community were included."
                },
                fixed: {
                    streamingErrors: "Show error messages if the language model is overloaded during streaming.",
                    typos: "Spelling mistakes in help texts fixed."
                },
                changed: {
                    termsDaily: "Terms of use must now be confirmed once a day.",
                    termsUpdated: "Terms of use were updated.",
                    servicedesk: "Note about the service desk.",
                    wilmaLink: "Link to the Wilma workspace."
                }
            },
            v0_3_0: {
                date: "[0.3.0] 06.02.2024",
                added: {
                    settingsSaved: "Previously set options are saved (e.g., language, system prompt, terms accepted).",
                    accessibilityTitle: "Accessibility:",
                    screenreader: "Optimized rendering for screen readers.",
                    colorblind: "Improved distinguishability for colorblind users.",
                    highContrast: "Support for Windows High Contrast Mode.",
                    moreOptimizations: "And many more optimizations ..."
                },
                fixed: {
                    inlineCode:
                        "Words formatted as code (with single backticks, ` ) in responses are no longer rendered as a code block, as this disrupted the reading flow too much."
                },
                changed: {
                    brainstormTitle: "Brainstorm:",
                    mindmapDownload: "Mindmaps are now downloadable in .mm format and can be further processed with the Freeplane mindmap tool.",
                    summarizeTitle: "Summarize:",
                    summaryLength: "The length of the summary now depends on the total length of the input text - longer inputs lead to longer summaries.",
                    detailLevel: "The level of detail (short, medium, long) can be set via a dedicated setting.",
                    designUnified: "Design unified.",
                    darkMode: "Dark mode added.",
                    termsUpdated: "Terms of use updated."
                }
            },
            v0_2_0: {
                date: "[0.2.0] 06.02.2024",
                subtitle: "❄New Year update❄",
                added: {
                    markdownTitle: "Better rendering of responses that contain Markdown:",
                    codeLanguage: "Programming language is shown for code blocks.",
                    lineNumbers: "Line numbers are shown for code blocks.",
                    summarizeTitle: "Summarize:",
                    copySummary: "Summaries can be copied.",
                    noTokenLimit: "Token limit (word limit) was removed.",
                    pdfUpload: "PDFs can be uploaded and then summarized.",
                    chatTitle: "Chat:",
                    unformattedView: "Responses can now optionally be shown unformatted (an alternative to automatic rendering as HTML/Markdown).",
                    moreSettingsTitle: "More settings for the chat:",
                    temperature: "Temperature: Set creativity of responses.",
                    maxLength: "Maximum response length.",
                    systemprompt: "System prompt: Define the language model's behavior by e.g. assigning a specific role."
                },
                fixed: {
                    textFieldGrowth: "Input field did not grow with longer inputs.",
                    htmlEntities:
                        "If responses contained HTML like <, it was no longer escaped to &amp;lt;. R scripts or Bash scripts should now be generated correctly again.",
                    codeBlockWrapping:
                        "Generated responses with code blocks in Markdown: If no language was defined in the returned code block and it contained very long lines, there was no line wrapping.",
                    authExpiration: "If authentication information expired (window open too long without interaction), the page is reloaded."
                }
            }
        }
    },
    BA: {
        versions: {
            v2_0: {
                date: "[2.0] 15.10.2025",
                communityAssistants: {
                    title: "Community-Assistentn",
                    share: "Eigene Assistentn kenna als Community-Assistentn gmoinsam gnutzt wern.",
                    subscribe: "Community-Assistentn kenna abonniert wern.",
                    searchable: "Community-Assistentn san durchsuachbar.",
                    manage: "Community-Assistentn kenna valwoitet und glöscht wern."
                },
                tools: {
                    title: "Werkzeig",
                    brainstorming: "Neis Brainstorming-Werkzeig: A Agentnsystem erstöit neie Mindmaps oder erweitert vorhandene Mindmaps.",
                    fullscreen: "Voibuidoasicht fia generierte Brainstorming-Mindmaps.",
                    simplify:
                        'Neis "Vaoafochn"-Werkzeig: Vaoafocht Texte iterativ noch Regln fia oafoche Sproch, kritisiert und vabessert Texte und wiedahoits den Prozess, bis des Ergebnis basst.',
                    interfaces: "Perspektivisch kenna vui vaschiedene Schnittstöin und Owendunga o MUCGPT ogbundn wern."
                },
                misc: {
                    title: "Diverses",
                    mermaid: "Vabesserte Doarstöiung vo Mermaid-Diagramma (inkl. Steiaung zum Zooma).",
                    username: "Oazoag vom Benutzanoma aus Single Sign-On.",
                    tutorial: "Ofang vo oam interaktivm Tutorial in MUCGPT, des erklärt, wia Sprochmodöi und Systeme wia MUCGPT funktionieren."
                },
                redesign: {
                    title: "Ofang vom Redesign",
                    languageSelection: "Vabesserte Sprochwoi.",
                    settings: "Oistöiunga san jetzt in da Navigationsleistn / im Footer."
                },
                technical: {
                    title: "Technische Änderunga",
                    services: "Aufteilung in mehrere Services; komplettn Betrieb is jetzt lokal meglich (SSO, API-Gateway, ...).",
                    agents: "Des System basiert jetzt auf oam agentnbasierten Oasatz."
                },
                changed: {
                    summarizeRemoved: "Zammfossn wurd entfernt"
                }
            },
            v1_2_5: {
                date: "[1.2.5] 24.04.2025",
                fixed: {
                    tokenSetting: "Fehla beim Oistöin vo da Tokenanzoi im Assistentncht gfixt.",
                    messageRecall: 'Fehla mit "Nochricht zruckrufn" und "Nochricht nei generieren" vo da erstn Nochricht gfixt.',
                    messageDisplay: "Fehla beim Doarstöin vom Generieren vo oana Nochricht wurd behobn.",
                    latex: "Mathematische Formln wern jetzt mit LaTeX korrekt grendert.",
                    latexAlt: "Buid vo mathematische Formln in MUCGPT"
                },
                changed: {
                    simpleLanguagePrompt: "Da Prompt fia <i>oafoche Sproch</i> wurd o neie Guidelines ogpasst.",
                    generalImprovements: "Oigmoane Vabessarunga vo da Benutzaobaflächn und vom Quöicode."
                }
            },
            v1_2_4: {
                date: "[1.2.4] 4.03.2025",
                added: {
                    communityAssistantsTitle: "Community Assistentn:",
                    examplesAndSuggestions: "Community-Assistentn kenna jetzt eigene Beispui und voagschlogene Ontwortn hom.",
                    newVersionsTitle: "Neie Versionn vo Community-Assistentn",
                    sherlock: "Sherlock🕵Testfoigenerator: Erstöit und exportiert Testfäi. Vo itm.km73",
                    consultor: "Consultor: Berot zum Ogebot vo consult.in.M. Vo consult.in.M",
                    arielle: "🧜Arielle: Erstöit Mermaid Diagramma",
                    centralConfig: "Community-Assistentn kenna zentral konfiguriert wern und es werd stets de neiaste Version verwendet"
                },
                fixed: {
                    performance: "Performanceprobleme bei long Chats (mehr ois 20k Tokens).",
                    policyViolation:
                        'Werd a Prompt ois gfährlich identifiziert, werd jetzt nua no "Es wurd a Richtlinienvastoß festgstöit und da Chat werd do beendet" zruckgem.',
                    codeBlocks: "Code-Blöcke passn se jetzt o de Schriftgress o.",
                    settingsButton: '"Oistöiunga & Feedback"-Button bleibm jetzt im Header beim Vagrößan vo da Schriftgress.',
                    versionFaq: "Version & FAQ: Stil ogpasst sowie Rechtschreib- und Grammatikfehla korrigiert.",
                    tokenUsageTitle: "Token-Nutzung:",
                    tokenDisplay: "Oazogproblem beim Neiloda behobn.",
                    tokenRemoved: "Token-Usage aus de Features <i>Zammfossn</i> und <i>Brainstorming</i> entfernt.",
                    tokenHidden: "Wenna kane Tokens verwendet wern, werd de Token-Usage ned oazoagt, um a übersichtlichere Obaflächn z'bietn.",
                    typos: "Zoireicha Rechtschreib- und Grammatikfehla wurdn korrigiert."
                },
                changed: {
                    simpleLanguageTitle: "Oafoche Sproch:",
                    easyLanguageRemoved:
                        "<i>Leichte Sproch</i> wurd entfernt, weu ma kane voiständige Übersetzung in leichte Sproch durchführn kenna und da Nama deswegn irreführend is.",
                    simpleLanguagePrompt: "Da Prompt fia <i>oafoche Sproch</i> wurd ogpasst und erweitert.",
                    ownAssistantsTitle: "Eigene Assistentn:",
                    settingsEditOnly: "Oistöiunga wia <i>System-Prompt</i> oda <i>Maximale Token-Anzoi</i> wern nua beim Beorbeitn oazoagt.",
                    sidebarExpands: "Beim Beorbeitn vo oam Assistentn vabreitert se de Oistöiungs-Sidebar.",
                    communityReadOnly: "Community-Assistentn san Read-Only und kenna vo de Benutzar ned vaändert wern."
                }
            },
            v1_2_3: {
                date: "[1.2.3] 30.01.2025",
                added: {
                    sherlock: "Neia Community-Assistent Sherlock 🕵️‍♂️. Unterstützt beim Review und da Erstöiung vo Testfäin. Entwickelt vo itm.km73."
                },
                fixed: {
                    brainstormingTitle: "Brainstorming:",
                    darkMode: "Mindmaps wern jetzt im dunkln Design richtig doagstöit.",
                    simpleLanguageTitle: "Oafoche Sproch:",
                    linksIgnored: "Links wern jetzt beim Übersetzn in oafoche Sproch ignoriert. Des hod zuvor zu Halluzinationen gführt.",
                    codeCopy: "Es is jetzt meglich, partiöie Codeblöcke in Chrome z'kopiern. Des hod zuvor zu Zeilenumbriachn noch jedem Wort gführt.",
                    mistralApi: "A Fehla bei da Kommunikation mit Mistral-Modöin üba de API wurd behobn."
                },
                changed: {
                    brainstormingTitle: "Brainstorming:",
                    mindmapImproved: "Mindmap-Erstöiung wurd vabessert. Mehr Kindknoten wern generiert, wos zu größeren, detaillierteren Mindmaps führt.",
                    assistantsTitle: "Assistentn:",
                    multipleChats:
                        "Assistentn kenna jetzt mehrere Chatvaläufe hom. Ähnlich wia bei da Chatfunktion ko a Chatvalaaf umgnennt und favorisiert wern. De Datn wern ausschließlich lokal im Browser gspeicha.",
                    simpleLanguageTitle: "Oafoche Sproch:",
                    titleRenamed:
                        "Da Tite vom <i>leichte Sproch</i> Beispui wurd umgnennt. Es handelt se hierbei richtigerweise um an Artikel zum Arbeitsschutzgsetz.",
                    uiImprovementsTitle: "Generöie Obaflächnvabessarunga:",
                    sidebar: "Jede Funktion (z.B. Chat, Zammfossn) hod jetzt de Aktionselementa in oana imma geffnetn Sidebar auf da linkn Seitn.",
                    storage:
                        "Des lokale Speichermanagement in da Browserdatenbank wurd vabessert und vaeinheitlicht. Vorhandene Datn (oide Chats und Assistentn) wern migriert. ⚠ Konversationn in <i>Zammfossn</i>, <i>Brainstorming</i> und <i>Oafoche Sproch</i> bleim ned erhoitn."
                }
            },
            v1_2_2: {
                date: "[1.2.2] 07.11.2024",
                added: {
                    customAssistants:
                        "Es gibt jetzt de Meglichkeit, eigene Assistentn z'erstöin. De Funktion ermöglicht's de Benutzar, fia wiederkehrende Aufgom spezialisierte Assistentn z'entwickln, de mit oam Systemprompt ausgstoattet san.",
                    examplesTitle: "Beispui fia Assistentn san:",
                    translator: "Englisch-Übersetza: Übersetzt oie Eingom ins Englische.",
                    testGenerator: "Testgenerator: Erstöit hilfreicha Testfäi basierend auf dem eiggebenen Programmcode.",
                    editor: "Lektor: Korrigiert eiggebene Texte und schlagt oiternative Formulierunga vor.",
                    creation:
                        "Um an Assistentn z'erstöin, beschreibt da Benutza de gwünschte Funktion in oam Textföid. MUCGPT generiert donn an passenden Titel, a Beschreibung und an Systemprompt, de oschließend weita ogpasst wern kenna."
                },
                fixed: {
                    frontendBugs: "Vaschiedene Fehla im Frontend wurdn behobn."
                },
                changed: {
                    design: "Des Design vo da Benutzaobaflächn vo MUCGPT wurd aktualisiert.",
                    arielle: '🧜‍♀️ Arielle, de Diagramm-Assistentin, is jetzt unter "Community Assistentn" z\'finden und ned mehr im Chat.'
                }
            },
            v1_2_1: {
                date: "[1.2.1] 27.09.2024",
                added: {
                    simpleLanguageFeature: 'Nebn de Funktiona Chat, Zammfossn und Brainstorming bietn ma jetzt ois viertes Feature "Leichte Sproch" o.',
                    simpleLanguageAlt: "Buid zur Leichten Sproch",
                    chat: "Üba an Chat kenna Texte an des Sprochmodöi gschickt wern, de in leichte oda oafoche Sproch übersetzt wern.",
                    selection: "Obm rechts konnst auswöin, ob da Text in leichte oda oafoche Sproch übersetzt wern soi.",
                    easyLanguageDef:
                        "Oafoche Sproch is a vaoafochte Form vo da Standardsproch, de auf Komplexität vazichtet, um a breitere Zielgruppe z'erreicha.",
                    plainLanguageDef: "Leichte Sproch verwendet oafoche Wörter und kurze Sätze, um Informationa klar und vaständlich z'vamittln.",
                    modelRecommendation:
                        'Des Feature "Leichte Sproch" nutzt des gleiche Sprochmodöi wia de ondern Features, des üba de Oistöiunga ausgwöit werd. Ma empfehln oba fia de Nutzung vo "Leichte Sproch" de Modöie <strong>mistral-large-2407</strong> oda <strong>gpt-4o</strong> z\'vawendn.'
                },
                fixed: {
                    serviceNowRedirect:
                        "Benutzar, de se no ned in ServiceNow fia MUCGPT registriert hom, wern beim Aufruafa vom Dienst automatisch zu ServiceNow weitergeleitet.",
                    performance: "De Performance bei längeren Chats mit oana hohn Anzoi o generierten Tokens wurd optimiert."
                }
            },
            v1_2_0: {
                date: "[1.2.0] 18.09.2024",
                fixed: {
                    codeDisplay: "Generierter Code wurd monchmoi ned korrekt doagstöit (Klammern entfernt)."
                }
            },
            v1_1_4: {
                date: "[1.1.4] 11.09.2024",
                fixed: {
                    versionNumber: "Versionsnummer werd wiedar richtig gspeicha und in de Oistöiunga oazoagt.",
                    tokenSplit:
                        "Maximale Tokens aus da Config aufgteilt in Input- und Output-Tokens. Dodurch laffa Modöie mit kloaneren Kontextfenstan (wia z.B. Mistral) ned mehr in an Fehla."
                }
            },
            v1_1_3: {
                date: "[1.1.3] 28.08.2024",
                added: {
                    modelSelection:
                        "Benutzar hom jetzt de Meglichkeit, zwischen 3 vaschiedenen Sprochmodöin z'wöin, wöiches fia ihrn Owendungsfall am bestn passt."
                },
                changed: {
                    defaultModel: "Des standardmäßig benutzte Sprochmodöi wurd vo GPT-3.5 auf de neuere Version GPT-4o-mini gändert.",
                    summarizeTitle: 'Vabessarung vo da "Zammfossn"-Funktion:',
                    fewerErrors: "Weniga Fehla",
                    reliableSummaries: "Zuaverlässigere Zammfossunga in da gwünschtn Struktur"
                }
            },
            v1_1_2: {
                date: "[1.1.2] 31.07.2024",
                added: {
                    chatHistory: "Fia de Chat-Funktion gibts jetzt a Historie vo oina durchgführten Konversationa.",
                    autoSave: 'Oie Chat-Valäufe im Tab "Chat" wern automatisch gspeicha.',
                    management: 'Chats kenna im "Historie"-Fensta glöscht, umgnennt oda favorisiert wern.',
                    favorites: "Favorisierte Chats wern imma ganz obm oazoagt.",
                    sorting: 'De Chats wern noch dem letztn Beorbeitungszeitpunkt sortiert und gruppiert in "Heit", "Gestern", "Letzte 7 Tag" und "Älta".'
                }
            },
            v1_1_1: {
                date: "[1.1.1] 04.06.2024",
                added: {
                    errorHint: "Neia Hiaweis im Ontwoatföid vom Chat: MUCGPT mocht Fehla."
                },
                fixed: {
                    systempromptHelp: "Da Hüfstext fia den Systemprompt is ned mehr transparent."
                },
                changed: {
                    arielleDescription: "De Beschreibung vom Arielle-Chat-Beispui wurd vabessert."
                }
            },
            v1_1_0: {
                date: "[1.1.0] 22.05.2024",
                added: {
                    chatSummarizeBrainstormTitle: "Chat/Zammfossn/Brainstorming:",
                    recallMessages:
                        "Eigene Nochrichten kenna zruckgnomma wern. Beim Klickn vom entsprechenden Button wern oie druntaliegende Nochrichten und de ausgwöite Nochricht glöscht. Ins Eingobföid werd de ausgwöite Nochricht eigfügt und ko obgändert wern:",
                    browserCache: "Da aktuelle Chatvalaaf werd im Browser zwischengspeicha und bleibt somit beim Valossa vo da Seitn besteh.",
                    updateHistory: "Wos gibts Neis?: Updatehistorie ko oazoagt wern.",
                    chatTitle: "Chat:",
                    suggestedResponses:
                        "Auf a Ontwoat vo MUCGPT wern jetzt <b>Ontwoatmeglichkeitn</b> voagschlogn. Beim Auswöin vo oana Ontwoatmeglichkeit werd a entsprechenda Prompt ins Eingobföid gloda:",
                    mermaidDiagrams: "<b>Mermaid-Diagramma</b> kenna im Chat oazoagt und obagloda wern.",
                    arielle: "Es gibt Arielle, de Diagramm-Assistentin. De begleitet den Nutza beim Erstöin vo Mermaid-Diagramma.",
                    systempromptSpace: "Mehr Platz fia de Eingob vom Systemprompt.",
                    systempromptWarning: "Woarnmöidung werd oazoagt, foisn Systemprompt gsetzt is.",
                    temperatureDescription: "Bessere Beschreibunga fia de Temperatureistellung."
                },
                fixed: {
                    systempromptToken: "Da Systemprompt werd jetzt ins Tokenlimit miteibezoagn."
                }
            },
            v1_0_0: {
                date: "[1.0.0] 26.02.2024",
                added: {
                    production: "Produktivumgebung aufbaut.",
                    faq: "FAQ wurd ergänzt.",
                    communityExamples: "Chat-Beispui vo da Community wurdn eigpflegt."
                },
                fixed: {
                    streamingErrors: "Fehlermöidunga oazoga, foisdes Sprochmodöi während vom Streaming übalastet is.",
                    typos: "Rechtschreibfehla in Hüfstexten vabessert."
                },
                changed: {
                    termsDaily: "Nutzungsbedingunga miassn jetzt amoi am Dog bestätigt wern.",
                    termsUpdated: "Nutzungsbedingunga wurdn ergänzt.",
                    servicedesk: "Hiaweis auf Servicedesk.",
                    wilmaLink: "Link zum Wilma-Arbeitsraum."
                }
            },
            v0_3_0: {
                date: "[0.3.0] 06.02.2024",
                added: {
                    settingsSaved: "Bereits getätigte Oistöiunga wern gspeicha (z.B. Sproch, Systemprompt, Nutzungsbedingunga glesn).",
                    accessibilityTitle: "Barrierefreiheit:",
                    screenreader: "Optimierte Doarstöiung fia Screenreader.",
                    colorblind: "Bessere Unterscheidbarkeit fia Forbnblinde.",
                    highContrast: "Unterstützung vo Windows High Contrast Mode.",
                    moreOptimizations: "Und no vui weitere Optimierunga ..."
                },
                fixed: {
                    inlineCode:
                        "Ois Code (mit Single-Backticks, ` ) formatierte Wörter in Ontwortn wern jetzt ned mehr ois Codeblock doagstöit, wei des zu sehr den Lesefluss gstört hod."
                },
                changed: {
                    brainstormTitle: "Brainstorm:",
                    mindmapDownload: "Mindmaps san jetzt im .mm-Format obalodbor und kenna mit dem Mindmap-Tool Freeplane weitervaorbeit wern.",
                    summarizeTitle: "Zammfossn:",
                    summaryLength:
                        "De Länge vo da Zammfossung hängt jetzt vo da Gsamtlänge vom Eingobtext ob - längere Eigobtexte führn zu längern Zammfossunga.",
                    detailLevel: "Da Detaillierungsgrad (kurz, mitte, long) losst se üba a eigene Oistöiung setzn.",
                    designUnified: "Design vaeinheitlicht.",
                    darkMode: "Dark Mode hinzugfügt.",
                    termsUpdated: "Nutzungsbedingunga aktualisiert."
                }
            },
            v0_2_0: {
                date: "[0.2.0] 06.02.2024",
                subtitle: "❄Neijoahrsupdate❄",
                added: {
                    markdownTitle: "Bessere Doarstöiung vo Ontwortn, de Markdown enthoitn:",
                    codeLanguage: "Bei Codeblöckn werd de Programmiersproch mit oazoagt.",
                    lineNumbers: "Bei Codeblöckn wern de Zeilennumman mit ogem.",
                    summarizeTitle: "Zammfossn:",
                    copySummary: "Zammfossunga kenna kopiert wern.",
                    noTokenLimit: "Tokenlimit (Wörtalimit) wurd entfernt.",
                    pdfUpload: "Es kenna PDFs obogloda wern, de oschließend zammgfosst wern.",
                    chatTitle: "Chat:",
                    unformattedView: "Ontwortn kenna jetzt optional unformatiert oazoagt wern (Alternative zur automatischn Doarstöiung ois HTML/Markdown).",
                    moreSettingsTitle: "Mehr Oistöiunga fia den Chat:",
                    temperature: "Temperatur: Kreativität vo de Ontwortn festlegn.",
                    maxLength: "Maximale Ontwoatlänge.",
                    systemprompt: "Systemprompt: Vahoitn vom Sprochmodöi festlegn, indem ma z.B. a bestimmte Roi vagibt."
                },
                fixed: {
                    textFieldGrowth: "Bei längeren Eigom is des Eigobtextföid ned mitgwochsn.",
                    htmlEntities:
                        "Foisontwortn HTML enthoitn wia &lt;, werd des ned mehr in &amp;lt; übersetzt. R-Skripte oda Bash Skripte soitn jetzt wieder korrekt generiert wern.",
                    codeBlockWrapping:
                        "Generierte Ontwortn mit Codeblöckn in Markdown: Foisde Sproch im zruckggebenen Codeblock definiert wor und dieser sehr lange Zeiln enthoitn hod, gobs koan Zeilenumbruch.",
                    authExpiration: "Foisde Authentifizierungsinformationa ausgloaffa san (Fensta zu long offen ohne Interaktion), werd de Seitn nei gloda."
                }
            }
        }
    },
    FR: {
        versions: {
            v2_0: {
                date: "[2.0] 15.10.2025",
                communityAssistants: {
                    title: "Assistants communautaires",
                    share: "Les assistants personnels peuvent être partagés en tant qu'assistants communautaires.",
                    subscribe: "Les assistants communautaires peuvent être abonnés.",
                    searchable: "Les assistants communautaires sont consultables.",
                    manage: "Les assistants communautaires peuvent être gérés et supprimés."
                },
                tools: {
                    title: "Outils",
                    brainstorming:
                        "Nouvel outil de brainstorming : un système d'agents crée de nouvelles cartes mentales ou étend les cartes mentales existantes.",
                    fullscreen: "Vue plein écran pour les cartes mentales de brainstorming générées.",
                    simplify:
                        'Nouvel outil "Simplifier" : simplifie les textes de manière itérative selon les règles du langage simple, critique et améliore les textes et répète le processus jusqu\'à ce que le résultat soit satisfaisant.',
                    interfaces: "À l'avenir, de nombreuses interfaces et applications différentes pourront être connectées à MUCGPT."
                },
                misc: {
                    title: "Divers",
                    mermaid: "Amélioration du rendu des diagrammes Mermaid (y compris les contrôles de zoom).",
                    username: "Affichage du nom d'utilisateur depuis Single Sign-On.",
                    tutorial:
                        "Début d'un tutoriel interactif dans MUCGPT qui explique comment fonctionnent les modèles de langage et les systèmes comme MUCGPT."
                },
                redesign: {
                    title: "Début de la refonte",
                    languageSelection: "Sélection de langue améliorée.",
                    settings: "Les paramètres ont été déplacés dans la barre de navigation / le pied de page."
                },
                technical: {
                    title: "Modifications techniques",
                    services: "Division en plusieurs services ; le fonctionnement complet est désormais possible localement (SSO, passerelle API, ...).",
                    agents: "Le système est désormais basé sur une approche basée sur les agents."
                },
                changed: {
                    summarizeRemoved: "La fonction de résumé a été supprimée"
                }
            },
            v1_2_5: {
                date: "[1.2.5] 24.04.2025",
                fixed: {
                    tokenSetting: "Correction du bug lors de la définition du nombre de jetons dans le chat assistant.",
                    messageRecall: 'Correction du problème avec "rappeler le message" et "régénérer le message" pour le premier message.',
                    messageDisplay: "Correction du problème d'affichage de la génération d'un message.",
                    latex: "Les formules mathématiques sont maintenant correctement rendues avec LaTeX.",
                    latexAlt: "Image de formules mathématiques dans MUCGPT"
                },
                changed: {
                    simpleLanguagePrompt: "L'invite pour le <i>langage simple</i> a été adaptée aux nouvelles directives.",
                    generalImprovements: "Améliorations générales de l'interface utilisateur et du code source."
                }
            },
            v1_2_4: {
                date: "[1.2.4] 4.03.2025",
                added: {
                    communityAssistantsTitle: "Assistants communautaires :",
                    examplesAndSuggestions: "Les assistants communautaires peuvent maintenant avoir leurs propres exemples et réponses suggérées.",
                    newVersionsTitle: "Nouvelles versions des assistants communautaires",
                    sherlock: "Sherlock🕵Générateur de cas de test : crée et exporte des cas de test. Par itm.km73",
                    consultor: "Consultor : conseille sur l'offre de consult.in.M. Par consult.in.M",
                    arielle: "🧜Arielle : crée des diagrammes Mermaid",
                    centralConfig: "Les assistants communautaires peuvent être configurés de manière centralisée et la dernière version est toujours utilisée"
                },
                fixed: {
                    performance: "Problèmes de performance avec les longs chats (plus de 20k jetons).",
                    policyViolation:
                        'Si une invite est identifiée comme dangereuse, seul "Une violation de la politique a été détectée et le chat est terminé ici" est maintenant renvoyé.',
                    codeBlocks: "Les blocs de code s'adaptent maintenant à la taille de la police.",
                    settingsButton:
                        "Le bouton \"Paramètres et commentaires\" reste maintenant dans l'en-tête lors de l'augmentation de la taille de la police.",
                    versionFaq: "Version et FAQ : style ajusté et erreurs d'orthographe et de grammaire corrigées.",
                    tokenUsageTitle: "Utilisation des jetons :",
                    tokenDisplay: "Problème d'affichage résolu lors du rechargement.",
                    tokenRemoved: "Utilisation des jetons supprimée des fonctionnalités <i>Résumer</i> et <i>Brainstorming</i>.",
                    tokenHidden: "Si aucun jeton n'est utilisé, l'utilisation des jetons n'est pas affichée pour offrir une interface plus claire.",
                    typos: "De nombreuses erreurs d'orthographe et de grammaire ont été corrigées."
                },
                changed: {
                    simpleLanguageTitle: "Langage simple :",
                    easyLanguageRemoved:
                        "<i>Langage facile</i> a été supprimé car nous ne pouvons pas fournir une traduction complète en langage facile et le nom est donc trompeur.",
                    simpleLanguagePrompt: "L'invite pour le <i>langage simple</i> a été adaptée et étendue.",
                    ownAssistantsTitle: "Assistants personnels :",
                    settingsEditOnly:
                        "Les paramètres tels que <i>l'invite système</i> ou <i>le nombre maximum de jetons</i> ne sont affichés que lors de la modification.",
                    sidebarExpands: "Lors de la modification d'un assistant, la barre latérale des paramètres s'élargit.",
                    communityReadOnly: "Les assistants communautaires sont en lecture seule et ne peuvent pas être modifiés par les utilisateurs."
                }
            },
            v1_2_3: {
                date: "[1.2.3] 30.01.2025",
                added: {
                    sherlock: "Nouvel assistant communautaire Sherlock 🕵️‍♂️. Aide à la révision et à la création de cas de test. Développé par itm.km73."
                },
                fixed: {
                    brainstormingTitle: "Brainstorming :",
                    darkMode: "Les cartes mentales sont maintenant correctement affichées en mode sombre.",
                    simpleLanguageTitle: "Langage simple :",
                    linksIgnored: "Les liens sont maintenant ignorés lors de la traduction en langage simple. Cela conduisait auparavant à des hallucinations.",
                    codeCopy:
                        "Il est maintenant possible de copier des blocs de code partiels dans Chrome. Cela causait auparavant des sauts de ligne après chaque mot.",
                    mistralApi: "Une erreur dans la communication avec les modèles Mistral via l'API a été corrigée."
                },
                changed: {
                    brainstormingTitle: "Brainstorming :",
                    mindmapImproved:
                        "La création de cartes mentales a été améliorée. Plus de nœuds enfants sont générés, ce qui conduit à des cartes mentales plus grandes et plus détaillées.",
                    assistantsTitle: "Assistants :",
                    multipleChats:
                        "Les assistants peuvent maintenant avoir plusieurs historiques de chat. Comme pour la fonction de chat, un historique de chat peut être renommé et mis en favori. Les données sont stockées exclusivement localement dans le navigateur.",
                    simpleLanguageTitle: "Langage simple :",
                    titleRenamed:
                        "Le titre de l'exemple de <i>langage facile</i> a été renommé. Il s'agit en fait d'un article sur la loi sur la santé et la sécurité au travail.",
                    uiImprovementsTitle: "Améliorations générales de l'interface :",
                    sidebar:
                        "Chaque fonction (par ex. Chat, Résumer) dispose maintenant d'éléments d'action dans une barre latérale toujours ouverte sur le côté gauche.",
                    storage:
                        "La gestion du stockage local dans la base de données du navigateur a été améliorée et unifiée. Les données existantes (anciens chats et assistants) sont migrées. ⚠ Les conversations dans <i>Résumer</i>, <i>Brainstorming</i> et <i>Langage simple</i> ne seront pas conservées."
                }
            },
            v1_2_2: {
                date: "[1.2.2] 07.11.2024",
                added: {
                    customAssistants:
                        "Il est maintenant possible de créer des assistants personnels. Cette fonctionnalité permet aux utilisateurs de développer des assistants spécialisés pour des tâches récurrentes, équipés d'une invite système.",
                    examplesTitle: "Exemples d'assistants :",
                    translator: "Traducteur anglais : traduit toutes les entrées en anglais.",
                    testGenerator: "Générateur de tests : crée des cas de test utiles basés sur le code du programme saisi.",
                    editor: "Correcteur : corrige les textes saisis et suggère des formulations alternatives.",
                    creation:
                        "Pour créer un assistant, l'utilisateur décrit la fonction souhaitée dans un champ de texte. MUCGPT génère ensuite un titre approprié, une description et une invite système, qui peuvent ensuite être ajustés."
                },
                fixed: {
                    frontendBugs: "Divers bugs du frontend ont été corrigés."
                },
                changed: {
                    design: "Le design de l'interface utilisateur de MUCGPT a été mis à jour.",
                    arielle: '🧜‍♀️ Arielle, l\'assistante de diagrammes, se trouve maintenant sous "Assistants communautaires" et non plus dans le chat.'
                }
            },
            v1_2_1: {
                date: "[1.2.1] 27.09.2024",
                added: {
                    simpleLanguageFeature:
                        'En plus des fonctions Chat, Résumer et Brainstorming, nous proposons maintenant une quatrième fonctionnalité "Langage simple".',
                    simpleLanguageAlt: "Image pour le langage simple",
                    chat: "Via un chat, les textes peuvent être envoyés au modèle de langage, qui sont traduits en langage simple ou facile.",
                    selection: "En haut à droite, vous pouvez choisir si le texte doit être traduit en langage simple ou facile.",
                    easyLanguageDef:
                        "Le langage simple est une forme simplifiée de la langue standard qui évite la complexité pour atteindre un public plus large.",
                    plainLanguageDef:
                        "Le langage facile utilise des mots simples et des phrases courtes pour transmettre des informations de manière claire et compréhensible.",
                    modelRecommendation:
                        'La fonctionnalité "Langage simple" utilise le même modèle de langage que les autres fonctionnalités, qui est sélectionné via les paramètres. Cependant, nous recommandons d\'utiliser les modèles <strong>mistral-large-2407</strong> ou <strong>gpt-4o</strong> pour "Langage simple".'
                },
                fixed: {
                    serviceNowRedirect:
                        "Les utilisateurs qui ne se sont pas encore inscrits dans ServiceNow pour MUCGPT sont automatiquement redirigés vers ServiceNow lors de l'accès au service.",
                    performance: "Les performances pour les chats plus longs avec un nombre élevé de jetons générés ont été optimisées."
                }
            },
            v1_2_0: {
                date: "[1.2.0] 18.09.2024",
                fixed: {
                    codeDisplay: "Le code généré n'était parfois pas affiché correctement (parenthèses supprimées)."
                }
            },
            v1_1_4: {
                date: "[1.1.4] 11.09.2024",
                fixed: {
                    versionNumber: "Le numéro de version est à nouveau enregistré correctement et affiché dans les paramètres.",
                    tokenSplit:
                        "Les jetons maximum de la configuration sont divisés en jetons d'entrée et de sortie. Cela empêche les modèles avec des fenêtres de contexte plus petites (comme Mistral) de rencontrer une erreur."
                }
            },
            v1_1_3: {
                date: "[1.1.3] 28.08.2024",
                added: {
                    modelSelection:
                        "Les utilisateurs ont maintenant la possibilité de choisir entre 3 modèles de langage différents, celui qui convient le mieux à leur cas d'utilisation."
                },
                changed: {
                    defaultModel: "Le modèle de langage utilisé par défaut a été changé de GPT-3.5 à la version plus récente GPT-4o-mini.",
                    summarizeTitle: 'Amélioration de la fonction "Résumer" :',
                    fewerErrors: "Moins d'erreurs",
                    reliableSummaries: "Résumés plus fiables dans la structure souhaitée"
                }
            },
            v1_1_2: {
                date: "[1.1.2] 31.07.2024",
                added: {
                    chatHistory: "Un historique de toutes les conversations est maintenant disponible pour la fonction Chat.",
                    autoSave: 'Tous les historiques de chat dans l\'onglet "Chat" sont automatiquement enregistrés.',
                    management: 'Les chats peuvent être supprimés, renommés ou mis en favoris dans la fenêtre "Historique".',
                    favorites: "Les chats favoris sont toujours affichés en haut.",
                    sorting:
                        'Les chats sont triés par date de dernière modification et regroupés en "Aujourd\'hui", "Hier", "7 derniers jours" et "Plus ancien".'
                }
            },
            v1_1_1: {
                date: "[1.1.1] 04.06.2024",
                added: {
                    errorHint: "Nouvel avertissement dans le champ de réponse du chat : MUCGPT fait des erreurs."
                },
                fixed: {
                    systempromptHelp: "Le texte d'aide pour l'invite système n'est plus transparent."
                },
                changed: {
                    arielleDescription: "La description de l'exemple de chat Arielle a été améliorée."
                }
            },
            v1_1_0: {
                date: "[1.1.0] 22.05.2024",
                added: {
                    chatSummarizeBrainstormTitle: "Chat/Résumer/Brainstorming :",
                    recallMessages:
                        "Les messages personnels peuvent être rappelés. En cliquant sur le bouton correspondant, tous les messages ci-dessous et le message sélectionné sont supprimés. Le message sélectionné est inséré dans le champ de saisie et peut être modifié :",
                    browserCache: "L'historique de chat actuel est mis en cache dans le navigateur et reste donc en place lorsque vous quittez la page.",
                    updateHistory: "Quoi de neuf ? : L'historique des mises à jour peut être affiché.",
                    chatTitle: "Chat :",
                    suggestedResponses:
                        "MUCGPT suggère maintenant des <b>options de réponse</b> à une réponse. En sélectionnant une option de réponse, une invite correspondante est chargée dans le champ de saisie :",
                    mermaidDiagrams: "Les <b>diagrammes Mermaid</b> peuvent être affichés et téléchargés dans le chat.",
                    arielle: "Il y a Arielle, l'assistante de diagrammes. Elle guide l'utilisateur dans la création de diagrammes Mermaid.",
                    systempromptSpace: "Plus d'espace pour saisir l'invite système.",
                    systempromptWarning: "Un avertissement est affiché si une invite système est définie.",
                    temperatureDescription: "Meilleures descriptions pour le paramètre de température."
                },
                fixed: {
                    systempromptToken: "L'invite système est maintenant incluse dans la limite de jetons."
                }
            },
            v1_0_0: {
                date: "[1.0.0] 26.02.2024",
                added: {
                    production: "Environnement de production mis en place.",
                    faq: "FAQ ajoutée.",
                    communityExamples: "Des exemples de chat de la communauté ont été intégrés."
                },
                fixed: {
                    streamingErrors: "Afficher les messages d'erreur si le modèle de langage est surchargé pendant le streaming.",
                    typos: "Fautes d'orthographe dans les textes d'aide corrigées."
                },
                changed: {
                    termsDaily: "Les conditions d'utilisation doivent maintenant être confirmées une fois par jour.",
                    termsUpdated: "Les conditions d'utilisation ont été complétées.",
                    servicedesk: "Note sur le service d'assistance.",
                    wilmaLink: "Lien vers l'espace de travail Wilma."
                }
            },
            v0_3_0: {
                date: "[0.3.0] 06.02.2024",
                added: {
                    settingsSaved: "Les paramètres déjà effectués sont enregistrés (par ex. langue, invite système, conditions d'utilisation acceptées).",
                    accessibilityTitle: "Accessibilité :",
                    screenreader: "Rendu optimisé pour les lecteurs d'écran.",
                    colorblind: "Meilleure distinction pour les daltoniens.",
                    highContrast: "Support du mode contraste élevé de Windows.",
                    moreOptimizations: "Et bien d'autres optimisations ..."
                },
                fixed: {
                    inlineCode:
                        "Les mots formatés comme du code (avec des backticks simples, ` ) dans les réponses ne sont plus affichés comme un bloc de code, car cela perturbait trop le flux de lecture."
                },
                changed: {
                    brainstormTitle: "Brainstorm :",
                    mindmapDownload:
                        "Les cartes mentales sont maintenant téléchargeables au format .mm et peuvent être traitées ultérieurement avec l'outil de cartes mentales Freeplane.",
                    summarizeTitle: "Résumer :",
                    summaryLength:
                        "La longueur du résumé dépend maintenant de la longueur totale du texte d'entrée - des textes d'entrée plus longs conduisent à des résumés plus longs.",
                    detailLevel: "Le niveau de détail (court, moyen, long) peut être défini via un paramètre dédié.",
                    designUnified: "Design unifié.",
                    darkMode: "Mode sombre ajouté.",
                    termsUpdated: "Conditions d'utilisation mises à jour."
                }
            },
            v0_2_0: {
                date: "[0.2.0] 06.02.2024",
                subtitle: "❄Mise à jour du Nouvel An❄",
                added: {
                    markdownTitle: "Meilleur rendu des réponses contenant du Markdown :",
                    codeLanguage: "Le langage de programmation est affiché pour les blocs de code.",
                    lineNumbers: "Les numéros de ligne sont affichés pour les blocs de code.",
                    summarizeTitle: "Résumer :",
                    copySummary: "Les résumés peuvent être copiés.",
                    noTokenLimit: "La limite de jetons (limite de mots) a été supprimée.",
                    pdfUpload: "Les PDF peuvent être téléchargés et ensuite résumés.",
                    chatTitle: "Chat :",
                    unformattedView:
                        "Les réponses peuvent maintenant être affichées de manière optionnelle sans formatage (alternative au rendu automatique en HTML/Markdown).",
                    moreSettingsTitle: "Plus de paramètres pour le chat :",
                    temperature: "Température : définir la créativité des réponses.",
                    maxLength: "Longueur maximale de réponse.",
                    systemprompt: "Invite système : définir le comportement du modèle de langage, par exemple en attribuant un rôle spécifique."
                },
                fixed: {
                    textFieldGrowth: "Le champ de saisie de texte ne grandissait pas avec les entrées plus longues.",
                    htmlEntities:
                        "Si les réponses contiennent du HTML comme &lt;, cela n'est plus traduit en &amp;lt;. Les scripts R ou Bash devraient maintenant être générés correctement à nouveau.",
                    codeBlockWrapping:
                        "Réponses générées avec des blocs de code en Markdown : si aucun langage n'était défini dans le bloc de code retourné et qu'il contenait des lignes très longues, il n'y avait pas de retour à la ligne.",
                    authExpiration:
                        "Si les informations d'authentification ont expiré (fenêtre ouverte trop longtemps sans interaction), la page est rechargée."
                }
            }
        }
    },
    UK: {
        versions: {
            v2_0: {
                date: "[2.0] 15.10.2025",
                communityAssistants: {
                    title: "Спільні асистенти",
                    share: "Власні асистенти можна поділитися як спільні асистенти.",
                    subscribe: "На спільних асистентів можна підписатися.",
                    searchable: "Спільні асистенти доступні для пошуку.",
                    manage: "Спільні асистенти можна керувати та видаляти."
                },
                tools: {
                    title: "Інструменти",
                    brainstorming: "Новий інструмент мозкового штурму: система агентів створює нові ментальні карти або розширює існуючі ментальні карти.",
                    fullscreen: "Повноекранний режим для створених ментальних карт мозкового штурму.",
                    simplify:
                        'Новий інструмент "Спрощення": ітеративно спрощує тексти за правилами простої мови, критикує та покращує тексти та повторює процес, поки результат не буде задовільним.',
                    interfaces: "У перспективі до MUCGPT можна буде підключити багато різних інтерфейсів та додатків."
                },
                misc: {
                    title: "Різне",
                    mermaid: "Покращене відображення діаграм Mermaid (включаючи елементи керування масштабуванням).",
                    username: "Відображення імені користувача з Single Sign-On.",
                    tutorial: "Початок інтерактивного посібника в MUCGPT, який пояснює, як працюють мовні моделі та системи, подібні до MUCGPT."
                },
                redesign: {
                    title: "Початок редизайну",
                    languageSelection: "Покращений вибір мови.",
                    settings: "Налаштування перенесено на панель навігації / нижній колонтитул."
                },
                technical: {
                    title: "Технічні зміни",
                    services: "Розділення на кілька сервісів; повна робота тепер можлива локально (SSO, API-шлюз, ...).",
                    agents: "Система тепер базується на підході, заснованому на агентах."
                },
                changed: {
                    summarizeRemoved: "Функцію резюмування видалено"
                }
            },
            v1_2_5: {
                date: "[1.2.5] 24.04.2025",
                fixed: {
                    tokenSetting: "Виправлено помилку при встановленні кількості токенів у чаті асистента.",
                    messageRecall: 'Виправлено проблему з "відкликати повідомлення" та "регенерувати повідомлення" для першого повідомлення.',
                    messageDisplay: "Виправлено проблему відображення генерації повідомлення.",
                    latex: "Математичні формули тепер правильно відображаються за допомогою LaTeX.",
                    latexAlt: "Зображення математичних формул у MUCGPT"
                },
                changed: {
                    simpleLanguagePrompt: "Підказку для <i>простої мови</i> адаптовано до нових рекомендацій.",
                    generalImprovements: "Загальні покращення інтерфейсу користувача та вихідного коду."
                }
            },
            v1_2_4: {
                date: "[1.2.4] 4.03.2025",
                added: {
                    communityAssistantsTitle: "Спільні асистенти:",
                    examplesAndSuggestions: "Спільні асистенти тепер можуть мати власні приклади та запропоновані відповіді.",
                    newVersionsTitle: "Нові версії спільних асистентів",
                    sherlock: "Sherlock🕵Генератор тестових випадків: створює та експортує тестові випадки. Від itm.km73",
                    consultor: "Consultor: консультує щодо пропозиції consult.in.M. Від consult.in.M",
                    arielle: "🧜Arielle: створює діаграми Mermaid",
                    centralConfig: "Спільні асистенти можна налаштувати централізовано, і завжди використовується остання версія"
                },
                fixed: {
                    performance: "Проблеми з продуктивністю при довгих чатах (понад 20 тис. токенів).",
                    policyViolation: 'Якщо підказку визначено як небезпечну, тепер повертається лише "Виявлено порушення політики, і чат завершується тут".',
                    codeBlocks: "Блоки коду тепер адаптуються до розміру шрифту.",
                    settingsButton: 'Кнопка "Налаштування та відгуки" тепер залишається в заголовку при збільшенні розміру шрифту.',
                    versionFaq: "Версія та FAQ: стиль скориговано, виправлено орфографічні та граматичні помилки.",
                    tokenUsageTitle: "Використання токенів:",
                    tokenDisplay: "Виправлено проблему відображення при перезавантаженні.",
                    tokenRemoved: "Використання токенів видалено з функцій <i>Резюмування</i> та <i>Мозковий штурм</i>.",
                    tokenHidden: "Якщо токени не використовуються, використання токенів не відображається для надання більш чистого інтерфейсу.",
                    typos: "Виправлено численні орфографічні та граматичні помилки."
                },
                changed: {
                    simpleLanguageTitle: "Проста мова:",
                    easyLanguageRemoved:
                        "<i>Легка мова</i> видалена, оскільки ми не можемо забезпечити повний переклад на легку мову, і назва тому вводить в оману.",
                    simpleLanguagePrompt: "Підказку для <i>простої мови</i> адаптовано та розширено.",
                    ownAssistantsTitle: "Власні асистенти:",
                    settingsEditOnly:
                        "Налаштування, такі як <i>системна підказка</i> або <i>максимальна кількість токенів</i>, відображаються лише під час редагування.",
                    sidebarExpands: "При редагуванні асистента бічна панель налаштувань розширюється.",
                    communityReadOnly: "Спільні асистенти доступні лише для читання і не можуть бути змінені користувачами."
                }
            },
            v1_2_3: {
                date: "[1.2.3] 30.01.2025",
                added: {
                    sherlock: "Новий спільний асистент Sherlock 🕵️‍♂️. Допомагає переглядати та створювати тестові випадки. Розроблено itm.km73."
                },
                fixed: {
                    brainstormingTitle: "Мозковий штурм:",
                    darkMode: "Ментальні карти тепер правильно відображаються в темному режимі.",
                    simpleLanguageTitle: "Проста мова:",
                    linksIgnored: "Посилання тепер ігноруються при перекладі на просту мову. Раніше це призводило до галюцинацій.",
                    codeCopy: "Тепер можна копіювати часткові блоки коду в Chrome. Раніше це призводило до розривів рядків після кожного слова.",
                    mistralApi: "Виправлено помилку в спілкуванні з моделями Mistral через API."
                },
                changed: {
                    brainstormingTitle: "Мозковий штурм:",
                    mindmapImproved:
                        "Покращено створення ментальних карт. Генерується більше дочірніх вузлів, що призводить до більших і детальніших ментальних карт.",
                    assistantsTitle: "Асистенти:",
                    multipleChats:
                        "Асистенти тепер можуть мати кілька історій чатів. Подібно до функції чату, історію чату можна перейменувати та додати до обраного. Дані зберігаються виключно локально в браузері.",
                    simpleLanguageTitle: "Проста мова:",
                    titleRenamed: "Назву прикладу <i>легкої мови</i> перейменовано. Насправді це стаття про Закон про охорону праці.",
                    uiImprovementsTitle: "Загальні покращення інтерфейсу:",
                    sidebar: "Кожна функція (наприклад, Чат, Резюме) тепер має елементи дій у завжди відкритій бічній панелі зліва.",
                    storage:
                        "Покращено та уніфіковано локальне управління сховищем у базі даних браузера. Існуючі дані (старі чати та асистенти) мігруються. ⚠ Розмови в <i>Резюмування</i>, <i>Мозковий штурм</i> та <i>Проста мова</i> не будуть збережені."
                }
            },
            v1_2_2: {
                date: "[1.2.2] 07.11.2024",
                added: {
                    customAssistants:
                        "Тепер є можливість створювати власних асистентів. Ця функція дозволяє користувачам розробляти спеціалізованих асистентів для повторюваних завдань, які оснащені системною підказкою.",
                    examplesTitle: "Приклади асистентів:",
                    translator: "Англійський перекладач: перекладає всі введення англійською мовою.",
                    testGenerator: "Генератор тестів: створює корисні тестові випадки на основі введеного програмного коду.",
                    editor: "Редактор: виправляє введені тексти та пропонує альтернативні формулювання.",
                    creation:
                        "Щоб створити асистента, користувач описує бажану функцію в текстовому полі. MUCGPT потім генерує відповідний заголовок, опис та системну підказку, які потім можна додатково налаштувати."
                },
                fixed: {
                    frontendBugs: "Виправлено різні помилки інтерфейсу."
                },
                changed: {
                    design: "Оновлено дизайн інтерфейсу користувача MUCGPT.",
                    arielle: '🧜‍♀️ Arielle, асистентка діаграм, тепер знаходиться в розділі "Спільні асистенти", а не в чаті.'
                }
            },
            v1_2_1: {
                date: "[1.2.1] 27.09.2024",
                added: {
                    simpleLanguageFeature: 'На додаток до функцій Чат, Резюме та Мозковий штурм, ми тепер пропонуємо четверту функцію "Проста мова".',
                    simpleLanguageAlt: "Зображення для простої мови",
                    chat: "Через чат можна надсилати тексти мовній моделі, які перекладаються на просту або легку мову.",
                    selection: "У верхньому правому куті можна вибрати, чи слід перекласти текст на просту чи легку мову.",
                    easyLanguageDef: "Проста мова - це спрощена форма стандартної мови, яка уникає складності для охоплення ширшої аудиторії.",
                    plainLanguageDef: "Легка мова використовує прості слова та короткі речення для передачі інформації чітко та зрозуміло.",
                    modelRecommendation:
                        'Функція "Проста мова" використовує ту саму мовну модель, що й інші функції, яка вибирається через налаштування. Однак ми рекомендуємо використовувати моделі <strong>mistral-large-2407</strong> або <strong>gpt-4o</strong> для "Простої мови".'
                },
                fixed: {
                    serviceNowRedirect:
                        "Користувачі, які ще не зареєструвалися в ServiceNow для MUCGPT, автоматично перенаправляються до ServiceNow при доступі до служби.",
                    performance: "Оптимізовано продуктивність для довгих чатів з великою кількістю згенерованих токенів."
                }
            },
            v1_2_0: {
                date: "[1.2.0] 18.09.2024",
                fixed: {
                    codeDisplay: "Згенерований код іноді відображався неправильно (дужки видалено)."
                }
            },
            v1_1_4: {
                date: "[1.1.4] 11.09.2024",
                fixed: {
                    versionNumber: "Номер версії знову правильно зберігається та відображається в налаштуваннях.",
                    tokenSplit:
                        "Максимальні токени з конфігурації розділені на вхідні та вихідні токени. Це запобігає помилкам моделей з меншими контекстними вікнами (наприклад, Mistral)."
                }
            },
            v1_1_3: {
                date: "[1.1.3] 28.08.2024",
                added: {
                    modelSelection:
                        "Користувачі тепер мають можливість вибирати між 3 різними мовними моделями, яка найкраще підходить для їхнього випадку використання."
                },
                changed: {
                    defaultModel: "Типово використовувану мовну модель змінено з GPT-3.5 на новішу версію GPT-4o-mini.",
                    summarizeTitle: 'Покращення функції "Резюмування":',
                    fewerErrors: "Менше помилок",
                    reliableSummaries: "Більш надійні резюме в бажаній структурі"
                }
            },
            v1_1_2: {
                date: "[1.1.2] 31.07.2024",
                added: {
                    chatHistory: "Для функції Чат тепер доступна історія всіх проведених розмов.",
                    autoSave: 'Всі історії чатів на вкладці "Чат" автоматично зберігаються.',
                    management: 'Чати можна видаляти, перейменовувати або додавати до обраного у вікні "Історія".',
                    favorites: "Обрані чати завжди відображаються вгорі.",
                    sorting: 'Чати сортуються за часом останнього редагування та групуються на "Сьогодні", "Вчора", "Останні 7 днів" та "Старіше".'
                }
            },
            v1_1_1: {
                date: "[1.1.1] 04.06.2024",
                added: {
                    errorHint: "Нова підказка в полі відповіді чату: MUCGPT робить помилки."
                },
                fixed: {
                    systempromptHelp: "Текст довідки для системної підказки більше не прозорий."
                },
                changed: {
                    arielleDescription: "Покращено опис прикладу чату Arielle."
                }
            },
            v1_1_0: {
                date: "[1.1.0] 22.05.2024",
                added: {
                    chatSummarizeBrainstormTitle: "Чат/Резюмування/Мозковий штурм:",
                    recallMessages:
                        "Власні повідомлення можна відкликати. При натисканні відповідної кнопки всі повідомлення нижче та вибране повідомлення видаляються. Вибране повідомлення вставляється в поле введення і може бути змінене:",
                    browserCache: "Поточна історія чату кешується в браузері і, отже, залишається при виході зі сторінки.",
                    updateHistory: "Що нового?: Можна відобразити історію оновлень.",
                    chatTitle: "Чат:",
                    suggestedResponses:
                        "MUCGPT тепер пропонує <b>варіанти відповідей</b> на відповідь. При виборі варіанта відповіді відповідна підказка завантажується в поле введення:",
                    mermaidDiagrams: "<b>Діаграми Mermaid</b> можна відображати та завантажувати в чаті.",
                    arielle: "Є Arielle, асистентка діаграм. Вона допомагає користувачеві створювати діаграми Mermaid.",
                    systempromptSpace: "Більше місця для введення системної підказки.",
                    systempromptWarning: "Відображається попередження, якщо встановлено системну підказку.",
                    temperatureDescription: "Кращі описи для налаштування температури."
                },
                fixed: {
                    systempromptToken: "Системна підказка тепер включена в ліміт токенів."
                }
            },
            v1_0_0: {
                date: "[1.0.0] 26.02.2024",
                added: {
                    production: "Налаштовано виробниче середовище.",
                    faq: "Додано FAQ.",
                    communityExamples: "Додано приклади чатів від спільноти."
                },
                fixed: {
                    streamingErrors: "Відображати повідомлення про помилки, якщо мовна модель перевантажена під час потокової передачі.",
                    typos: "Виправлено орфографічні помилки в текстах довідки."
                },
                changed: {
                    termsDaily: "Умови використання тепер потрібно підтверджувати один раз на день.",
                    termsUpdated: "Умови використання доповнено.",
                    servicedesk: "Примітка про службу підтримки.",
                    wilmaLink: "Посилання на робочий простір Wilma."
                }
            },
            v0_3_0: {
                date: "[0.3.0] 06.02.2024",
                added: {
                    settingsSaved: "Вже зроблені налаштування зберігаються (наприклад, мова, системна підказка, прийняті умови використання).",
                    accessibilityTitle: "Доступність:",
                    screenreader: "Оптимізоване відображення для програм читання з екрана.",
                    colorblind: "Краще розрізнення для людей з порушеннями сприйняття кольору.",
                    highContrast: "Підтримка режиму високої контрастності Windows.",
                    moreOptimizations: "І багато інших оптимізацій ..."
                },
                fixed: {
                    inlineCode:
                        "Слова, відформатовані як код (з одинарними зворотними апострофами, ` ) у відповідях, більше не відображаються як блок коду, оскільки це занадто порушувало потік читання."
                },
                changed: {
                    brainstormTitle: "Мозковий штурм:",
                    mindmapDownload: "Ментальні карти тепер можна завантажити у форматі .mm і подальше опрацювання за допомогою інструменту Freeplane.",
                    summarizeTitle: "Резюмування:",
                    summaryLength: "Довжина резюме тепер залежить від загальної довжини вхідного тексту - довші вхідні тексти призводять до довших резюме.",
                    detailLevel: "Рівень деталізації (короткий, середній, довгий) можна встановити через спеціальне налаштування.",
                    designUnified: "Уніфікований дизайн.",
                    darkMode: "Додано темний режим.",
                    termsUpdated: "Оновлено умови використання."
                }
            },
            v0_2_0: {
                date: "[0.2.0] 06.02.2024",
                subtitle: "❄Новорічне оновлення❄",
                added: {
                    markdownTitle: "Краще відображення відповідей, що містять Markdown:",
                    codeLanguage: "Для блоків коду відображається мова програмування.",
                    lineNumbers: "Для блоків коду вказуються номери рядків.",
                    summarizeTitle: "Резюмування:",
                    copySummary: "Резюме можна копіювати.",
                    noTokenLimit: "Ліміт токенів (ліміт слів) видалено.",
                    pdfUpload: "Можна завантажувати PDF-файли, які потім резюмуються.",
                    chatTitle: "Чат:",
                    unformattedView: "Відповіді тепер можна відображати без форматування (альтернатива автоматичному відображенню як HTML/Markdown).",
                    moreSettingsTitle: "Більше налаштувань для чату:",
                    temperature: "Температура: визначити креативність відповідей.",
                    maxLength: "Максимальна довжина відповіді.",
                    systemprompt: "Системна підказка: визначити поведінку мовної моделі, наприклад, призначивши конкретну роль."
                },
                fixed: {
                    textFieldGrowth: "Поле введення тексту не зростало з довшими введеннями.",
                    htmlEntities:
                        "Якщо відповіді містять HTML, як-от &lt;, це більше не перетворюється на &amp;lt;. Сценарії R або Bash тепер повинні генеруватися правильно знову.",
                    codeBlockWrapping:
                        "Згенеровані відповіді з блоками коду в Markdown: якщо мову не було визначено в поверненому блоці коду, і він містив дуже довгі рядки, не було переносу рядків.",
                    authExpiration: "Якщо інформація про автентифікацію застаріла (вікно відкрите занадто довго без взаємодії), сторінка перезавантажується."
                }
            }
        }
    }
};
