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
