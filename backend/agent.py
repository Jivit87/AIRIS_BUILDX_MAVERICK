"""Chat agent with Ollama and conversation memory."""
from typing import AsyncGenerator, List
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

SYSTEM_PROMPT = """You are a helpful, friendly AI personal assistant. You help users with:
- Answering questions on any topic
- Brainstorming ideas
- Writing and editing text
- Explaining concepts
- General conversation

Be concise but thorough. If you don't know something, say so honestly."""


class ChatAgent:
    """Chat agent with conversation memory using Ollama."""
    
    def __init__(self, model: str = "qwen2.5:1.5b"):
        self.llm = ChatOllama(model=model, temperature=0.7)
        self.messages: List = [SystemMessage(content=SYSTEM_PROMPT)]
    
    async def chat(self, user_input: str) -> AsyncGenerator[str, None]:
        """Process user input and stream the response."""
        self.messages.append(HumanMessage(content=user_input))
        
        full_response = ""
        async for chunk in self.llm.astream(self.messages):
            if chunk.content:
                full_response += chunk.content
                yield chunk.content
        
        self.messages.append(AIMessage(content=full_response))
    
    def clear_history(self):
        """Clear conversation history."""
        self.messages = [SystemMessage(content=SYSTEM_PROMPT)]
