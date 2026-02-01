"""FastAPI backend with WebSocket for real-time chat."""
import os
import json
import uuid
import base64
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File
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

# Active chat sessions with memory
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
            msg_type = message.get("type", "chat")
            
            if msg_type == "clear":
                agent.clear_history()
                await websocket.send_json({
                    "type": "cleared",
                    "message_count": 0
                })
            
            elif msg_type == "clear_pdf":
                agent.clear_pdf()
                await websocket.send_json({
                    "type": "pdf_cleared",
                    "message": "PDF cleared"
                })
            
            elif msg_type == "upload_pdf":
                # Handle PDF upload via WebSocket
                pdf_data = message.get("data", "")
                filename = message.get("filename", "document.pdf")
                
                try:
                    pdf_bytes = base64.b64decode(pdf_data)
                    result = agent.load_pdf(pdf_bytes, filename)
                    await websocket.send_json({
                        "type": "pdf_loaded",
                        "message": result,
                        "pdf_info": agent.get_pdf_info()
                    })
                except Exception as e:
                    await websocket.send_json({
                        "type": "error",
                        "content": f"PDF upload error: {str(e)}"
                    })
            
            elif msg_type == "get_pdf_info":
                await websocket.send_json({
                    "type": "pdf_info",
                    "info": agent.get_pdf_info()
                })
            
            else:
                # Regular chat message
                user_input = message.get("content", "")
                full_response = ""
                
                async for chunk in agent.chat(user_input):
                    full_response += chunk
                    await websocket.send_json({"type": "stream", "content": chunk})
                
                await websocket.send_json({
                    "type": "complete",
                    "content": full_response,
                    "message_count": agent.get_message_count(),
                    "pdf_info": agent.get_pdf_info()
                })
            
    except WebSocketDisconnect:
        print(f"Session {session_id} disconnected")
    except Exception as e:
        print(f"Error: {e}")
        await websocket.send_json({"type": "error", "content": str(e)})


@app.post("/api/upload-pdf/{session_id}")
async def upload_pdf(session_id: str, file: UploadFile = File(...)):
    """Upload PDF for RAG queries."""
    if session_id not in sessions:
        sessions[session_id] = ChatAgent()
    
    agent = sessions[session_id]
    pdf_bytes = await file.read()
    result = agent.load_pdf(pdf_bytes, file.filename)
    
    return {
        "status": "success",
        "message": result,
        "pdf_info": agent.get_pdf_info()
    }


@app.post("/api/new-session")
async def new_session():
    session_id = str(uuid.uuid4())
    sessions[session_id] = ChatAgent()
    return {"session_id": session_id}


@app.delete("/api/session/{session_id}")
async def delete_session(session_id: str):
    if session_id in sessions:
        del sessions[session_id]
    return {"status": "deleted"}


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
