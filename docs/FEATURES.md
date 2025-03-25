# Features

In the following some important Features of MUCGPT are listed. Future Features are listed in the [Roadmap](/README.md/#roadmap).

MUCGPT has four main features and it offers the possibilty to create your [own assitents](#own-assistants) with your specific features. The main features ar [Chat](#chat) to chat with the underlying LLM, [Summarize](#summarize) to summarize long texts and files, [Brainstorming](#brainstorming) to get a mind map on a given topic and [Simplified Language](#simplified-language) to translate text to easier langaugae and make it more understandable.

## Chat

![Chat](/docs/chatscreen.png)
The chat feature of MUCGPT is a typical chat room where you can text with the LLM to get information about almost anything.
MUCGPT is able to generate responses that closely resemble those of a human because of the large pre-trained language model it uses. It has a number of features and capabilities that enable it to perform natural language processing, multi-turn conversations, personalisation, sentiment analysis, knowledge retrieval and task completion. These capabilities allow MUCGPT to understand and respond to user queries in a way that is tailored to their needs, making it a powerful tool for any use case where human-like interaction is desired.
In addition, MUCGPT allows users to configure a system prompt that is added as a prefix to any message sent by the user. The temperature of the generated response can also be adjusted, controlling the randomness or creativity of the model's output.
The chat feature includes a chat history that allows users to view their previous conversations and pick up where they left off. Additionally, users can mark important chats as favorites for quicker access. All chat history is saved locally on the user's browser using IndexedDB, ensuring no chat data is stored in the cloud or elsewhere.
![History](/app/frontend/src/assets/History.png)

## Summarize

![Sum](/docs/sum.png)
The Summarize feature allows users to condense long texts or documents and extract the most relevant information to create a new, summarized text. The user can adjust the level of detail of the generated answer in three levels (short, medium, long).

## Brainstorming

![Brainstoming](/docs/mindmap.png)
The Brainstorming feature allows users to create mind maps to help them find inspiration on a given topic.
The resulting mindmaps can be downloaded and further processed using [Freeplane](https://docs.freeplane.org/).

## Simplified language

![Simplyfied Lannguage](/docs/simply.png)
Simplified language is a feature that enables users to translate complex texts into plain or easy language. This functionality is particularly useful for individuals who struggle with reading comprehension or for whom the original language is not their native tongue. By converting intricate sentences and advanced vocabulary into simpler structures and more familiar words, the tool makes the text more understandable and easier to read. This not only enhances the accessibility of the content but also promotes inclusivity by catering to a broader audience with varying levels of language proficiency. The prompts and logic of this feature are rooted in the Project of the Cantonal Administration of Zurich ([Github](https://github.com/machinelearningZH/simply-simplify-language)).

## Own Assistants

![Own Assistant UI](/docs/own-assistant.png)
MUCGPT allows users to create their own custom assistants tailored to specific needs and use cases. By defining unique prompts and configuring the behavior of the language model, users can develop assistants that perform specialized tasks or provide targeted information. This feature is particularly useful for businesses, educators, and developers who require bespoke solutions for their workflows.

Creating an assistant involves specifying a system prompt that guides the assistant's responses, setting parameters such as temperature to control the creativity of the output, and defining the length of the output tokens. Users can save and manage multiple assistants, switching between them as needed to address different tasks or scenarios. The Assistants are saved locally in their browser using the IndexedDB.

The flexibility of the Own Assistants feature empowers users to leverage the full potential of MUCGPT, making it a versatile tool for a wide range of applications.

MUCGPT also supports the creation of static, read-only Community Assistants that are available to all users. These assistants can be defined in the `.env` file, allowing administrators to set up predefined assistants that cater to common needs or provide standardized responses. This feature ensures that all users have access to consistent and reliable assistants without the ability to modify them, maintaining uniformity and control over the provided information. These Assistants can have predefined examples and quick prompts to show the user how to use this assistant.

By leveraging Community Assistants, organizations can ensure that their users have access to essential tools and information tailored to their specific requirements, enhancing the overall user experience and productivity.

## General Features

Generated text in various formats is displayed correctly. The formats currently supported are

- Markdown
- PLAIN HTML
- Mermaid diagrams embedded in Markdown code blocks
