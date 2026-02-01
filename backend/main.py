"""FastAPI backend with WebSocket for real-time chat."""
import os
import json
import uuid
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from agent import ChatAgent

load_dotenv()

app = FastAPI(title="AI Personal Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active chat sessions
sessions: dict[str, ChatAgent] = {}


@app.get("/")
async def root():
    return {"message": "AI Personal Assistant API is running!"}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    
    if session_id not in sessions:
        sessions[session_id] = ChatAgent()
    
    agent = sessions[session_id]
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            user_input = message.get("content", "")
            
            full_response = ""
            async for chunk in agent.chat(user_input):
                full_response += chunk
                await websocket.send_json({"type": "stream", "content": chunk})
            
            await websocket.send_json({"type": "complete", "content": full_response})
            
    except WebSocketDisconnect:
        print(f"Session {session_id} disconnected")
    except Exception as e:
        print(f"Error: {e}")
        await websocket.send_json({"type": "error", "content": str(e)})


@app.post("/api/new-session")
async def new_session():
    """Create a new chat session."""
    session_id = str(uuid.uuid4())
    sessions[session_id] = ChatAgent()
    return {"session_id": session_id}


@app.delete("/api/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a chat session."""
    if session_id in sessions:
        del sessions[session_id]
    return {"status": "deleted"}


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
