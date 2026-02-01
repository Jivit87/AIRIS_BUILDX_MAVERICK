"""Web search tool using SerpAPI."""
import os
from serpapi import GoogleSearch


def search_web(query: str, max_results: int = 5) -> str:
    """Search the web using SerpAPI (Google Search).
    
    Args:
        query: Search query
        max_results: Maximum results to return
    
    Returns:
        Formatted search results
    """
    api_key = os.getenv("SERPAPI_KEY")
    
    if not api_key:
        return "Error: SERPAPI_KEY not configured in .env file"
    
    try:
        params = {
            "q": query,
            "api_key": api_key,
            "num": max_results
        }
        
        search = GoogleSearch(params)
        results = search.get_dict()
        
        # Get organic results
        organic = results.get("organic_results", [])
        
        if not organic:
            return "No results found."
        
        formatted = []
        for i, r in enumerate(organic[:max_results], 1):
            title = r.get("title", "No title")
            snippet = r.get("snippet", "No description")
            link = r.get("link", "")
            formatted.append(f"{i}. {title}\n   {snippet}\n   URL: {link}")
        
        return "\n\n".join(formatted)
        
    except Exception as e:
        return f"Search error: {str(e)}"
