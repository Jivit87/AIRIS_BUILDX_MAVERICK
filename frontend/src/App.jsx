import { useState, useRef, useEffect } from 'react'
import { Send, Plus, MessageSquare, Settings, Menu, X, Sparkles } from 'lucide-react'
import './index.css'

function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId] = useState(() => crypto.randomUUID())
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const wsRef = useRef(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // WebSocket connection
  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/ws/${sessionId}`)
    
    ws.onopen = () => console.log('Connected to server')
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      if (data.type === 'stream') {
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last && last.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: last.content + data.content }]
          }
          return prev
        })
      } else if (data.type === 'complete') {
        setIsLoading(false)
      } else if (data.type === 'error') {
        setIsLoading(false)
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last && last.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: 'Error: ' + data.content }]
          }
          return prev
        })
      }
    }
    
    ws.onclose = () => console.log('Disconnected')
    ws.onerror = () => console.log('WebSocket error')
    wsRef.current = ws
    
    return () => ws.close()
  }, [sessionId])

  const sendMessage = () => {
    if (!input.trim() || !wsRef.current || isLoading) return
    
    const userMsg = { id: crypto.randomUUID(), role: 'user', content: input.trim() }
    const assistantMsg = { id: crypto.randomUUID(), role: 'assistant', content: '' }
    
    setMessages(prev => [...prev, userMsg, assistantMsg])
    setIsLoading(true)
    wsRef.current.send(JSON.stringify({ content: input.trim() }))
    setInput('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const newChat = () => {
    setMessages([])
  }

  return (
    <div className="flex h-screen bg-[#212121] text-white">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} bg-[#171717] flex flex-col transition-all duration-300 overflow-hidden`}>
        <div className="p-3 flex-shrink-0">
          <button
            onClick={newChat}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-white/20 hover:bg-white/10 transition-colors"
          >
            <Plus size={18} />
            <span className="text-sm">New chat</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3">
          <p className="text-xs text-gray-500 px-2 py-2">Today</p>
          {messages.length > 0 && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#2a2a2a] text-sm truncate">
              <MessageSquare size={16} className="text-gray-400 flex-shrink-0" />
              <span className="truncate">{messages[0]?.content.slice(0, 28)}...</span>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 cursor-pointer">
            <Settings size={18} className="text-gray-400" />
            <span className="text-sm">Settings</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col relative">
        {/* Header */}
        <header className="h-12 flex items-center px-4 border-b border-white/10">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)} 
            className="p-2 hover:bg-white/10 rounded-lg"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="ml-4 flex items-center gap-2">
            <Sparkles size={18} className="text-green-500" />
            <span className="text-sm font-medium">AI Assistant</span>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center mb-6">
                <Sparkles size={32} className="text-white" />
              </div>
              <h1 className="text-2xl font-semibold mb-2">How can I help you today?</h1>
              <p className="text-gray-400 mb-8">Ask me anything or choose a suggestion</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl w-full">
                {[
                  'Explain quantum computing simply',
                  'Write a creative short story',
                  'Help me with a coding problem',
                  'Brainstorm startup ideas'
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="p-4 text-left rounded-xl border border-white/10 hover:bg-white/5 transition-colors text-sm"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-4 mb-6 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-medium ${
                    msg.role === 'user' 
                      ? 'bg-blue-600' 
                      : 'bg-gradient-to-br from-green-400 to-blue-500'
                  }`}>
                    {msg.role === 'user' ? 'U' : '✦'}
                  </div>
                  <div className={`flex-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                    <div className={`inline-block px-4 py-3 rounded-2xl max-w-[85%] text-left ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 rounded-br-md' 
                        : 'bg-[#2a2a2a] rounded-bl-md'
                    }`}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.content || (isLoading && msg.role === 'assistant' ? (
                          <span className="text-gray-400">Thinking...</span>
                        ) : null)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/10">
          <div className="max-w-3xl mx-auto">
            <div className="relative bg-[#2f2f2f] rounded-2xl border border-white/10 focus-within:border-white/20">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message AI Assistant..."
                rows={1}
                disabled={isLoading}
                className="w-full bg-transparent px-4 py-4 pr-12 text-sm resize-none outline-none max-h-48 placeholder-gray-500"
                style={{ minHeight: '56px' }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="absolute right-3 bottom-3 p-2 bg-white text-black rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="text-center text-xs text-gray-500 mt-3">
              AI can make mistakes. Please verify important information.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
