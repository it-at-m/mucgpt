# Features

This page highlights the key capabilities of MUCGPT. Future work is listed in the [Roadmap](/README.md/#roadmap).

MUCGPT is an assistant-first product. Assistants are reusable, workflow-specific chat configurations with their own instructions, behavior, optional tools, and sharing scope. Chat is where work happens; assistants provide structure so recurring work becomes faster and more reliable.

## Chat

![Chat](/docs/chatscreen.png)
The chat provides a clear space to work with the underlying language model on almost any topic.
- Configure a system instruction to guide responses and adjust temperature to balance factual vs. creative output.
- Multi-turn conversations are supported. History stays local in the browser (IndexedDB). You can continue past conversations and mark favorites for quick access.

## Create Assistants

![Assistant Creator](/docs/assistant_creator.png)
Design assistants that encode recurring instructions, tone, constraints, and model settings. Optionally add starter prompts, follow-up actions, and tools. Private assistants remain yours; you decide when to share more broadly.

## Share Assistants

![Share Assistants](/docs/share_assistants.png)
Share assistants with selected teams or wider audiences. MUCGPT makes ownership, scope, and configuration transparent so colleagues understand what an assistant does before relying on it.

## Extensible Tools

![Tools](/docs/tools.png)
Assistants can use built-in and extendable tools. Examples include:
- Summarization for condensing long texts.
- Brainstorming to generate mind maps that can be exported and refined.
- Easy Language to translate complex text into simpler language.

These examples are illustrative—the platform is designed to grow with additional tools as organizational needs evolve.

## Start Page

![Start Page](/docs/startpage.png)
A focused entry point to discover assistants, jump back into recent work, and access tutorials.

## Model Selection

![Models](/docs/models.png)
Choose from available models and adjust creativity to fit the task. Model choices are transparent to the user.

## Speech-to-Text (Beta)

Dictate directly into the chat input: a microphone button appears next to the input field once speech-to-text is enabled. Transcribed text is appended to what you have already typed, so typing and dictation can be freely combined.

- **Runs entirely on your device.** Audio is transcribed locally in your browser — nothing is uploaded, and no microphone input leaves your device.
- **Model choice with language hints.** The settings dialog lists every model with its download size and supported languages, so you can pick the right one at a glance. Models download once and are cached in the browser.
- **Language follows the interface language.** German interface → German transcription, with automatic language detection where the model supports it.
- **Voice activity detection.** Recording stops automatically after a pause; segments are transcribed live while you speak.

Available models (lineup grows over time):

| Model | Languages | Requirements |
|---|---|---|
| Whisper Small | Multilingual (incl. German) | None (runs on CPU/WASM) |
| Whisper Large v3 Turbo | Multilingual (incl. German) | WebGPU |
| Whisper Large v3 Turbo German | German | WebGPU |
| Distil-Whisper Large v3 German | German | None (runs on CPU/WASM) |
| NVIDIA Canary 180M Flash | English, German, French, Spanish | None (runs on CPU/WASM) |
| NVIDIA Parakeet TDT 0.6B v3 | 25 languages, automatic detection (incl. Ukrainian) | None (runs on CPU/WASM) |

The feature must be enabled per deployment; if the microphone button is missing, your administrator has not activated it yet.

## Tutorials

![Tutorials](/docs/tutorials.png)
Guided examples and tips to help first-time and experienced users get value quickly.

## Dark Mode and i18n

![Dark Mode & i18n](/docs/darkmode_i18n.png)
Accessible UI with dark mode support and internationalization.

## General Features

Generated text in various formats is displayed correctly. The formats currently supported are:

- Markdown
- PLAIN HTML
- Mermaid diagrams embedded in Markdown code blocks
- Mathematical formulas written in LaTeX, enclosed within `$$ ... $$` delimiters
