"""Chat agent with Ollama, memory, web search, and PDF RAG."""
from typing import AsyncGenerator, List
from datetime import datetime
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from tools import search_web
from rag import SimpleRAG


def get_system_prompt(has_pdf: bool = False) -> str:
    """Generate system prompt with current date."""
    today = datetime.now().strftime("%B %d, %Y")
    pdf_instruction = ""
    if has_pdf:
        pdf_instruction = "\nYou have a PDF loaded. When answering questions, use the PDF context provided."
    
    return f"""You are a helpful AI assistant. Today's date is {today}.
You have real-time web search.{pdf_instruction}
When search results or PDF context is provided, use them accurately and cite sources.
Be concise and helpful."""


class ChatAgent:
    """Chat agent with memory, web search, and PDF RAG."""
    
    def __init__(self, model: str = "gemma3:1b"):
        self.llm = ChatOllama(model=model, temperature=0.3)
        self.messages: List = [SystemMessage(content=get_system_prompt())]
        self.rag = SimpleRAG()
    
    def _needs_search(self, text: str) -> bool:
        """Check if query needs web search."""
        # Don't search if we have a PDF loaded and query seems about the PDF
        if self.rag.is_loaded():
            pdf_keywords = ['pdf', 'document', 'file', 'page', 'section', 'chapter']
            if any(kw in text.lower() for kw in pdf_keywords):
                return False
        
        keywords = ['current', 'latest', 'news', 'weather', 'price', 
                   'stock', 'who is', 'recent', '2024', '2025', '2026',
                   'search', 'find online', 'look up']
        text_lower = text.lower()
        if 'date' in text_lower and 'today' in text_lower:
            return False
        return any(kw in text_lower for kw in keywords)
    
    def load_pdf(self, pdf_bytes: bytes, filename: str) -> str:
        """Load a PDF for RAG queries."""
        result = self.rag.load_pdf_bytes(pdf_bytes, filename)
        # Update system prompt
        self.messages[0] = SystemMessage(content=get_system_prompt(has_pdf=True))
        return result
    
    async def chat(self, user_input: str) -> AsyncGenerator[str, None]:
        """Process user input with search/RAG."""
        search_results = None
        pdf_context = None
        
        # Check if we should use PDF context
        if self.rag.is_loaded():
            pdf_context = self.rag.query(user_input, top_k=2)
            yield f"📄 Searching PDF: {self.rag.pdf_name}...\n\n"
        elif self._needs_search(user_input):
            yield "🔍 Searching the web...\n\n"
            search_results = search_web(user_input, max_results=3)
            if search_results and "error" not in search_results.lower():
                yield f"**Search Results:**\n{search_results}\n\n---\n\n**Summary:**\n"
        
        # Build message
        if pdf_context:
            message_content = f"""User question: {user_input}

PDF CONTEXT from {self.rag.pdf_name}:
{pdf_context}

Answer based on the PDF context above. Cite page numbers."""
        elif search_results and "error" not in search_results.lower():
            message_content = f"""User asked: {user_input}

SEARCH RESULTS:
{search_results}

Summarize accurately with URLs."""
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
        self.messages = [SystemMessage(content=get_system_prompt(self.rag.is_loaded()))]
    
    def clear_pdf(self):
        self.rag.clear()
        self.messages[0] = SystemMessage(content=get_system_prompt(has_pdf=False))
    
    def get_pdf_info(self) -> str:
        return self.rag.get_info()
    
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
