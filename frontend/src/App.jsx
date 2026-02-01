import { useState, useRef, useEffect } from 'react'
import { Send, Plus, MessageSquare, Trash2, Menu, X, Sparkles, Brain, FileText, Upload, Mic } from 'lucide-react'
import VoiceAgent from './VoiceAgent'
import './index.css'

function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId] = useState(() => crypto.randomUUID())
  const [sidebarOpen, setSidebarOpen] = useState(false) // Default closed on mobile
  const [memoryCount, setMemoryCount] = useState(0)
  const [pdfInfo, setPdfInfo] = useState(null)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const wsRef = useRef(null)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  // Auto-open sidebar on desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(true)
      } else {
        setSidebarOpen(false)
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
        if (data.message_count !== undefined) setMemoryCount(data.message_count)
        if (data.pdf_info) setPdfInfo(data.pdf_info !== 'No PDF loaded' ? data.pdf_info : null)
      } else if (data.type === 'cleared') {
        setMessages([])
        setMemoryCount(0)
      } else if (data.type === 'pdf_loaded') {
        setPdfInfo(data.pdf_info)
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'system',
          content: `📄 ${data.message}`
        }])
      } else if (data.type === 'pdf_cleared') {
        setPdfInfo(null)
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
    
    // Close sidebar on mobile after sending
    if (window.innerWidth < 768) {
      setSidebarOpen(false)
    }
  }

  const clearMemory = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'clear' }))
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file || !file.name.endsWith('.pdf')) {
      alert('Please select a PDF file')
      return
    }
    
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'upload_pdf',
          data: base64,
          filename: file.name
        }))
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const clearPdf = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'clear_pdf' }))
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex h-screen h-[100dvh] bg-[#212121] text-white overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:relative inset-y-0 left-0 z-30
        w-64 md:w-64 bg-[#171717] flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden'}
      `}>
        <div className="p-3 flex-shrink-0">
          <button
            onClick={clearMemory}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-white/20 hover:bg-white/10 transition-colors"
          >
            <Plus size={18} />
            <span className="text-sm">New chat</span>
          </button>
        </div>

        {/* PDF Upload */}
        <div className="px-3 py-2">
          <input
            type="file"
            accept=".pdf"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors text-sm"
          >
            <Upload size={16} />
            <span>Upload PDF</span>
          </button>
        </div>

        {/* PDF Info */}
        {pdfInfo && (
          <div className="px-3 py-2">
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-green-900/30 border border-green-600/30">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={16} className="text-green-400 flex-shrink-0" />
                <span className="text-xs text-green-300 truncate">{pdfInfo}</span>
              </div>
              <button onClick={clearPdf} className="text-red-400 hover:text-red-300 flex-shrink-0 ml-2">
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Memory Indicator */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2a2a2a]">
            <Brain size={16} className="text-purple-400" />
            <span className="text-xs text-gray-400">Memory: {memoryCount} messages</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3">
          <p className="text-xs text-gray-500 px-2 py-2">Current Session</p>
          {messages.filter(m => m.role === 'user').slice(0, 1).map((msg) => (
            <div key={msg.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#2a2a2a] text-sm truncate">
              <MessageSquare size={16} className="text-gray-400 flex-shrink-0" />
              <span className="truncate">{msg.content.slice(0, 28)}...</span>
            </div>
          ))}
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
      <main className="flex-1 flex flex-col relative min-w-0">
        {/* Header */}
        <header className="h-12 sm:h-14 flex items-center justify-between px-2 sm:px-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)} 
              className="p-2 hover:bg-white/10 rounded-lg"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="ml-2 sm:ml-4 flex items-center gap-2">
              <Sparkles size={18} className="text-green-500" />
              <span className="text-sm font-medium">Nova</span>
            </div>
          </div>
          
          {/* Header badges - hide text on small screens */}
          <div className="flex items-center gap-1 sm:gap-2">
            {pdfInfo && (
              <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 rounded-full bg-green-500/20 text-green-300 text-xs">
                <FileText size={14} />
                <span className="hidden sm:inline">PDF loaded</span>
              </div>
            )}
            {memoryCount > 0 && (
              <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs">
                <Brain size={14} />
                <span className="hidden sm:inline">{memoryCount} in memory</span>
              </div>
            )}
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-4 py-8">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center mb-4 sm:mb-6">
                <Sparkles size={28} className="text-white sm:w-8 sm:h-8" />
              </div>
              <h1 className="text-xl sm:text-2xl font-semibold mb-2 text-center">How can I help you today?</h1>
              <p className="text-gray-400 text-sm sm:text-base mb-1 sm:mb-2 text-center">Upload a PDF or ask me anything</p>
              <p className="text-gray-500 text-xs sm:text-sm mb-6 sm:mb-8 text-center px-4">I can search the web and answer questions about your documents</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 max-w-2xl w-full px-2">
                {[
                  '📄 Upload a PDF and ask questions',
                  '🔍 Search the latest news',
                  '💡 Explain a complex topic',
                  '✍️ Help me write something'
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => suggestion.includes('Upload') ? fileInputRef.current?.click() : setInput(suggestion.slice(2))}
                    className="p-3 sm:p-4 text-left rounded-xl border border-white/10 hover:bg-white/5 transition-colors text-xs sm:text-sm"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2 sm:gap-4 mb-4 sm:mb-6 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs sm:text-sm font-medium ${
                    msg.role === 'user' 
                      ? 'bg-blue-600' 
                      : msg.role === 'system'
                      ? 'bg-green-600'
                      : 'bg-gradient-to-br from-green-400 to-blue-500'
                  }`}>
                    {msg.role === 'user' ? 'U' : msg.role === 'system' ? '📄' : '✦'}
                  </div>
                  <div className={`flex-1 min-w-0 ${msg.role === 'user' ? 'text-right' : ''}`}>
                    <div className={`inline-block px-3 sm:px-4 py-2 sm:py-3 rounded-2xl max-w-[90%] sm:max-w-[85%] text-left ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 rounded-br-md' 
                        : msg.role === 'system'
                        ? 'bg-green-900/30 border border-green-600/30 rounded-bl-md'
                        : 'bg-[#2a2a2a] rounded-bl-md'
                    }`}>
                      <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
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
        <div className="p-2 sm:p-4 border-t border-white/10 flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="relative bg-[#2f2f2f] rounded-xl sm:rounded-2xl border border-white/10 focus-within:border-white/20">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={pdfInfo ? "Ask about your PDF..." : "Message Nova..."}
                rows={1}
                disabled={isLoading}
                className="w-full bg-transparent px-3 sm:px-4 py-3 sm:py-4 pr-20 sm:pr-24 text-sm resize-none outline-none max-h-32 sm:max-h-48 placeholder-gray-500"
                style={{ minHeight: '48px' }}
              />
              <div className="absolute right-2 sm:right-3 bottom-2 sm:bottom-3 flex gap-1.5 sm:gap-2">
                <button
                  onClick={() => setVoiceOpen(true)}
                  className="p-2 sm:p-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  title="Voice Assistant"
                >
                  <Mic size={16} className="sm:w-4 sm:h-4" />
                </button>
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  className="p-2 sm:p-2.5 bg-white text-black rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
                >
                  <Send size={16} className="sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>
            <p className="text-center text-[10px] sm:text-xs text-gray-500 mt-2 sm:mt-3">
              {pdfInfo ? '📄 PDF loaded • Ask questions about your document' : 'Upload a PDF or search the web'}
            </p>
          </div>
        </div>
      </main>
      
      {/* Voice Agent Modal */}
      <VoiceAgent isOpen={voiceOpen} onClose={() => setVoiceOpen(false)} />
    </div>
  )
}

export default App
