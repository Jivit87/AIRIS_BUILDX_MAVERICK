import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Mic, Phone, PhoneOff, Sparkles } from 'lucide-react'
import Vapi from '@vapi-ai/web'

const VAPI_PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY
const VAPI_ASSISTANT_ID = import.meta.env.VITE_VAPI_ASSISTANT_ID

export default function VoiceAgent({ isOpen, onClose }) {
  const [status, setStatus] = useState('idle')
  const [transcript, setTranscript] = useState('')
  const [assistantMessage, setAssistantMessage] = useState('')
  const [volumeLevel, setVolumeLevel] = useState(0)
  const [error, setError] = useState('')
  const [callDuration, setCallDuration] = useState(0)
  
  const vapiRef = useRef(null)
  const isActiveRef = useRef(false)
  const timerRef = useRef(null)

  // Initialize VAPI instance
  useEffect(() => {
    if (!VAPI_PUBLIC_KEY) {
      setError('VAPI Public Key not configured')
      return
    }

    const vapi = new Vapi(VAPI_PUBLIC_KEY)
    vapiRef.current = vapi

    vapi.on('call-start', () => {
      setStatus('connected')
      setError('')
      // Start duration timer
      timerRef.current = setInterval(() => {
        setCallDuration(d => d + 1)
      }, 1000)
    })

    vapi.on('call-end', () => {
      setStatus('idle')
      setTranscript('')
      setAssistantMessage('')
      setVolumeLevel(0)
      setCallDuration(0)
      if (timerRef.current) clearInterval(timerRef.current)
    })

    vapi.on('speech-start', () => setStatus('speaking'))
    vapi.on('speech-end', () => {
      if (isActiveRef.current) setStatus('connected')
    })

    vapi.on('volume-level', (level) => setVolumeLevel(level))

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
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

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
      setError('VAPI Assistant ID not configured. Create one at dashboard.vapi.ai')
      return
    }

    try {
      isActiveRef.current = true
      setStatus('connecting')
      setError('')
      setTranscript('')
      setAssistantMessage('')
      setCallDuration(0)
      
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
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  const handleClose = () => {
    stopCall()
    onClose()
  }

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (!isOpen) return null

  // Premium color themes
  const themes = {
    idle: {
      primary: 'from-slate-600 via-slate-500 to-slate-600',
      glow: 'rgba(100, 116, 139, 0.3)',
      accent: 'text-slate-400',
      ring: 'border-slate-500/30'
    },
    connecting: {
      primary: 'from-amber-500 via-orange-500 to-amber-500',
      glow: 'rgba(245, 158, 11, 0.4)',
      accent: 'text-amber-400',
      ring: 'border-amber-500/40'
    },
    connected: {
      primary: 'from-violet-500 via-purple-500 to-violet-500',
      glow: 'rgba(139, 92, 246, 0.4)',
      accent: 'text-violet-400',
      ring: 'border-violet-500/40'
    },
    speaking: {
      primary: 'from-emerald-400 via-teal-500 to-emerald-400',
      glow: 'rgba(16, 185, 129, 0.5)',
      accent: 'text-emerald-400',
      ring: 'border-emerald-500/50'
    }
  }

  const theme = themes[status] || themes.idle
  const isActive = status === 'connected' || status === 'speaking'

  // Generate smooth waveform bars
  const bars = Array.from({ length: 12 }, (_, i) => {
    const base = 0.15 + Math.sin(i * 0.5) * 0.1
    const vol = isActive ? volumeLevel * 0.6 : 0
    const rand = isActive ? Math.random() * 0.15 : 0
    return Math.min(1, base + vol + rand)
  })

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Background with gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0c0c14] via-[#0a0a12] to-[#0e0e18]" />
      
      {/* Animated ambient glow */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] transition-all duration-1000"
        style={{ backgroundColor: theme.glow }}
      />
      
      {/* Subtle grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }}
      />

      {/* Close button */}
      <button 
        onClick={handleClose} 
        className="absolute top-6 right-6 p-3 rounded-full bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/10 z-20 transition-all hover:scale-105"
      >
        <X size={22} className="text-white/70" />
      </button>

      {/* Main content */}
      <div className="relative h-full flex flex-col items-center justify-center z-10 px-6">
        
        {/* Central orb with rings */}
        <div className="relative mb-12">
          {/* Outer pulsing rings */}
          {isActive && (
            <>
              <div className={`absolute -inset-12 rounded-full border ${theme.ring} animate-ping opacity-20`} style={{ animationDuration: '2s' }} />
              <div className={`absolute -inset-8 rounded-full border ${theme.ring} animate-ping opacity-30`} style={{ animationDuration: '1.5s' }} />
              <div className={`absolute -inset-4 rounded-full border ${theme.ring} animate-pulse opacity-40`} />
            </>
          )}
          
          {/* Glow layer */}
          <div className={`absolute -inset-6 rounded-full bg-gradient-to-r ${theme.primary} opacity-30 blur-2xl`} />
          
          {/* Main orb */}
          <div 
            className={`relative w-52 h-52 rounded-full bg-gradient-to-br ${theme.primary} shadow-2xl flex items-center justify-center transition-all duration-500`}
            style={{ boxShadow: `0 0 60px ${theme.glow}` }}
          >
            {status === 'connecting' ? (
              <div className="relative">
                <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/60" size={20} />
              </div>
            ) : (
              /* Audio visualizer */
              <div className="flex items-end justify-center gap-1 h-28 px-4">
                {bars.map((h, i) => (
                  <div 
                    key={i}
                    className="w-2 bg-white/90 rounded-full transition-all"
                    style={{ 
                      height: `${h * 100}%`,
                      transitionDuration: isActive ? '50ms' : '300ms'
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Status badge */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10`}>
            <div className={`w-2 h-2 rounded-full ${
              status === 'idle' ? 'bg-slate-400' :
              status === 'connecting' ? 'bg-amber-400 animate-pulse' :
              status === 'connected' ? 'bg-violet-400 animate-pulse' :
              'bg-emerald-400 animate-pulse'
            }`} />
            <span className={`text-sm font-medium ${theme.accent}`}>
              {status === 'idle' ? 'Ready to connect' :
               status === 'connecting' ? 'Connecting...' :
               status === 'connected' ? 'Listening' :
               'Nova is speaking'}
            </span>
          </div>
          
          {/* Call duration */}
          {isActive && (
            <span className="text-white/40 text-xs font-mono tracking-wider">
              {formatTime(callDuration)}
            </span>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 px-5 py-3 rounded-xl bg-red-500/10 border border-red-500/20 backdrop-blur-sm max-w-md">
            <p className="text-sm text-red-400 text-center">{error}</p>
          </div>
        )}

        {/* Transcript cards */}
        <div className="w-full max-w-xl space-y-4 min-h-[140px]">
          {/* User message */}
          {transcript && (
            <div className="relative p-5 rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/20 backdrop-blur-sm">
              <div className="absolute -top-2 left-4 px-2 py-0.5 rounded bg-violet-500/20 border border-violet-500/30">
                <span className="text-[10px] font-semibold text-violet-300 uppercase tracking-wider">You</span>
              </div>
              <p className="text-lg text-white/90 leading-relaxed pt-1">{transcript}</p>
            </div>
          )}
          
          {/* Nova response */}
          {assistantMessage && (
            <div className="relative p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 backdrop-blur-sm max-h-44 overflow-y-auto">
              <div className="absolute -top-2 left-4 px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30">
                <span className="text-[10px] font-semibold text-emerald-300 uppercase tracking-wider">Nova</span>
              </div>
              <p className="text-base text-white/80 leading-relaxed pt-1">{assistantMessage}</p>
            </div>
          )}
        </div>

        {/* Call controls */}
        <div className="mt-10">
          {status === 'idle' ? (
            <button
              onClick={startCall}
              className="group relative flex items-center gap-3 px-8 py-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 transition-all hover:scale-105 shadow-lg shadow-emerald-500/25"
            >
              <Phone size={22} className="text-white" />
              <span className="font-semibold text-white text-lg">Start Conversation</span>
            </button>
          ) : (
            <button
              onClick={stopCall}
              className="group relative flex items-center gap-3 px-8 py-4 rounded-full bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-400 hover:to-rose-400 transition-all hover:scale-105 shadow-lg shadow-red-500/25"
            >
              <PhoneOff size={22} className="text-white" />
              <span className="font-semibold text-white text-lg">End Conversation</span>
            </button>
          )}
        </div>

        {/* Footer branding */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 text-white/20 text-xs">
          <Mic size={12} />
          <span>Powered by VAPI • Nova AI</span>
        </div>
      </div>
    </div>
  )
}
