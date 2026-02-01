import { useState, useRef, useEffect } from 'react'
import { Send, Plus, MessageSquare, Trash2, Menu, X, Sparkles, Brain } from 'lucide-react'
import './index.css'

function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId] = useState(() => crypto.randomUUID())
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [memoryCount, setMemoryCount] = useState(0)
  const wsRef = useRef(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
        if (data.message_count !== undefined) {
          setMemoryCount(data.message_count)
        }
      } else if (data.type === 'cleared') {
        setMessages([])
        setMemoryCount(0)
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
    wsRef.current.send(JSON.stringify({ type: 'chat', content: input.trim() }))
    setInput('')
  }

  const clearMemory = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'clear' }))
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex h-screen bg-[#212121] text-white">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} bg-[#171717] flex flex-col transition-all duration-300 overflow-hidden`}>
        <div className="p-3 flex-shrink-0">
          <button
            onClick={clearMemory}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-white/20 hover:bg-white/10 transition-colors"
          >
            <Plus size={18} />
            <span className="text-sm">New chat</span>
          </button>
        </div>

        {/* Memory Indicator */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2a2a2a]">
            <Brain size={16} className="text-purple-400" />
            <span className="text-xs text-gray-400">Memory: {memoryCount} messages</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3">
          <p className="text-xs text-gray-500 px-2 py-2">Current Session</p>
          {messages.length > 0 && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#2a2a2a] text-sm truncate">
              <MessageSquare size={16} className="text-gray-400 flex-shrink-0" />
              <span className="truncate">{messages[0]?.content.slice(0, 28)}...</span>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-white/10 flex-shrink-0">
          <button
            onClick={clearMemory}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
          >
            <Trash2 size={18} />
            <span className="text-sm">Clear memory</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col relative">
        {/* Header */}
        <header className="h-12 flex items-center justify-between px-4 border-b border-white/10">
          <div className="flex items-center">
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
          </div>
          
          {/* Memory Badge */}
          {memoryCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs">
              <Brain size={14} />
              <span>{memoryCount} in memory</span>
            </div>
          )}
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center mb-6">
                <Sparkles size={32} className="text-white" />
              </div>
              <h1 className="text-2xl font-semibold mb-2">How can I help you today?</h1>
              <p className="text-gray-400 mb-2">I remember our conversation as we chat</p>
              <p className="text-gray-500 text-sm mb-8">Ask me anything - I'll remember context from earlier messages</p>
              
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
              AI remembers this conversation • Clear memory to start fresh
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
