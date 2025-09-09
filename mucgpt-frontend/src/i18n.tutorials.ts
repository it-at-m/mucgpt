export const tutorialsTranslations = {
    Deutsch: {
        tutorials: {
            back_to_overview: "Zurück zur Übersicht",
            title: "Lerne",
            subtitle: "wie MUCGPT funktioniert",
            sections: {
                ki_background: {
                    title: "Hintergrundwissen",
                    description: "Grundlagen und Hintergründe zu Künstlicher Intelligenz"
                },
                tools: {
                    title: "Werkzeuge",
                    description: "Was sind Werkzeuge im Kontext MUCGPT?"
                },
                general_tips: {
                    title: "Anwendungstipps",
                    description: "Tipps und Best Practices für die optimale Nutzung von MUCGPT"
                }
            },
            progress: {
                stats: "{{completed}} von {{total}} Abschnitten abgeschlossen"
            },
            navigation: {
                back_to_top: "Zum Seitenanfang",
                previous_tutorial: "Vorheriges Tutorial",
                next_tutorial: "Nächstes Tutorial",
                previous_section: "Vorheriger Abschnitt",
                next_section: "Nächster Abschnitt"
            },
            ai_basics: {
                title: "KI-Grundlagen",
                progress: {
                    title: "KI-Grundlagen Fortschritt",
                    stats: "{{completed}} von {{total}} Abschnitten abgeschlossen"
                },
                sections: {
                    titles: {
                        intro: "Was sind Sprachmodelle",
                        training: "Training",
                        functionality: "Funktionsweise",
                        access: "Was weiß ein Sprachmodell?",
                        conclusion: "Fazit & Ausblick"
                    },
                    what_are_llms: {
                        title: "Was sind große Sprachmodelle?",
                        description:
                            "Große Sprachmodelle (LLMs) sind KI-Systeme, die darauf trainiert wurden, menschliche Sprache zu verstehen und zu erzeugen. Sie sagen das nächste Wort voraus, basierend auf riesigen Mengen an Text.",
                        key_point: "Kernprinzip:",
                        key_explanation:
                            "LLMs erkennen Muster zwischen Wörtern und Konzepten und generieren Text, indem sie das wahrscheinlichste nächste Wort auswählen."
                    },
                    phases: {
                        title: "Training"
                    },
                    training_phase: {
                        description:
                            "Bevor ein LLM benutzt werden kann, muss es einmal trainiert werden. Dabei lernt es aus vielen Texten, wie Sprache funktioniert.",
                        steps_title: "So läuft das Training ab:",
                        key_concept: "Wichtig:",
                        key_explanation: "Training kostet viel Zeit und Geld. Große Modelle brauchen Wochen und viele Computer."
                    },
                    training: {
                        step1: {
                            title: "1. Texte sammeln (Datensammlung)",
                            description: "Viele Texte aus dem Internet und Büchern werden gesammelt. Das ist wie ein riesiges Lehrbuch für die KI."
                        },
                        step2: {
                            title: "2. Wörter raten lernen (Vortraining)",
                            description: "Die KI übt, fehlende Wörter in Texten zu erraten. So lernt sie, wie Sprache funktioniert."
                        },
                        step3: {
                            title: "3. Bessere Antworten (Feinabstimmung)",
                            description: "Menschen helfen der KI dabei, noch bessere und hilfreichere Antworten zu geben."
                        },
                        step4: {
                            title: "4. Feedback einbauen (RLHF)",
                            description: "Die KI lernt aus menschlichem Feedback, was gute und schlechte Antworten sind."
                        }
                    },
                    how_it_works: {
                        title: "Funktionsweise",
                        intro: "Wie funktioniert ein LLM, wenn du eine Frage stellst? Beispiel: 'Wie ist das Wetter heute?'",
                        key_insight: "Wichtige Erkenntnis:",
                        key_explanation:
                            "Ein LLM versteht Text nicht wie ein Mensch, sondern erkennt Muster aus dem Training. Es weiß, welche Wörter oft zusammen vorkommen.",
                        architecture_intro: "Die technische Grundlage ist die sogenannte Transformer-Architektur:",
                        step1: {
                            title: "Eingabe wird zerlegt (Tokenisierung)",
                            description: "Dein Text wird in kleine Teile zerlegt, sogenannte Tokens. Das können Wörter oder Wortteile sein."
                        },
                        step2: {
                            title: "Verarbeitung innerhalb des LLMs. Zentrales Konzept: Attention",
                            description:
                                "Das Modell schaut sich alle Wörter an und entscheidet: Welche sind wichtig? Es wandelt Wörter in Zahlen um und nutzt viele Schichten für verschiedene Aufgaben.",
                            example_title: "Einfaches Beispiel:",
                            example_text:
                                'Bei "Der Hund bellt" konzentriert sich das Modell hauptsächlich auf "Hund" und "bellt" - das sind die wichtigen Wörter.'
                        },
                        step3: {
                            title: "Aufmerksamkeit und Kontext (Self-Attention)",
                            description: "Das Modell schaut sich alle Wörter gleichzeitig an und entscheidet, welche wichtig sind und wie sie zusammenhängen."
                        },
                        step4: {
                            title: "Informationen verarbeiten (Feed-Forward)",
                            description: "Die Infos werden durch viele Schichten geschickt, um Muster zu erkennen.",
                            analogy: "Wie ein Detektiv, der Hinweise zusammensetzt."
                        },
                        step5: {
                            title: "Vorhersage des nächsten Wortes",
                            description: "Das Modell erstellt eine Liste möglicher nächster Wörter und wählt das wahrscheinlichste aus."
                        },
                        step6: {
                            title: "Wiederholung für den ganzen Text",
                            description: "Dieser Vorgang wiederholt sich für jedes neue Wort, bis die Antwort fertig ist."
                        },
                        analogy: {
                            title: "Analogie: LLM als Textfabrik",
                            description: "Stell dir ein LLM wie eine Textfabrik vor:",
                            input: "Eingabestation:",
                            input_desc: "Dein Text wird angenommen und zerlegt.",
                            analysis: "Analyseabteilung:",
                            analysis_desc: "Jedes Wort wird geprüft und in Zusammenhang gebracht.",
                            production: "Produktionslinie:",
                            production_desc: "Wort für Wort entsteht die Antwort.",
                            quality: "Qualitätskontrolle:",
                            quality_desc: "Jedes Wort wird auf Plausibilität geprüft."
                        }
                    },
                    access: {
                        title: "Was weiß ein Sprachmodell?",
                        training_data: {
                            title: "Trainingsdaten",
                            description:
                                "LLMs nutzen das Wissen und die Muster, die sie beim Training gelernt haben. Dazu gehören Fakten, Sprachregeln und Wissen bis zu einem bestimmten Zeitpunkt."
                        },
                        conversation: {
                            title: "Aktuelle Konversation",
                            description: "Das Modell sieht den aktuellen Gesprächsverlauf und kann so passende Antworten geben."
                        },
                        tools: {
                            title: "Erweiterte Werkzeuge",
                            description: "Moderne KI kann mit Werkzeugen wie Websuche oder Datenbankzugriff ausgestattet werden, um aktuelle Infos zu liefern."
                        }
                    },
                    conclusion: {
                        title: "Fazit",
                        intro: "Jetzt wissen Sie, wie KI-Sprachmodelle funktionieren! Die wichtigsten Punkte:",
                        insight1: {
                            title: "Lernen und Antworten sind getrennt",
                            description: "KI-Modelle lernen einmal aus vielen Texten und beantworten dann Fragen. Beim Antworten lernen sie nichts Neues dazu."
                        },
                        insight2: {
                            title: "Wort für Wort Vorhersagen",
                            description:
                                "KI rät immer das nächste passende Wort. So entstehen Antworten – Wort für Wort. Die KI versteht nicht wirklich, sondern erkennt Muster."
                        },
                        insight3: {
                            title: "Klare Fragen = bessere Antworten",
                            description: "Je genauer Sie fragen, desto besser wird die Antwort. Geben Sie der KI genug Details."
                        },
                        insight4: {
                            title: "Verschiedene Wissensquellen",
                            description: "KI nutzt ihr gelerntes Wissen, das aktuelle Gespräch und kann auch Hilfsmittel wie Websuche verwenden."
                        }
                    }
                },
                intro: {
                    title: "Grundlagen moderner KI-Systeme",
                    description: "Verstehen Sie, wie moderne KI-Systeme wie Large Language Models (LLMs) funktionieren und trainiert werden."
                },
                example: {
                    title: "Wie funktionieren Large Language Models?",
                    description: "Ein Überblick über die grundlegenden Konzepte und Funktionsweisen von LLMs."
                },
                features: {
                    understanding: {
                        title: "LLM-Funktionsweise verstehen",
                        description: "Lernen Sie die Grundprinzipien und Architektur von Large Language Models kennen."
                    },
                    training_vs_inference: {
                        title: "Training vs. Inferenz",
                        description: "Verstehen Sie den Unterschied zwischen Trainings- und Nutzungsphase."
                    },
                    best_practices: {
                        title: "Effektive Kommunikation",
                        description: "Lernen Sie, wie Sie bessere Ergebnisse durch klare Prompts erzielen."
                    }
                }
            },
            badges: {
                in_construction: "Im Aufbau",
                popular: "Beliebt",
                new: "Neu"
            },
            prompt_engineering: {
                title: "Prompt Engineering",
                description: "Lerne, wie du effektive Prompts schreibst für bessere KI-Antworten."
            },
            ai_agents: {
                title: "KI-Agenten",
                description: "Verstehe, wie KI Agenten funktionieren, und was das mit MUCGPT zu tun hat."
            },
            ai_limitations: {
                title: "Limitierungen von MUCGPT",
                description: "Was kann MUCGPT nicht?"
            },
            ai_applications: {
                title: "Einsatzmöglicheiten von MUCGPT",
                description: "Zuvor haben wir erfahren was MUCGPT nicht kann, jetzt schauen wir uns an, was MUCGPT kann."
            },
            tools: {
                title: "Übersicht",
                description: "Erfahre, was Werkzeuge im Kontext von MUCGPT sind und wie du sie effektiv nutzen kannst.",
                intro: {
                    title: "Was sind Werkzeuge?",
                    description:
                        "Werkzeuge sind spezialisierte Funktionen, die schwierige Aufgaben erledigen. MUCGPT kann sich entscheiden diese zu benutzen, um zu besseren Ergebnissen zu kommen. Beispiele sind die Beschaffung von Informationen, die nicht in den Trainingsdaten enthalten ist (z.B. über Websuche oder die Anbindung von unserer KI Suche im Dienstleistungsfinder."
                },
                example: {
                    title: "So funktioniert die Werkzeug-Auswahl:",
                    description: ""
                },
                tips: {
                    relevant: {
                        title: "Nur relevante Werkzeuge wählen",
                        description:
                            "Wählen Sie nur die Werkzeuge aus, die Sie gerade wirklich benötigen. Zu viele Werkzeuge können die Antwort verlangsamen oder zu schlechten Ergebnissen führen."
                    }
                }
            },
            brainstorm: {
                title: "Brainstorming Werkzeug",
                description: "Lerne, wie du mit dem Brainstorming-Werkzeug kreative Mindmaps erstellen und strukturieren kannst.",
                intro: {
                    title: "Was ist das Brainstorming Werkzeug?",
                    description:
                        "Das Brainstorming-Werkzeug generiert strukturierte Mindmaps zu jedem Thema. Es nutzt KI, um kreative Ideen zu sammeln, zu organisieren und als interaktive Mindmap darzustellen."
                },
                example: {
                    title: "Brainstorming Beispiel",
                    description: ""
                },
                tips: {
                    specific: {
                        title: "Seien Sie spezifisch",
                        description: "Je präziser Ihr Thema, desto gezielter und relevanter werden die generierten Ideen."
                    },
                    context: {
                        title: "Kontext hinzufügen",
                        description: "Fügen Sie zusätzlichen Kontext hinzu, um die KI bei der Ideengenerierung zu unterstützen."
                    },
                    iterate: {
                        title: "Iterativ arbeiten",
                        description: "Nutzen Sie die Ergebnisse als Ausgangspunkt und verfeinern Sie Ihre Anfragen schrittweise."
                    }
                }
            },
            simplify: {
                title: "Text-Vereinfachung Werkzeug",
                description: "Erfahre, wie du komplexe Texte in verständliche Leichte Sprache übersetzt.",
                intro: {
                    title: "Was ist das Text-Vereinfachungs-Werkzeug?",
                    description:
                        "Das Text-Vereinfachungs-Werkzeug übersetzt komplexe Texte in Leichte Sprache nach A2-Standard. Es nutzt KI mit automatischer Qualitätsprüfung, um Texte verständlicher und barrierefreier zu machen."
                },
                example: {
                    title: "Beispiel Text-Vereinfachung",
                    description: ""
                },
                tips: {
                    length: {
                        title: "Textlänge beachten",
                        description: "Sehr lange Texte in kleinere Abschnitte aufteilen für bessere Ergebnisse."
                    },
                    review: {
                        title: "Ergebnis prüfen",
                        description: "Lesen Sie den vereinfachten Text durch und prüfen Sie, ob alle wichtigen Informationen enthalten sind."
                    },
                    target: {
                        title: "Zielgruppe",
                        description: "Leichte Sprache hilft Menschen mit Lernschwierigkeiten, Sprachlernenden und allen, die einfache Texte bevorzugen."
                    }
                }
            },
            best_practices: {
                title: "Best Practices",
                description: "Bewährte Methoden für eine effektive Nutzung der KI-Assistenten."
            },
            productivity_tips: {
                title: "Produktivitäts-Tipps",
                description: "Steigere deine Produktivität mit cleveren Tricks und Shortcuts."
            },
            tips: {
                title: "Tipps und Tricks"
            },
            buttons: {
                show_example: "Beispiel anzeigen",
                hide_example: "Beispiel ausblenden",
                try_example: "Beispiel im Chat ausprobieren"
            }
        }
    },
    Englisch: {
        tutorials: {
            back_to_overview: "Back to overview",
            title: "Learn",
            subtitle: "how MUCGPT works",
            sections: {
                ki_background: {
                    title: "Background Knowledge",
                    description: "Basics and backgrounds of Artificial Intelligence"
                },
                tools: {
                    title: "Tools",
                    description: "What are tools in the context of MUCGPT?"
                },
                general_tips: {
                    title: "Application Tips",
                    description: "Tips and best practices for optimal use of MUCGPT"
                }
            },
            progress: {
                stats: "{{completed}} of {{total}} sections completed"
            },
            ai_basics: {
                title: "AI Basics",
                description: "What is AI and how does it work? Understand the fundamentals of modern AI systems.",

                progress: {
                    title: "AI Basics Progress",
                    stats: "{{completed}} of {{total}} sections completed"
                },
                sections: {
                    titles: {
                        intro: "What are language models",
                        training: "Training",
                        functionality: "How it works",
                        access: "What does a language model know?",
                        conclusion: "Conclusion & Outlook"
                    },
                    what_are_llms: {
                        title: "What are large language models?",
                        description:
                            "Large language models (LLMs) are AI systems trained to understand and generate human language. They predict the next word based on huge amounts of text.",
                        key_point: "Core principle:",
                        key_explanation: "LLMs learn patterns between words and concepts and generate text by selecting the most likely next word."
                    },
                    phases: {
                        title: "Training"
                    },
                    training_phase: {
                        description:
                            "The training phase happens once before an LLM can be used. The model learns to understand and generate language using vast amounts of text data.",
                        steps_title: "The training process includes the following steps:",
                        key_concept: "Important to understand:",
                        key_explanation: "Training is resource-intensive and expensive. Large models like GPT-4 are trained on hundreds of GPUs for weeks."
                    },
                    training: {
                        step1: {
                            title: "1. Data collection",
                            description:
                                "Large amounts of text from the web, books, and articles are collected. This forms the basis for language understanding."
                        },
                        step2: {
                            title: "2. Pretraining",
                            description: "The model learns to predict words and sentences by filling in missing parts of text across millions of examples."
                        },
                        step3: {
                            title: "3. Fine-tuning",
                            description:
                                "The pretrained model is further trained on more specific data, often with human guidance, to improve usefulness and safety."
                        },
                        step4: {
                            title: "4. RLHF",
                            description:
                                "Reinforcement Learning from Human Feedback helps the model produce more helpful and safer answers using human evaluations."
                        }
                    },
                    how_it_works: {
                        title: "How it works",
                        intro: "How does an LLM work when you ask a question? Example: 'What's the weather today?'",
                        key_insight: "Key insight:",
                        key_explanation:
                            "An LLM doesn't 'understand' text like a human; it recognizes statistical patterns from training and knows which words often appear together.",
                        architecture_intro: "The technical basis is the Transformer architecture:",
                        step1: {
                            title: "Input is split (tokenization)",
                            description: "Your text is split into small pieces called tokens. These can be whole words or word parts."
                        },
                        step2: {
                            title: "Words become numbers (embeddings)",
                            description: "Computers work with numbers, not words. Each token is converted into a list of numbers.",
                            note: "Similar words have similar number patterns."
                        },
                        step3: {
                            title: "Attention and context (self-attention)",
                            description: "The model looks at all words together and decides which are important and how they relate."
                        },
                        step4: {
                            title: "Processing information (feed-forward)",
                            description: "The combined information passes through many layers to detect complex patterns.",
                            analogy: "Like a detective piecing together clues."
                        },
                        step5: {
                            title: "Predicting the next word",
                            description: "The model produces a probability list for the next word and selects the most likely one."
                        },
                        step6: {
                            title: "Repeat for the full response",
                            description: "This process repeats for each new word until the full response is produced."
                        },
                        analogy: {
                            title: "Analogy: LLM as a text factory",
                            description: "Think of an LLM like a text factory:",
                            input: "Input station:",
                            input_desc: "Your text is received and split.",
                            analysis: "Analysis department:",
                            analysis_desc: "Each word is examined and placed in context.",
                            production: "Production line:",
                            production_desc: "The response is produced word by word.",
                            quality: "Quality control:",
                            quality_desc: "Each word is checked for plausibility."
                        }
                    },
                    access: {
                        title: "What does a language model know?",
                        training_data: {
                            title: "Training data",
                            description:
                                "LLMs use the knowledge and patterns learned during training, including facts, language rules, and information up to a certain cutoff."
                        },
                        conversation: {
                            title: "Current conversation",
                            description: "The model has access to the current conversation history to provide context-aware responses."
                        },
                        tools: {
                            title: "Extended tools",
                            description:
                                "Modern AI can be equipped with tools like web search or database access to provide more up-to-date or specific information."
                        }
                    },
                    conclusion: {
                        title: "Conclusion",
                        intro: "Now you know how AI language models work! The key points:",
                        insight1: {
                            title: "Learning and answering are separate",
                            description: "AI models learn once from large text corpora and then answer questions. They don't learn new facts during answering."
                        },
                        insight2: {
                            title: "Word-by-word prediction",
                            description:
                                "AI always predicts the next likely word. Responses are built word by word. The AI doesn't truly understand but recognizes patterns."
                        },
                        insight3: {
                            title: "Clear questions = better answers",
                            description: "The more specific your question, the better the answer. Provide enough details."
                        },
                        insight4: {
                            title: "Multiple sources of knowledge",
                            description: "AI uses its trained knowledge, the current conversation, and can use tools like web search to help."
                        }
                    }
                },
                intro: {
                    title: "Fundamentals of modern AI systems",
                    description: "Understand how modern AI systems like large language models (LLMs) work and are trained."
                },
                example: {
                    title: "How do large language models work?",
                    description: "An overview of the basic concepts and workings of LLMs."
                },
                features: {
                    understanding: {
                        title: "Understand LLM internals",
                        description: "Learn the core principles and architecture of large language models."
                    },
                    training_vs_inference: {
                        title: "Training vs. Inference",
                        description: "Understand the difference between training and usage phases."
                    },
                    best_practices: {
                        title: "Effective communication",
                        description: "Learn how to get better results with clear prompts."
                    }
                }
            },
            badges: {
                in_construction: "In Construction",
                popular: "Popular",
                new: "New"
            },
            prompt_engineering: {
                title: "Prompt Engineering",
                description: "Learn how to write effective prompts for better AI responses."
            },
            ai_agents: {
                title: "AI Agents",
                description: "Understand how AI agents work and what that has to do with MUCGPT."
            },
            ai_limitations: {
                title: "Limitations of MUCGPT",
                description: "What can MUCGPT not do?"
            },
            ai_applications: {
                title: "Application Possibilities of MUCGPT",
                description: "Previously we learned what MUCGPT cannot do, now let's look at what MUCGPT can do."
            },
            tools: {
                title: "Overview",
                description: "Learn what tools are in the context of MUCGPT and how you can use them effectively.",
                intro: {
                    title: "What are Tools?",
                    description:
                        "Tools are specialized functions that perform difficult tasks. MUCGPT may choose to use these to achieve better results. Examples include obtaining information not contained in the training data (e.g., through web searches or connecting from our AI search in the service finder)."
                },
                example: {
                    title: "This is how the tool selection works:",
                    description: ""
                },
                tips: {
                    relevant: {
                        title: "Select only relevant tools",
                        description:
                            "Only choose the tools that you actually need at the moment. Too many tools can slow down the response or lead to poor results."
                    }
                }
            },
            brainstorm: {
                title: "Brainstorming Tool",
                description: "Learn how to create and structure creative mind maps with the brainstorming tool.",
                intro: {
                    title: "What is the Brainstorming Tool?",
                    description:
                        "The brainstorming tool generates structured mind maps on any topic. It uses AI to collect, organize, and present creative ideas as an interactive mind map."
                },
                example: {
                    title: "Brainstorming Example",
                    description: ""
                },
                tips: {
                    specific: {
                        title: "Be Specific",
                        description: "The more precise your topic, the more targeted and relevant the generated ideas will be."
                    },
                    context: {
                        title: "Add Context",
                        description: "Add additional context to support the AI in idea generation."
                    },
                    iterate: {
                        title: "Work Iteratively",
                        description: "Use the results as a starting point and gradually refine your requests."
                    }
                }
            },
            simplify: {
                title: "Text Simplification Tool",
                description: "Learn how to translate complex texts into understandable easy language.",
                intro: {
                    title: "What is the Text Simplification Tool?",
                    description:
                        "The text simplification tool translates complex texts into easy language according to A2 standards. It uses AI with automatic quality checks to make texts more understandable and accessible."
                },
                example: {
                    title: "Example Text Simplification",
                    description: ""
                },
                tips: {
                    length: {
                        title: "Consider Text Length",
                        description: "Divide very long texts into smaller sections for better results."
                    },
                    review: {
                        title: "Check Results",
                        description: "Read through the simplified text and check that all important information is included."
                    },
                    target: {
                        title: "Target Audience",
                        description: "Easy language helps people with learning difficulties, language learners and anyone who prefers simple texts."
                    }
                }
            },
            best_practices: {
                title: "Best Practices",
                description: "Proven methods for effective use of AI assistants."
            },
            productivity_tips: {
                title: "Productivity Tips",
                description: "Increase your productivity with clever tricks and shortcuts."
            },
            tips: {
                title: "Tips and Tricks"
            },
            buttons: {
                show_example: "Show Example",
                hide_example: "Hide Example",
                try_example: "Try Example in Chat"
            }
        }
    },
    Bayrisch: {
        tutorials: {
            back_to_overview: "Zürück zur Übersicht",
            title: "Lern",
            subtitle: "wia MUCGPT funktioniert",
            sections: {
                ki_background: {
                    title: "Hintergrundwissen",
                    description: "Grundlagen und Hintergründe zur Künstlichen Intelligenz"
                },
                tools: {
                    title: "Werkzeuge",
                    description: "Was san Werkzeuge im Kontext vo MUCGPT?"
                },
                general_tips: {
                    title: "Anwendunsgtipps",
                    description: "Tipps und Best Practices für die optimale Nutzung vo MUCGPT"
                }
            },
            progress: {
                stats: "{{completed}} vo {{total}} Abschnitte gschafft"
            },
            ai_basics: {
                title: "KI-Grundlagen",
                description: "Was is KI und wia funktioniert's? Versteh die Grundlagen moderner KI-Systeme.",
                progress: {
                    title: "KI-Grundlagn-Fortschritt",
                    stats: "{{completed}} vo {{total}} Abschnitte gschafft"
                },
                sections: {
                    titles: {
                        intro: "Was san Sprachmodelle",
                        training: "Training",
                        functionality: "Wie's funktioniert",
                        access: "Was woaß a Sprachmodell?",
                        conclusion: "Fazit & Ausblick"
                    },
                    what_are_llms: {
                        title: "Was san große Sprachmodelle?",
                        description:
                            "Große Sprachmodelle (LLMs) san KI-Systeme, de glernt ham, menschliche Sprach z'verstengan und z'erschaffn. Sie tian des, indem's des nächst' Wort vorhersogn auf Basis vo riesign Textmengen.",
                        key_point: "Koa Kernprinzip:",
                        key_explanation:
                            "LLMs lernen Muster zwischn Wörtern und Konzepten und gebn Text aus, indem's des wahrscheinlichste nächste Wort auswählen."
                    },
                    phases: {
                        title: "Training"
                    },
                    training_phase: {
                        description:
                            "Des Training passiert amoi, bevor ma a LLM brauchn ko. Dös Modell lernt, Sprache z'verstehn und z'machen, mit groaßen Mengen an Text.",
                        steps_title: "Da Trainingsprozess hod de foigenden Schritte:",
                        key_concept: "Wichtig z'wissen:",
                        key_explanation:
                            "Training is sehr ressourcenintensiv und kostspielig. Große Modelle wie GPT-4 wern auf hunderten GPUs wochnlang trainiert."
                    },
                    training: {
                        step1: {
                            title: "1. Datensammlung",
                            description: "Vui Text aus'm Web, Büchern und Artikeln werdn gsammlt. Des is da Grund für's Sprachverständnis."
                        },
                        step2: {
                            title: "2. Vortraining",
                            description: "Da Modell lernt, Wörter und Sätze vorauszusogn, indem's fehlende Teile im Text ergänzt – auf Millionen Beispielen."
                        },
                        step3: {
                            title: "3. Feinabstimmung",
                            description:
                                "Des vortrainierte Modell wird no mit speziellern Daten weiter glernt, oft mit menschlicher Hilf, damit's nützlicher und sicherer wird."
                        },
                        step4: {
                            title: "4. RLHF",
                            description:
                                "Reinforcement Learning from Human Feedback: Mit menschlichem Feedback lernt's Modell, hilfreichere und sichere Antworten zu gebn."
                        }
                    },
                    how_it_works: {
                        title: "Wie's funktioniert",
                        intro: "Wie werkt a LLM, wennst a Frogn stellst? Beispiel: 'Wia is d'Wetter heit?'",
                        key_insight: "Wichtiga Einsicht:",
                        key_explanation:
                            "A LLM 'versteht' Text ned wia a Mensch, sondern erkennt statistische Muster aus'm Training und weiß, welche Wörter oft zamm kemman.",
                        architecture_intro: "D' technische Basis is de Transformer-Architektur:",
                        step1: {
                            title: "Eingabe werd z'erteilt (Tokenisierung)",
                            description: "Dein Text werd in kloane Stückl zerlegt, sogt ma Tokens. Des kenn ganze Wörter oda Wortteile sei."
                        },
                        step2: {
                            title: "Wörter werdn zu Zahlen (Embeddings)",
                            description: "Computer kinnan nur mit Zahlen rechn. Jeds Token wird in a Liste vo Zahlen umgwandlt.",
                            note: "Ähnliche Wörter ham ähnliche Zahlenmuster."
                        },
                        step3: {
                            title: "Aufmerksamkeit und Kontext (Self-Attention)",
                            description: "Des Modell schaut o alle Wörter gleichzeitig und entscheidet, welche wichtig san und wia's zammgehörn."
                        },
                        step4: {
                            title: "Information verarbeiten (Feed-Forward)",
                            description: "D'Infos werdn durch viele Schichten geschickt, damit komplexe Muster erkannt werdn.",
                            analogy: "Wia a Detektiv, der Hinweise zammsetzt."
                        },
                        step5: {
                            title: "Vorhersogn vom nächsten Wort",
                            description: "Des Modell macht a Wahrscheinlichkeitsliste fürs nächste Wort und wählt des warscheinlichste aus."
                        },
                        step6: {
                            title: "Vorgang wiederholen bis z'Ende",
                            description: "Des wiederholt si für jedes neue Wort, bis d'Antwort fertig is."
                        },
                        analogy: {
                            title: "Analogie: LLM wie a Textfabrik",
                            description: "Stell da a LLM vor wia a Textfabrik:",
                            input: "Eingabestation:",
                            input_desc: "Dein Text werd entgegnohma und zerlegt.",
                            analysis: "Analyseabteilung:",
                            analysis_desc: "Jedes Wort werd genau untersuacht und in Kontext gsetzt.",
                            production: "Produktionslinie:",
                            production_desc: "Wort für Wort werd die Antwort erzeugt.",
                            quality: "Qualitätskontrolle:",
                            quality_desc: "Jedes Wort werd auf Plausibilität überprüft."
                        }
                    },
                    access: {
                        title: "Was woaß a Sprachmodell?",
                        training_data: {
                            title: "Trainingsdaten",
                            description:
                                "LLMs nutzen s'Wissen und die Muster, de's beim Training glernt ham. Dazua ghörn Fakten, Sprachregeln und Wissen bis zu am bestimmten Zeitpunkt."
                        },
                        conversation: {
                            title: "Aktuelle Konversation",
                            description: "Des Modell schaut auf'n aktuellen Gesprächsverlauf, damit's kontextbezogene Antworten gebn ko."
                        },
                        tools: {
                            title: "Erweiterte Werkzeuge",
                            description:
                                "Moderne KI ko mit Werkzeugen ausgestattet sei wie Websuach oder Datenbankzugriff, damit's aktuellere oder spezifischere Infos bringt."
                        }
                    },
                    conclusion: {
                        title: "Fazit",
                        intro: "Jetzt woaßt du, wie KI-Sprachmodelle funktioniern! De wos Wichtigste:",
                        insight1: {
                            title: "Lerne und Antwortn san getrennt",
                            description: "De Modelle lerna amoi aus vü Text und dann beantworten's Frogn. Beim Antworten lernan's nix Neies dazua."
                        },
                        insight2: {
                            title: "Wort für Wort Vorhersogn",
                            description:
                                "De KI rät imma des nächst' passende Wort. So entsteht a Antwort – Wort für Wort. Sie versteht ned wirklich, sondern erkennt Muster."
                        },
                        insight3: {
                            title: "Kloare Frogn = bessere Antworten",
                            description: "Je genauer'd deine Frogn stellst, desto besser wird d'Schreiberei. Gib genuch Details."
                        },
                        insight4: {
                            title: "Verschiedene Wissensquellen",
                            description: "De KI nutzt ihr glernts Wissen, den aktuellen Gesprächsverlauf und ko a Werkzeuge wie Websuach einsetz'n."
                        }
                    }
                },
                intro: {
                    title: "Grundlegn vo modernen KI-Systemen",
                    description: "Versteh, wia moderne KI-Systeme wia große Sprachmodelle (LLMs) funktioniern und glernt werdn."
                },
                example: {
                    title: "Wia funktioniern große Sprachmodelle?",
                    description: "A Überblick über de Grundkonzepte und wia LLMs arbeitn."
                },
                features: {
                    understanding: {
                        title: "Wie a LLM funktioniert verstehen",
                        description: "Lern de Grundprinzipien und d'Architektur vo großen Sprachmodellen."
                    },
                    training_vs_inference: {
                        title: "Training vs. Nutzung",
                        description: "Versteh da Unterschied zwischn Training und Einsatz."
                    },
                    best_practices: {
                        title: "Effektive Kommunikation",
                        description: "Lern, wia ma mit kloaren Prompts bessre Ergebnisse kriagt."
                    }
                }
            },
            badges: {
                in_construction: "Im Aufbau",
                popular: "Beliebt",
                new: "Neu"
            },
            prompt_engineering: {
                title: "Prompt Engineering",
                description: "Lern, wia de effektive Prompts schreibst für bessere KI-Antworten."
            },
            ai_agents: {
                title: "KI-Agenten",
                description: "Versteh, wia KI-Agenten funktionieren und was des mit MUCGPT zu tun hat."
            },
            ai_limitations: {
                title: "Limitierungen von MUCGPT",
                description: "Was kann MUCGPT ned?"
            },
            ai_applications: {
                title: "Einsatzmöglichkeiten von MUCGPT",
                description: "Vorher hamma glernt, was MUCGPT ned kann, jetz schau ma uns an, was MUCGPT kann."
            },
            tools: {
                title: "Übersicht",
                description: "Lern, was Werkzeuge im Kontext von MUCGPT san und wia du sie effektiv nutzen kannst.",
                intro: {
                    title: "Was sind Werkzeuge?",
                    description:
                        "Werkzeuge san spezialisierte Funktionen, die schwierige Aufgaben erledigen. MUCGPT kann sich entscheiden, diese zu benutzen, um bessere Ergebnisse zu kriegen. Beispiele san die Beschaffung von Informationen, die ned in den Trainingsdaten enthalten san (z.B. über Websuche oder die Anbindung von unserer KI-Suche im Dienstleistungsfinder)."
                },
                example: {
                    title: "So funktioniert die Werkzeug-Auswahl:",
                    description: ""
                },
                tips: {
                    relevant: {
                        title: "Nur relevante Werkzeuge wählen",
                        description:
                            "Wähl nur die Werkzeuge aus, die du grad wirklich brauchst. Zu viele Werkzeuge können die Antwort verlangsamen oder zu schlechten Ergebnissen führen."
                    }
                }
            },
            brainstorm: {
                title: "Brainstorming Werkzeug",
                description: "Lern, wia du mit dem Brainstorming-Werkzeug kreative Mindmaps erstellen und strukturieren kannst.",
                intro: {
                    title: "Was ist das Brainstorming Werkzeug?",
                    description:
                        "Das Brainstorming-Werkzeug generiert strukturierte Mindmaps zu jedem Thema. Es nutzt KI, um kreative Ideen zu sammeln, zu organisieren und als interaktive Mindmap darzustellen."
                },
                example: {
                    title: "Brainstorming Beispiel",
                    description: ""
                },
                tips: {
                    specific: {
                        title: "Sei spezifisch",
                        description: "Je präziser dein Thema, desto gezielter und relevanter werden die generierten Ideen."
                    },
                    context: {
                        title: "Kontext hinzufügen",
                        description: "Füg zusätzlichen Kontext hinzu, um die KI bei der Ideengenerierung zu unterstützen."
                    },
                    iterate: {
                        title: "Iterativ arbeiten",
                        description: "Nutze die Ergebnisse als Ausgangspunkt und verfeinere deine Anfragen schrittweise."
                    }
                }
            },
            simplify: {
                title: "Text-Vereinfachung Werkzeug",
                description: "Erfahre, wia du komplexe Texte in verständliche Leichte Sprache übersetzt.",
                intro: {
                    title: "Was ist das Text-Vereinfachungs-Werkzeug?",
                    description:
                        "Das Text-Vereinfachungs-Werkzeug übersetzt komplexe Texte in Leichte Sprache nach A2-Standard. Es nutzt KI mit automatischer Qualitätsprüfung, um Texte verständlicher und barrierefreier zu machen."
                },
                example: {
                    title: "Beispiel Text-Vereinfachung",
                    description: ""
                },
                tips: {
                    length: {
                        title: "Textlänge beachten",
                        description: "Sehr lange Texte in kleinere Abschnitte aufteilen für bessere Ergebnisse."
                    },
                    review: {
                        title: "Ergebnis prüfen",
                        description: "Les den vereinfachten Text durch und schau, ob alle wichtigen Informationen enthalten san."
                    },
                    target: {
                        title: "Zielgruppe",
                        description: "Leichte Sprache hilft Menschen mit Lernschwierigkeiten, Sprachlernenden und allen, die einfache Texte bevorzugen."
                    }
                }
            },
            best_practices: {
                title: "Best Practices",
                description: "Bewährte Methoden für a effektive Nutzung der KI-Assistenten."
            },
            productivity_tips: {
                title: "Produktivitäts-Tipps",
                description: "Steigert deine Produktivität mit cleveren Tricks und Shortcuts."
            },
            features: {
                title: "Funktionen"
            },
            tips: {
                title: "Tipps und Tricks"
            },
            buttons: {
                show_example: "Beispiel anzeigen",
                hide_example: "Beispiel ausblenden",
                try_example: "Beispiel im Chat ausprobieren"
            }
        }
    },
    French: {
        tutorials: {
            back_to_overview: "Retour à l'aperçu",
            title: "Apprendre",
            subtitle: "comment fonctionne MUCGPT",
            sections: {
                ki_background: {
                    title: "Connaissances de base",
                    description: "Fondamentaux et contextes de l'intelligence artificielle"
                },
                tools: {
                    title: "Outils",
                    description: "Quels sont les outils dans le contexte de MUCGPT ?"
                },
                general_tips: {
                    title: "Conseils d'application",
                    description: "Conseils et meilleures pratiques pour une utilisation optimale de MUCGPT"
                }
            },
            progress: {
                stats: "{{completed}} sur {{total}} sections terminées"
            },
            ai_basics: {
                title: "Bases de l'IA",
                description: "Qu'est-ce que l'IA et comment ça fonctionne ? Comprendre les fondements des systèmes d'IA modernes.",

                progress: {
                    title: "Progression - Bases de l'IA",
                    stats: "{{completed}} sur {{total}} sections terminées"
                },
                sections: {
                    titles: {
                        intro: "Que sont les modèles de langage",
                        training: "Entraînement",
                        functionality: "Fonctionnement",
                        access: "Que sait un modèle de langage ?",
                        conclusion: "Conclusion et perspectives"
                    },
                    what_are_llms: {
                        title: "Que sont les grands modèles de langage ?",
                        description:
                            "Les grands modèles de langage (LLM) sont des systèmes d'IA entraînés pour comprendre et générer le langage humain. Ils prédisent le mot suivant à partir de grandes quantités de texte.",
                        key_point: "Principe fondamental :",
                        key_explanation:
                            "Les LLM apprennent des motifs entre les mots et les concepts et génèrent du texte en choisissant le mot le plus probable."
                    },
                    phases: {
                        title: "Entraînement"
                    },
                    training_phase: {
                        description:
                            "La phase d'entraînement a lieu une seule fois avant que le LLM puisse être utilisé. Le modèle apprend à comprendre et générer le langage à partir de vastes ensembles de textes.",
                        steps_title: "Le processus d'entraînement comprend les étapes suivantes :",
                        key_concept: "Important à comprendre :",
                        key_explanation:
                            "L'entraînement est gourmand en ressources et coûteux. Les grands modèles comme GPT-4 sont entraînés sur des centaines de GPU pendant des semaines."
                    },
                    training: {
                        step1: {
                            title: "1. Collecte des données",
                            description:
                                "De grandes quantités de textes provenant du web, de livres et d'articles sont rassemblées. Elles constituent la base de la compréhension linguistique."
                        },
                        step2: {
                            title: "2. Pré-entraînement",
                            description:
                                "Le modèle apprend à prédire des mots et des phrases en comblant des parties manquantes du texte sur des millions d'exemples."
                        },
                        step3: {
                            title: "3. Ajustement fin",
                            description:
                                "Le modèle pré-entraîné est ensuite affiné sur des données plus spécifiques, souvent avec l'aide humaine, pour améliorer son utilité et sa sécurité."
                        },
                        step4: {
                            title: "4. RLHF",
                            description:
                                "Le renforcement par feedback humain (RLHF) aide le modèle à produire des réponses plus utiles et plus sûres grâce à des évaluations humaines."
                        }
                    },
                    how_it_works: {
                        title: "Fonctionnement",
                        intro: "Comment fonctionne un LLM lorsque vous posez une question ? Exemple : 'Quel temps fait-il aujourd'hui ?'",
                        key_insight: "Idée clé :",
                        key_explanation:
                            "Un LLM ne 'comprend' pas le texte comme un humain ; il reconnaît des motifs statistiques issus de l'entraînement et sait quels mots apparaissent souvent ensemble.",
                        architecture_intro: "La base technique est l'architecture Transformer :",
                        step1: {
                            title: "L'entrée est découpée (tokenisation)",
                            description:
                                "Votre texte est découpé en petits éléments appelés tokens. Ce peuvent être des mots entiers ou des sous-parties de mots."
                        },
                        step2: {
                            title: "Les mots deviennent des nombres (embeddings)",
                            description: "Les ordinateurs manipulent des nombres, pas des mots. Chaque token est converti en une liste de nombres.",
                            note: "Les mots similaires ont des motifs numériques proches."
                        },
                        step3: {
                            title: "Attention et contexte (self-attention)",
                            description: "Le modèle examine tous les mots simultanément et décide lesquels sont importants et comment ils se relient."
                        },
                        step4: {
                            title: "Traitement de l'information (feed-forward)",
                            description: "Les informations combinées traversent de nombreuses couches pour détecter des motifs complexes.",
                            analogy: "Comme un détective qui reconstitue des indices."
                        },
                        step5: {
                            title: "Prédiction du mot suivant",
                            description: "Le modèle génère une liste de probabilités pour le mot suivant et sélectionne le plus probable."
                        },
                        step6: {
                            title: "Répétition pour la réponse complète",
                            description: "Ce processus se répète pour chaque nouveau mot jusqu'à ce que la réponse complète soit produite."
                        },
                        analogy: {
                            title: "Analogie : le LLM comme usine à texte",
                            description: "Pensez à un LLM comme à une usine à texte :",
                            input: "Poste d'entrée :",
                            input_desc: "Votre texte est reçu et découpé.",
                            analysis: "Service d'analyse :",
                            analysis_desc: "Chaque mot est examiné et mis en contexte.",
                            production: "Chaîne de production :",
                            production_desc: "La réponse est produite mot par mot.",
                            quality: "Contrôle qualité :",
                            quality_desc: "Chaque mot est vérifié pour sa plausibilité."
                        }
                    },
                    access: {
                        title: "Que sait un modèle de langage ?",
                        training_data: {
                            title: "Données d'entraînement",
                            description:
                                "Les LLM utilisent les connaissances et les motifs appris pendant l'entraînement, y compris les faits, les règles linguistiques et les informations jusqu'à une date de coupure."
                        },
                        conversation: {
                            title: "Conversation actuelle",
                            description: "Le modèle a accès à l'historique de la conversation en cours pour fournir des réponses adaptées au contexte."
                        },
                        tools: {
                            title: "Outils étendus",
                            description:
                                "Les IA modernes peuvent être équipées d'outils comme la recherche web ou l'accès aux bases de données pour fournir des informations plus à jour ou spécifiques."
                        }
                    },
                    conclusion: {
                        title: "Conclusion",
                        intro: "Vous savez maintenant comment fonctionnent les modèles de langage ! Les points clés :",
                        insight1: {
                            title: "Apprentissage et réponse sont distincts",
                            description:
                                "Les modèles apprennent une fois à partir de larges corpus de textes, puis répondent aux questions. Ils n'apprennent pas de nouveaux faits lors de la génération de réponses."
                        },
                        insight2: {
                            title: "Prédiction mot par mot",
                            description:
                                "L'IA prédit toujours le mot suivant le plus probable. Les réponses se construisent mot par mot. L'IA ne comprend pas vraiment, elle reconnaît des motifs."
                        },
                        insight3: {
                            title: "Questions claires = meilleures réponses",
                            description: "Plus votre question est précise, meilleure sera la réponse. Donnez suffisamment de détails."
                        },
                        insight4: {
                            title: "Plusieurs sources de connaissances",
                            description:
                                "L'IA utilise ses connaissances entraînées, la conversation en cours et peut recourir à des outils comme la recherche web pour aider."
                        }
                    }
                },
                intro: {
                    title: "Principes des systèmes d'IA modernes",
                    description: "Comprenez comment fonctionnent et sont entraînés les systèmes d'IA modernes, comme les grands modèles de langage (LLM)."
                },
                example: {
                    title: "Comment fonctionnent les grands modèles de langage ?",
                    description: "Un aperçu des concepts de base et du fonctionnement des LLM."
                },
                features: {
                    understanding: {
                        title: "Comprendre le fonctionnement des LLM",
                        description: "Apprenez les principes de base et l'architecture des grands modèles de langage."
                    },
                    training_vs_inference: {
                        title: "Entraînement vs inférence",
                        description: "Comprenez la différence entre la phase d'entraînement et la phase d'utilisation."
                    },
                    best_practices: {
                        title: "Communication efficace",
                        description: "Apprenez à obtenir de meilleurs résultats avec des requêtes claires."
                    }
                }
            },
            badges: {
                in_construction: "En construction",
                popular: "Populaire",
                new: "Nouveau"
            },
            prompt_engineering: {
                title: "Ingénierie des prompts",
                description: "Apprenez à écrire des prompts efficaces pour de meilleures réponses de l'IA."
            },
            ai_agents: {
                title: "Agents IA",
                description: "Comprenez comment fonctionnent les agents IA et ce que cela a à voir avec MUCGPT."
            },
            ai_limitations: {
                title: "Limitations de MUCGPT",
                description: "Que ne peut pas faire MUCGPT ?"
            },
            ai_applications: {
                title: "Possibilités d'utilisation de MUCGPT",
                description: "Auparavant, nous avons appris ce que MUCGPT ne peut pas faire, maintenant voyons ce que MUCGPT peut faire."
            },
            tools: {
                title: "Aperçu",
                description: "Découvrez quels sont les outils dans le contexte de MUCGPT et comment vous pouvez les utiliser efficacement.",
                intro: {
                    title: "Que sont les outils ?",
                    description:
                        "Les outils sont des fonctions spécialisées qui accomplissent des tâches difficiles. MUCGPT peut choisir de les utiliser pour obtenir de meilleurs résultats. Des exemples incluent l'obtention d'informations qui ne figurent pas dans les données d'entraînement (par exemple, via une recherche sur le web ou la connexion de notre recherche IA dans le moteur de recherche de services)."
                },
                example: {
                    title: "Voici comment fonctionne la sélection d'outils :",
                    description: ""
                },
                tips: {
                    relevant: {
                        title: "Sélectionnez uniquement les outils pertinents",
                        description:
                            "Choisissez uniquement les outils dont vous avez réellement besoin. Trop d'outils peuvent ralentir la réponse ou conduire à de mauvais résultats."
                    }
                }
            },
            brainstorm: {
                title: "Outil de brainstorming",
                description: "Apprenez comment créer et structurer des cartes mentales créatives avec l'outil de brainstorming.",
                intro: {
                    title: "Qu'est-ce que l'outil de brainstorming ?",
                    description:
                        "L'outil de brainstorming génère des cartes mentales structurées sur n'importe quel sujet. Il utilise l'IA pour collecter, organiser et présenter des idées créatives sous forme de carte mentale interactive."
                },
                example: {
                    title: "Exemple de brainstorming",
                    description: ""
                },
                tips: {
                    specific: {
                        title: "Soyez spécifique",
                        description: "Plus votre sujet est précis, plus les idées générées seront ciblées et pertinentes."
                    },
                    context: {
                        title: "Ajoutez du contexte",
                        description: "Ajoutez un contexte supplémentaire pour aider l'IA dans la génération d'idées."
                    },
                    iterate: {
                        title: "Travaillez de manière itérative",
                        description: "Utilisez les résultats comme point de départ et affinez progressivement vos demandes."
                    }
                }
            },
            simplify: {
                title: "Outil de simplification de texte",
                description: "Apprenez comment traduire des textes complexes en langage simple et compréhensible.",
                intro: {
                    title: "Qu'est-ce que l'outil de simplification de texte ?",
                    description:
                        "L'outil de simplification de texte traduit des textes complexes en langage simple selon les normes A2. Il utilise l'IA avec un contrôle automatique de la qualité pour rendre les textes plus compréhensibles et accessibles."
                },
                example: {
                    title: "Exemple de simplification de texte",
                    description: ""
                },
                tips: {
                    length: {
                        title: "Faire attention à la longueur du texte",
                        description: "Divisez les textes très longs en sections plus petites pour de meilleurs résultats."
                    },
                    review: {
                        title: "Vérifiez le résultat",
                        description: "Lisez le texte simplifié et vérifiez si toutes les informations importantes sont incluses."
                    },
                    target: {
                        title: "Public cible",
                        description:
                            "Le langage simple aide les personnes ayant des difficultés d'apprentissage, les apprenants de langues et tous ceux qui préfèrent des textes simples."
                    }
                }
            },
            best_practices: {
                title: "Meilleures pratiques",
                description: "Méthodes éprouvées pour une utilisation efficace des assistants IA."
            },
            productivity_tips: {
                title: "Conseils de productivité",
                description: "Augmentez votre productivité avec des astuces et des raccourcis intelligents."
            },
            tips: {
                title: "Conseils et astuces"
            },
            buttons: {
                show_example: "Afficher l'exemple",
                hide_example: "Masquer l'exemple",
                try_example: "Essayer l'exemple dans le chat"
            }
        }
    },
    Ukrainisch: {
        tutorials: {
            back_to_overview: "Повернутися до огляду",
            title: "Навчитися",
            subtitle: "як працює MUCGPT",
            sections: {
                ki_background: {
                    title: "Базові знання",
                    description: "Основи та фон штучного інтелекту"
                },
                tools: {
                    title: "Інструменти",
                    description: "Що таке інструменти в контексті MUCGPT?"
                },
                general_tips: {
                    title: "Поради щодо застосування",
                    description: "Поради та найкращі практики для оптимального використання MUCGPT"
                }
            },
            progress: {
                stats: "{{completed}} з {{total}} розділів завершено"
            },
            ai_basics: {
                title: "Основи ШІ",
                description: "Що таке ШІ і як це працює? Зрозумійте основи сучасних систем ШІ.",

                progress: {
                    title: "Прогрес: основи ШІ"
                },
                sections: {
                    titles: {
                        intro: "Що таке мовні моделі",
                        training: "Навчання",
                        functionality: "Як це працює",
                        access: "Що знає мовна модель?",
                        conclusion: "Висновок і перспективи"
                    },
                    what_are_llms: {
                        title: "Що таке великі мовні моделі?",
                        description:
                            "Великі мовні моделі (LLM) — це системи ШІ, навчені розуміти й генерувати людську мову. Вони прогнозують наступне слово на основі великих обсягів тексту.",
                        key_point: "Основний принцип:",
                        key_explanation: "LLM вивчають закономірності між словами та поняттями і генерують текст, обираючи найймовірніше наступне слово."
                    },
                    phases: {
                        title: "Навчання"
                    },
                    training_phase: {
                        description:
                            "Фаза навчання відбувається один раз перед використанням LLM. Модель вчиться розуміти й генерувати мову, використовуючи величезні набори текстів.",
                        steps_title: "Процес навчання включає такі кроки:",
                        key_concept: "Важливо знати:",
                        key_explanation: "Навчання потребує багато ресурсів і є дорогим. Великі моделі, як GPT-4, навчають на сотнях GPU тижнями."
                    },
                    training: {
                        step1: {
                            title: "1. Збір даних",
                            description: "Збирають великі обсяги тексту з інтернету, книг і статей. Це основа для розуміння мови."
                        },
                        step2: {
                            title: "2. Попереднє навчання",
                            description: "Модель вчиться прогнозувати слова й речення, заповнюючи відсутні частини тексту на мільйонах прикладів."
                        },
                        step3: {
                            title: "3. Тонке налаштування",
                            description:
                                "Попередньо навчена модель додатково налаштовується на спеціалізованих даних, часто за участю людей, щоб покращити корисність і безпеку."
                        },
                        step4: {
                            title: "4. RLHF",
                            description:
                                "Підкріплювальне навчання з людським фідбеком (RLHF) допомагає моделі давати більш корисні та безпечні відповіді завдяки оцінкам людей."
                        }
                    },
                    how_it_works: {
                        title: "Як це працює",
                        intro: "Як працює LLM, коли ви ставите питання? Приклад: «Яка сьогодні погода?»",
                        key_insight: "Ключова думка:",
                        key_explanation:
                            "LLM не «розуміє» текст як людина; воно розпізнає статистичні патерни з навчання й знає, які слова часто зустрічаються разом.",
                        architecture_intro: "Технічна основа — архітектура Transformer:",
                        step1: {
                            title: "Вхід розбивається (токенізація)",
                            description: "Текст розбивається на дрібні частини — токени. Це можуть бути слова або частини слів."
                        },
                        step2: {
                            title: "Слова стають числами (ембеддинги)",
                            description: "Комп’ютери працюють з числами, а не зі словами. Кожен токен перетворюється на список чисел.",
                            note: "Схожі слова мають схожі числові патерни."
                        },
                        step3: {
                            title: "Увага та контекст (self-attention)",
                            description: "Модель одночасно аналізує всі слова й вирішує, які важливі та як вони пов'язані."
                        },
                        step4: {
                            title: "Обробка інформації (feed-forward)",
                            description: "Комбіновані дані проходять через багато шарів для виявлення складних закономірностей.",
                            analogy: "Як детектив, що складає підказки докупи."
                        },
                        step5: {
                            title: "Прогноз наступного слова",
                            description: "Модель складає список ймовірностей для наступного слова і вибирає найймовірніше."
                        },
                        step6: {
                            title: "Повторення для повної відповіді",
                            description: "Цей процес повторюється для кожного нового слова, поки не буде згенерована повна відповідь."
                        },
                        analogy: {
                            title: "Аналогія: LLM як текстова фабрика",
                            description: "Уявіть LLM як фабрику тексту:",
                            input: "Вхідна станція:",
                            input_desc: "Ваш текст приймається і розбивається.",
                            analysis: "Відділ аналізу:",
                            analysis_desc: "Кожне слово перевіряють і ставлять у контекст.",
                            production: "Виробнича лінія:",
                            production_desc: "Відповідь створюється слово за словом.",
                            quality: "Контроль якості:",
                            quality_desc: "Кожне слово перевіряють на правдоподібність."
                        }
                    },
                    access: {
                        title: "Що знає мовна модель?",
                        training_data: {
                            title: "Дані навчання",
                            description: "LLM використовують знання й патерни, набуті під час навчання: факти, мовні правила та інформацію до певного моменту."
                        },
                        conversation: {
                            title: "Поточна розмова",
                            description: "Модель має доступ до історії поточної розмови, щоб давати відповіді з урахуванням контексту."
                        },
                        tools: {
                            title: "Додаткові інструменти",
                            description:
                                "Сучасні системи ШІ можуть бути обладнані інструментами, наприклад веб-пошуком або доступом до баз даних, щоб надавати більш актуальну або специфічну інформацію."
                        }
                    },
                    conclusion: {
                        title: "Висновок",
                        intro: "Тепер ви знаєте, як працюють мовні моделі! Основні моменти:",
                        insight1: {
                            title: "Навчання й відповіді — різні речі",
                            description:
                                "Моделі навчаються один раз на великих корпусах тексту, а потім відповідають на питання. Вони не дізнаються нових фактів під час відповіді."
                        },
                        insight2: {
                            title: "Прогноз слово за словом",
                            description:
                                "ШІ завжди прогнозує наступне найбільш ймовірне слово. Відповіді будуються слово за словом. ШІ не «розуміє» по-людськи, а розпізнає патерни."
                        },
                        insight3: {
                            title: "Чіткі запитання = кращі відповіді",
                            description: "Чим конкретніше ваше запитання, тим кращою буде відповідь. Надавайте достатньо деталей."
                        },
                        insight4: {
                            title: "Декілька джерел знань",
                            description: "ШІ використовує навчений запас знань, поточну розмову і може звертатися до інструментів, як веб-пошук, щоб допомогти."
                        }
                    }
                },
                intro: {
                    title: "Основи сучасних систем ШІ",
                    description: "Зрозумійте, як працюють і навчаються сучасні системи ШІ, такі як великі мовні моделі (LLM)."
                },
                example: {
                    title: "Як працюють великі мовні моделі?",
                    description: "Огляд основних концепцій і принципів роботи LLM."
                },
                features: {
                    understanding: {
                        title: "Зрозуміти внутрішню роботу LLM",
                        description: "Вивчіть основні принципи та архітектуру великих мовних моделей."
                    },
                    training_vs_inference: {
                        title: "Навчання vs. inference",
                        description: "Зрозумійте різницю між фазою навчання та фазою використання."
                    },
                    best_practices: {
                        title: "Ефективна комунікація",
                        description: "Дізнайтесь, як отримувати кращі результати за допомогою чітких запитів."
                    }
                }
            },
            badges: {
                in_construction: "В розробці",
                popular: "Популярний",
                new: "Новий"
            },
            prompt_engineering: {
                title: "Інженерія запитів",
                description: "Навчіться писати ефективні запити для кращих відповідей ШІ."
            },
            ai_agents: {
                title: "Агенти ШІ",
                description: "Зрозумійте, як працюють агенти ШІ і що це має спільного з MUCGPT."
            },
            ai_limitations: {
                title: "Обмеження MUCGPT",
                description: "Що MUCGPT не може?"
            },
            ai_applications: {
                title: "Можливості використання MUCGPT",
                description: "Раніше ми дізналися, що MUCGPT не може, тепер давайте подивимось, що MUCGPT може."
            },
            tools: {
                title: "Огляд",
                description: "Дізнайтеся, що таке інструменти в контексті MUCGPT і як їх можна використовувати ефективно.",
                intro: {
                    title: "Що таке інструменти?",
                    description:
                        "Інструменти - це спеціалізовані функції, які виконують складні завдання. MUCGPT може вибрати їх для досягнення кращих результатів. Прикладами є отримання інформації, яка не входить до навчальних даних (наприклад, через веб-пошук або підключення з нашого ШІ-пошуку в пошуковику послуг)."
                },
                example: {
                    title: "Ось як працює вибір інструментів:",
                    description: ""
                },
                tips: {
                    relevant: {
                        title: "Вибирайте лише релевантні інструменти",
                        description:
                            "Оберіть лише ті інструменти, які вам дійсно потрібні. Занадто багато інструментів можуть сповільнити відповідь або призвести до поганих результатів."
                    }
                }
            },
            brainstorm: {
                title: "Інструмент для мозкового штурму",
                description: "Дізнайтеся, як створювати та структурувати креативні мапи мислення за допомогою інструмента для мозкового штурму.",
                intro: {
                    title: "Що таке інструмент для мозкового штурму?",
                    description:
                        "Інструмент для мозкового штурму генерує структуровані мапи мислення на будь-яку тему. Він використовує ШІ для збору, організації та представлення креативних ідей у вигляді інтерактивної мапи мислення."
                },
                example: {
                    title: "Приклад мозкового штурму",
                    description: ""
                },
                tips: {
                    specific: {
                        title: "Будьте специфічними",
                        description: "Чим точніше ваша тема, тим орієнтованішими та релевантнішими будуть згенеровані ідеї."
                    },
                    context: {
                        title: "Додайте контекст",
                        description: "Додайте додатковий контекст, щоб підтримати ШІ в генерації ідей."
                    },
                    iterate: {
                        title: "Працюйте ітеративно",
                        description: "Використовуйте результати як вихідну точку та поступово вдосконалюйте свої запити."
                    }
                }
            },
            simplify: {
                title: "Інструмент спрощення тексту",
                description: "Дізнайтеся, як переводити складні тексти на зрозумілу просту мову.",
                intro: {
                    title: "Що таке інструмент спрощення тексту?",
                    description:
                        "Інструмент спрощення тексту переводить складні тексти на просту мову згідно стандарту A2. Він використовує ШІ з автоматичною перевіркою якості для того, щоб зробити тексти більш зрозумілими та доступними."
                },
                example: {
                    title: "Приклад спрощення тексту",
                    description: ""
                },
                tips: {
                    length: {
                        title: "Звертайте увагу на довжину тексту",
                        description: "Діліть дуже довгі тексти на менші частини для кращих результатів."
                    },
                    review: {
                        title: "Перевірте результати",
                        description: "Перегляньте спрощений текст і перевірте, чи міститься вся важлива інформація."
                    },
                    target: {
                        title: "Цільова аудиторія",
                        description:
                            "Проста мова допомагає людям з проблемами навчання, тим, хто вивчає мову, а також усім, хто віддає перевагу простим текстам."
                    }
                }
            },
            best_practices: {
                title: "Найкращі практики",
                description: "Перевірені методи ефективного використання асистентів ШІ."
            },
            productivity_tips: {
                title: "Поради щодо продуктивності",
                description: "Підвищте свою продуктивність з розумними хитрощами та гарячими клавішами."
            },
            tips: {
                title: "Поради та хитрощі"
            },
            buttons: {
                show_example: "Показати приклад",
                hide_example: "Сховати приклад",
                try_example: "Спробувати приклад в чаті"
            }
        }
    }
};
