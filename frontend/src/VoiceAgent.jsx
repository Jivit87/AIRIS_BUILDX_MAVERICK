import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Mic, Phone, PhoneOff } from 'lucide-react'
import Vapi from '@vapi-ai/web'

const VAPI_PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY
const VAPI_ASSISTANT_ID = import.meta.env.VITE_VAPI_ASSISTANT_ID

export default function VoiceAgent({ isOpen, onClose }) {
  const [status, setStatus] = useState('idle') // idle, connecting, connected, speaking
  const [transcript, setTranscript] = useState('')
  const [assistantMessage, setAssistantMessage] = useState('')
  const [volumeLevel, setVolumeLevel] = useState(0)
  const [error, setError] = useState('')
  
  const vapiRef = useRef(null)
  const isActiveRef = useRef(false)

  // Initialize VAPI instance
  useEffect(() => {
    if (!VAPI_PUBLIC_KEY) {
      setError('VAPI Public Key not configured')
      return
    }

    const vapi = new Vapi(VAPI_PUBLIC_KEY)
    vapiRef.current = vapi

    // Event handlers
    vapi.on('call-start', () => {
      setStatus('connected')
      setError('')
    })

    vapi.on('call-end', () => {
      setStatus('idle')
      setTranscript('')
      setAssistantMessage('')
      setVolumeLevel(0)
    })

    vapi.on('speech-start', () => {
      setStatus('speaking')
    })

    vapi.on('speech-end', () => {
      if (isActiveRef.current) {
        setStatus('connected')
      }
    })

    vapi.on('volume-level', (level) => {
      setVolumeLevel(level)
    })

    vapi.on('message', (message) => {
      if (message.type === 'transcript') {
        if (message.role === 'user') {
          setTranscript(message.transcript)
        } else if (message.role === 'assistant') {
          setAssistantMessage(message.transcript)
        }
      }
    })

    vapi.on('error', (e) => {
      console.error('VAPI Error:', e)
      setError(e?.message || 'An error occurred')
      setStatus('idle')
    })

    return () => {
      vapi.stop()
    }
  }, [])

  // Start call when modal opens
  useEffect(() => {
    if (isOpen && vapiRef.current && status === 'idle') {
      startCall()
    }
    
    if (!isOpen && vapiRef.current) {
      stopCall()
    }
  }, [isOpen])

  const startCall = useCallback(async () => {
    if (!vapiRef.current) return
    
    if (!VAPI_ASSISTANT_ID) {
      setError('VAPI Assistant ID not configured. Create an assistant at dashboard.vapi.ai')
      return
    }

    try {
      isActiveRef.current = true
      setStatus('connecting')
      setError('')
      setTranscript('')
      setAssistantMessage('')
      
      await vapiRef.current.start(VAPI_ASSISTANT_ID)
    } catch (e) {
      console.error('Failed to start call:', e)
      setError(e?.message || 'Failed to start call')
      setStatus('idle')
      isActiveRef.current = false
    }
  }, [])

  const stopCall = useCallback(() => {
    if (!vapiRef.current) return
    
    isActiveRef.current = false
    vapiRef.current.stop()
    setStatus('idle')
  }, [])

  const handleClose = () => {
    stopCall()
    onClose()
  }

  if (!isOpen) return null

  // Visual styles based on status
  const statusConfig = {
    idle: { bg: 'from-gray-500 to-gray-600', glow: 'bg-gray-500/20', text: 'text-gray-400', label: 'Ready' },
    connecting: { bg: 'from-yellow-500 to-orange-500', glow: 'bg-yellow-500/30', text: 'text-yellow-400', label: 'Connecting...' },
    connected: { bg: 'from-blue-500 to-cyan-400', glow: 'bg-blue-500/40', text: 'text-blue-400', label: 'Listening...' },
    speaking: { bg: 'from-emerald-400 to-green-500', glow: 'bg-emerald-500/40', text: 'text-emerald-400', label: 'Speaking...' }
  }
  
  const config = statusConfig[status] || statusConfig.idle

  // Create waveform bars based on volume
  const waveformBars = Array.from({ length: 7 }, (_, i) => {
    const baseHeight = 0.3 + Math.sin(i * 0.8) * 0.2
    const volumeEffect = status === 'connected' || status === 'speaking' ? volumeLevel * 0.7 : 0
    return baseHeight + volumeEffect + Math.random() * 0.1
  })

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0f] flex items-center justify-center overflow-hidden">
      {/* Ambient glow */}
      <div className={`absolute w-[500px] h-[500px] rounded-full ${config.glow} blur-[100px] transition-all duration-700`} />
      
      {/* Close button */}
      <button 
        onClick={handleClose} 
        className="absolute top-6 right-6 p-3 rounded-full bg-white/5 hover:bg-white/10 z-20 transition-colors"
      >
        <X size={24} className="text-white/60" />
      </button>
      
      <div className="relative flex flex-col items-center z-10">
        {/* Main visual orb */}
        <div className="relative mb-10">
          <div className={`absolute -inset-8 rounded-full bg-gradient-to-r ${config.bg} opacity-20 blur-2xl`} />
          <div className={`relative w-48 h-48 rounded-full bg-gradient-to-br ${config.bg} shadow-2xl flex items-center justify-center transition-all duration-300`}>
            {status === 'connecting' ? (
              <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <div className="flex items-center gap-1.5 h-24">
                {waveformBars.map((h, i) => (
                  <div 
                    key={i} 
                    className="w-2.5 bg-white/90 rounded-full transition-all duration-75" 
                    style={{ height: `${h * 100}%` }} 
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Status text */}
        <p className={`text-2xl font-light ${config.text} mb-4`}>
          {config.label}
        </p>

        {/* Error message */}
        {error && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
        
        {/* Transcripts */}
        <div className="w-full max-w-lg px-4 min-h-[120px] space-y-3">
          {/* User transcript */}
          {transcript && (
            <div className="text-center p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
              <p className="text-xs text-blue-400 mb-1">You</p>
              <p className="text-lg text-white/90">{transcript}</p>
            </div>
          )}
          
          {/* Assistant response */}
          {assistantMessage && (
            <div className="text-center p-4 rounded-2xl bg-white/5 border border-white/10 max-h-40 overflow-y-auto">
              <p className="text-xs text-emerald-400 mb-1">Assistant</p>
              <p className="text-base text-white/80">{assistantMessage}</p>
            </div>
          )}
        </div>

        {/* Call controls */}
        <div className="mt-8 flex gap-4">
          {status === 'idle' ? (
            <button
              onClick={startCall}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-green-600 hover:bg-green-700 transition-colors"
            >
              <Phone size={20} />
              <span className="font-medium">Start Call</span>
            </button>
          ) : (
            <button
              onClick={stopCall}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-red-600 hover:bg-red-700 transition-colors"
            >
              <PhoneOff size={20} />
              <span className="font-medium">End Call</span>
            </button>
          )}
        </div>
        
        {/* Footer */}
        <p className="absolute bottom-8 text-white/30 text-sm flex items-center gap-2">
          <Mic size={14} /> Powered by VAPI
        </p>
      </div>
    </div>
  )
}
