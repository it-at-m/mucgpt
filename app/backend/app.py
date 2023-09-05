import os
import time
import logging

import openai
from flask import Flask, request, jsonify, send_file, abort
from azure.identity import DefaultAzureCredential
from azure.search.documents import SearchClient
from approaches.summarize import Summarize
from approaches.simplechat import SimpleChatApproach
from approaches.brainstorm import Brainstorm
from azure.storage.blob import BlobServiceClient

# Replace these with your own values, either in environment variables or directly here
AZURE_STORAGE_ACCOUNT = os.environ.get("AZURE_STORAGE_ACCOUNT") or "mystorageaccount"
AZURE_STORAGE_CONTAINER = os.environ.get("AZURE_STORAGE_CONTAINER") or "content"
AZURE_SEARCH_SERVICE = os.environ.get("AZURE_SEARCH_SERVICE") or "gptkb"
AZURE_SEARCH_INDEX = os.environ.get("AZURE_SEARCH_INDEX") or "gptkbindex"
AZURE_OPENAI_SERVICE = os.environ.get("AZURE_OPENAI_SERVICE") or "myopenai"
AZURE_OPENAI_GPT_DEPLOYMENT = os.environ.get("AZURE_OPENAI_GPT_DEPLOYMENT") or "davinci"
AZURE_OPENAI_CHATGPT_DEPLOYMENT = os.environ.get("AZURE_OPENAI_CHATGPT_DEPLOYMENT") or "chat"
AZURE_OPENAI_CHATGPT_MODEL = os.environ.get("AZURE_OPENAI_CHATGPT_MODEL") or "gpt-35-turbo"

KB_FIELDS_CONTENT = os.environ.get("KB_FIELDS_CONTENT") or "content"
KB_FIELDS_CATEGORY = os.environ.get("KB_FIELDS_CATEGORY") or "category"
KB_FIELDS_SOURCEPAGE = os.environ.get("KB_FIELDS_SOURCEPAGE") or "sourcepage"

# Use the current user identity to authenticate with Azure OpenAI, Cognitive Search and Blob Storage (no secrets needed, 
# just use 'az login' locally, and managed identity when deployed on Azure). If you need to use keys, use separate AzureKeyCredential instances with the 
# keys for each service
# If you encounter a blocking error during a DefaultAzureCredntial resolution, you can exclude the problematic credential by using a parameter (ex. exclude_shared_token_cache_credential=True)
azure_credential = DefaultAzureCredential()

# Used by the OpenAI SDK
openai.api_type = "azure"
openai.api_base = f"https://{AZURE_OPENAI_SERVICE}.openai.azure.com"
openai.api_version = "2023-05-15"

# Comment these two lines out if using keys, set your API key in the OPENAI_API_KEY environment variable instead
openai.api_type = "azure_ad"
openai_token = azure_credential.get_token("https://cognitiveservices.azure.com/.default")
openai.api_key = openai_token.token

# Set up clients for Cognitive Search and Storage
search_client = SearchClient(
    endpoint=f"https://{AZURE_SEARCH_SERVICE}.search.windows.net",
    index_name=AZURE_SEARCH_INDEX,
    credential=azure_credential)
blob_client = BlobServiceClient(
    account_url=f"https://{AZURE_STORAGE_ACCOUNT}.blob.core.windows.net", 
    credential=azure_credential)
blob_container = blob_client.get_container_client(AZURE_STORAGE_CONTAINER)

# Various approaches to integrate GPT and external knowledge, most applications will use a single one of these patterns
# or some derivative, here we include several for exploration purposes
ask_approaches = {
}

chat_approaches = {
     "chat": SimpleChatApproach(AZURE_OPENAI_CHATGPT_DEPLOYMENT, AZURE_OPENAI_CHATGPT_MODEL)
}

summarize_approaches = {
    "sum": Summarize(AZURE_OPENAI_CHATGPT_DEPLOYMENT, AZURE_OPENAI_CHATGPT_MODEL)
}

brainstorm_approaches = {
    "brainstorm": Brainstorm(AZURE_OPENAI_CHATGPT_DEPLOYMENT, AZURE_OPENAI_CHATGPT_MODEL)
}

app = Flask(__name__)

@app.route("/", defaults={"path": "index.html"})
@app.route("/<path:path>")
def static_file(path):
    return app.send_static_file(path)

    
@app.route("/chat", methods=["POST"])
def chat():
    ensure_openai_token()
    if not request.json:
        return jsonify({"error": "request must be json"}), 400
    approach = request.json["approach"]
    try:
        impl = chat_approaches.get(approach)
        if not impl:
            return jsonify({"error": "unknown approach"}), 400
        r = impl.run(request.json["history"], request.json.get("overrides") or {})
        return jsonify(r)
    except Exception as e:
        logging.exception("Exception in /chat")
        return jsonify({"error": str(e)}), 500

@app.route("/sum", methods=["POST"])
def sum():
    ensure_openai_token()
    if not request.json:
        return jsonify({"error": "request must be json"}), 400
    approach = request.json["approach"]
    try:
        impl = summarize_approaches.get(approach)
        if not impl:
            return jsonify({"error": "unknown approach"}), 400
        r = impl.run(request.json["text"], request.json.get("overrides") or {})
        return jsonify(r)
    except Exception as e:
        logging.exception("Exception in /sum")
        return jsonify({"error": str(e)}), 500

@app.route("/brainstorm", methods=["POST"])
def brainstorm():
    ensure_openai_token()
    if not request.json:
        return jsonify({"error": "request must be json"}), 400
    approach = request.json["approach"]
    try:
        impl = brainstorm_approaches.get(approach)
        if not impl:
            return jsonify({"error": "unknown approach"}), 400
        r = impl.run(
            request.json["topic"],
            request.json.get("overrides") or {}
            )
        return jsonify(r)
    except Exception as e:
        logging.exception("Exception in /brainstorm")
        return jsonify({"error": str(e)}), 500

def ensure_openai_token():
    global openai_token
    if openai_token.expires_on < int(time.time()) - 60:
        openai_token = azure_credential.get_token("https://cognitiveservices.azure.com/.default")
        openai.api_key = openai_token.token
    
if __name__ == "__main__":
    app.run()
