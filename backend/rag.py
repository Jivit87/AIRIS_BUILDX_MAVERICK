"""Simple RAG module for PDF processing."""
import os
from typing import List, Optional
from pypdf import PdfReader


class SimpleRAG:
    """Simple RAG using text chunks and keyword search (no embeddings needed)."""
    
    def __init__(self):
        self.documents: List[dict] = []
        self.pdf_name: Optional[str] = None
    
    def load_pdf(self, file_path: str) -> str:
        """Load and extract text from PDF.
        
        Args:
            file_path: Path to PDF file
            
        Returns:
            Status message
        """
        try:
            reader = PdfReader(file_path)
            self.pdf_name = os.path.basename(file_path)
            self.documents = []
            
            full_text = []
            for i, page in enumerate(reader.pages):
                text = page.extract_text()
                if text:
                    # Store as chunks by page
                    self.documents.append({
                        "page": i + 1,
                        "content": text.strip()
                    })
                    full_text.append(text)
            
            total_chars = sum(len(d["content"]) for d in self.documents)
            return f"Loaded {len(self.documents)} pages ({total_chars} characters) from {self.pdf_name}"
            
        except Exception as e:
            return f"Error loading PDF: {str(e)}"
    
    def load_pdf_bytes(self, pdf_bytes: bytes, filename: str) -> str:
        """Load PDF from bytes."""
        import io
        try:
            reader = PdfReader(io.BytesIO(pdf_bytes))
            self.pdf_name = filename
            self.documents = []
            
            for i, page in enumerate(reader.pages):
                text = page.extract_text()
                if text:
                    self.documents.append({
                        "page": i + 1,
                        "content": text.strip()
                    })
            
            total_chars = sum(len(d["content"]) for d in self.documents)
            return f"✅ Loaded {len(self.documents)} pages from {filename}"
            
        except Exception as e:
            return f"Error loading PDF: {str(e)}"
    
    def query(self, question: str, top_k: int = 3) -> str:
        """Query the PDF using simple keyword matching.
        
        Args:
            question: User's question
            top_k: Number of relevant chunks to return
            
        Returns:
            Relevant context from the PDF
        """
        if not self.documents:
            return "No PDF loaded. Please upload a PDF first."
        
        # Simple keyword matching (works well for small PDFs)
        keywords = question.lower().split()
        scored_docs = []
        
        for doc in self.documents:
            content_lower = doc["content"].lower()
            score = sum(1 for kw in keywords if kw in content_lower)
            if score > 0:
                scored_docs.append((score, doc))
        
        # Sort by score and get top results
        scored_docs.sort(key=lambda x: x[0], reverse=True)
        top_docs = scored_docs[:top_k]
        
        if not top_docs:
            # Return first few pages as context if no keyword match
            top_docs = [(0, doc) for doc in self.documents[:top_k]]
        
        # Format results
        results = []
        for score, doc in top_docs:
            results.append(f"[Page {doc['page']}]\n{doc['content'][:1000]}...")
        
        return f"\n\n---\n\n".join(results)
    
    def is_loaded(self) -> bool:
        """Check if a PDF is loaded."""
        return len(self.documents) > 0
    
    def get_info(self) -> str:
        """Get info about loaded PDF."""
        if not self.documents:
            return "No PDF loaded"
        return f"PDF: {self.pdf_name} ({len(self.documents)} pages)"
    
    def clear(self):
        """Clear loaded PDF."""
        self.documents = []
        self.pdf_name = None
