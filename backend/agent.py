"""Chat agent with Ollama and conversation memory."""
from typing import AsyncGenerator, List
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

SYSTEM_PROMPT = """You are a helpful AI assistant with memory. Be concise and helpful."""


class ChatAgent:
    """Chat agent with conversation memory using Ollama."""
    
    def __init__(self, model: str = "gemma3:1b"):
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
    
    def get_message_count(self) -> int:
        """Get number of messages in history."""
        return len(self.messages) - 1
    
    def get_history(self) -> List[dict]:
        """Get conversation history."""
        history = []
        for msg in self.messages[1:]:
            if isinstance(msg, HumanMessage):
                history.append({"role": "user", "content": msg.content})
            elif isinstance(msg, AIMessage):
                history.append({"role": "assistant", "content": msg.content})
        return history
