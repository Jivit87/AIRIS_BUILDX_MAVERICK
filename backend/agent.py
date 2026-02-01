"""Chat agent with Ollama, memory, and web search."""
from typing import AsyncGenerator, List
from datetime import datetime
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from tools import search_web


def get_system_prompt() -> str:
    """Generate system prompt with current date."""
    today = datetime.now().strftime("%B %d, %Y")
    return f"""You are a helpful AI assistant. Today's date is {today}.
You have real-time web search. When search results are provided, you MUST:
1. Quote the EXACT information from the search results
2. Include the source URLs
3. Do NOT make up or modify information
4. If no relevant results, say so

Be accurate and cite sources with URLs."""


class ChatAgent:
    """Chat agent with memory and web search."""
    
    def __init__(self, model: str = "gemma3:1b"):
        self.llm = ChatOllama(model=model, temperature=0.3)  # Lower temp for accuracy
        self.messages: List = [SystemMessage(content=get_system_prompt())]
    
    def _needs_search(self, text: str) -> bool:
        """Check if query needs web search."""
        keywords = ['current', 'latest', 'news', 'weather', 'price', 
                   'stock', 'who is', 'what is', 'recent', '2024', '2025', '2026',
                   'search', 'find', 'look up', 'today']
        text_lower = text.lower()
        if 'date' in text_lower and 'today' in text_lower:
            return False
        return any(kw in text_lower for kw in keywords)
    
    async def chat(self, user_input: str) -> AsyncGenerator[str, None]:
        """Process user input with optional web search."""
        search_results = None
        
        if self._needs_search(user_input):
            yield "🔍 Searching the web...\n\n"
            search_results = search_web(user_input, max_results=5)
            
            # Show raw search results to user first
            if search_results and "error" not in search_results.lower():
                yield f"**Search Results:**\n{search_results}\n\n---\n\n**Summary:**\n"
        
        # Build message
        if search_results and "error" not in search_results.lower():
            message_content = f"""User asked: {user_input}

SEARCH RESULTS (use these exactly):
{search_results}

Summarize these results accurately. Include URLs."""
        else:
            message_content = user_input
        
        self.messages.append(HumanMessage(content=message_content))
        
        full_response = ""
        async for chunk in self.llm.astream(self.messages):
            if chunk.content:
                full_response += chunk.content
                yield chunk.content
        
        self.messages[-1] = HumanMessage(content=user_input)
        self.messages.append(AIMessage(content=full_response))
    
    def clear_history(self):
        self.messages = [SystemMessage(content=get_system_prompt())]
    
    def get_message_count(self) -> int:
        return len(self.messages) - 1
    
    def get_history(self) -> List[dict]:
        history = []
        for msg in self.messages[1:]:
            if isinstance(msg, HumanMessage):
                history.append({"role": "user", "content": msg.content})
            elif isinstance(msg, AIMessage):
                history.append({"role": "assistant", "content": msg.content})
        return history
