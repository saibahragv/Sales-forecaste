import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { useFiltersStore } from '../store/filters'
import { usePageContext } from '../store/pageContext'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: string[]
  isStreaming?: boolean
}

const TOOL_LABELS: Record<string, string> = {
  get_forecast: '📈 Fetching forecast data...',
  get_risk: '🛡️ Analyzing risk...',
  get_overview: '📊 Loading overview...',
  get_scenario: '🧪 Running simulation...',
  get_inventory: '📦 Checking inventory...',
  get_top_risks: '🔍 Scanning all store-item pairs...',
  get_forecast_accuracy: '🎯 Computing accuracy...',
  get_shap: '🧠 Calculating SHAP drivers...',
}

const PAGE_NAMES: Record<string, string> = {
  '/overview': 'Executive Overview',
  '/forecast': 'Forecast Explorer',
  '/scenario': 'Scenario Matrix Lab',
  '/risk': 'Risk & Stability',
  '/inventory': 'Inventory Intelligence',
  '/feature-intelligence': 'Feature Intelligence',
  '/hierarchy': 'Business Topology',
  '/seasonal-trend': 'Seasonal & Trend Lab',
  '/governance': 'Governance',
  '/data-engineering': 'Data Engineering',
  '/assistant': 'ARIA Agent',
}

const SUGGESTIONS = [
  'What will sales be tomorrow?',
  'Which items need reordering?',
  'Explain this forecast',
  'Any anomalies right now?',
  'What\'s driving these numbers?',
]

export function ARIACopilot() {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [unread, setUnread] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const location = useLocation()
  const { store, item, horizonDays, anchorDate } = useFiltersStore()
  const { currentPage, pageData } = usePageContext()

  const pageName = PAGE_NAMES[location.pathname] || 'Dashboard'

  // Auto-greet when first opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const contextNote = store && item
        ? `I can see you're on **${pageName}** with Store ${store}, Item ${item} selected${pageData.forecastTotal ? ` — forecast total: **${pageData.forecastTotal}**` : ''}.`
        : `I can see you're on **${pageName}**. Select a Store & Item in the sidebar filter for me to access live data.`
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `Hey! I'm **ARIA** 👋\n\n${contextNote}\n\nWhat would you like to know?`,
      }])
    }
  }, [isOpen, messages.length, store, item, pageName, pageData])

  // When page or data changes while chat is open, notify user
  useEffect(() => {
    if (!isOpen || messages.length === 0) return
    // Silently update context — ARIA will use it on next message
  }, [location.pathname, store, item])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const buildContextMessage = useCallback(() => {
    const parts: string[] = []
    parts.push(`User is currently on the "${pageName}" page.`)
    if (store !== undefined) parts.push(`Selected: Store ${store}${item !== undefined ? `, Item ${item}` : ''}.`)
    if (anchorDate) parts.push(`Anchor date: ${anchorDate}.`)
    parts.push(`Forecast horizon: ${horizonDays} days.`)
    if (pageData.forecastTotal) parts.push(`Current forecast total visible on screen: ${pageData.forecastTotal} units.`)
    if (pageData.riskBand) parts.push(`Current risk band shown: ${pageData.riskBand}.`)
    if (pageData.volatility) parts.push(`Volatility index: ${pageData.volatility}.`)
    if (pageData.mape) parts.push(`Model MAPE: ${pageData.mape}%.`)
    if (pageData.topAlerts) parts.push(`Top alert on screen: ${pageData.topAlerts}.`)
    return parts.join(' ')
  }, [pageName, store, item, horizonDays, anchorDate, pageData])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return
    setInput('')
    setIsLoading(true)

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text.trim() }
    setMessages(prev => [...prev, userMsg])

    const assistantId = `a-${Date.now()}`
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', toolCalls: [], isStreaming: true }])

    // Build full message history with injected context
    const contextNote = buildContextMessage()
    const history = [
      { role: 'user', content: `[CONTEXT]: ${contextNote}` },
      { role: 'assistant', content: 'Got it. I have full context of what you are viewing.' },
      ...messages.filter(m => m.role === 'user' || (m.role === 'assistant' && !m.isStreaming))
              .slice(-10)
              .map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: text.trim() },
    ]

    try {
      const response = await fetch('http://localhost:8000/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, store: store ?? undefined, item: item ?? undefined }),
      })
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const ev = JSON.parse(line.slice(6))
            if (ev.type === 'tool_call') {
              setMessages(prev => prev.map(m => m.id === assistantId
                ? { ...m, toolCalls: [...(m.toolCalls || []), TOOL_LABELS[ev.tool] || `⚙️ ${ev.tool}...`] }
                : m))
            } else if (ev.type === 'delta') {
              setMessages(prev => prev.map(m => m.id === assistantId
                ? { ...m, content: m.content + ev.content } : m))
            } else if (ev.type === 'safety_block' || ev.type === 'error') {
              setMessages(prev => prev.map(m => m.id === assistantId
                ? { ...m, content: ev.content, isStreaming: false } : m))
            } else if (ev.type === 'done') {
              setMessages(prev => prev.map(m => m.id === assistantId
                ? { ...m, isStreaming: false } : m))
              if (!isOpen) setUnread(u => u + 1)
            }
          } catch { /* skip bad SSE */ }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed'
      setMessages(prev => prev.map(m => m.id === assistantId
        ? { ...m, content: `❌ ${msg}. Make sure backend is running on :8000`, isStreaming: false } : m))
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, messages, store, item, buildContextMessage, isOpen])

  const handleOpen = () => {
    setIsOpen(true)
    setUnread(0)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  return (
    <div className="copilot-widget" style={{ zIndex: 9999 }}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{
              width: 380,
              height: 520,
              background: 'rgba(8, 12, 24, 0.97)',
              border: '1px solid rgba(96, 165, 250, 0.2)',
              borderRadius: 16,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 80px rgba(0,0,0,0.6), 0 0 40px rgba(96,165,250,0.08)',
              marginBottom: 12,
            }}
          >
            {/* Header */}
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(96,165,250,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 'bold', color: '#fff',
                  boxShadow: '0 0 16px rgba(96,165,250,0.4)',
                }}>A</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>ARIA</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{pageName} · {store && item ? `S${store} I${item}` : 'No selection'}</div>
                </div>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
              </div>
              <button onClick={() => setIsOpen(false)} style={{ color: 'rgba(255,255,255,0.4)', fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.map(msg => (
                <div key={msg.id}>
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
                      {msg.toolCalls.map((tc, i) => (
                        <span key={i} style={{
                          fontSize: 10, color: 'rgba(96,165,250,0.8)',
                          background: 'rgba(96,165,250,0.06)',
                          border: '1px solid rgba(96,165,250,0.15)',
                          borderRadius: 20, padding: '2px 10px', width: 'fit-content',
                          display: 'flex', alignItems: 'center', gap: 5,
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#3b82f6', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                          {tc}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}>
                    <div style={{
                      maxWidth: '85%',
                      padding: '8px 12px',
                      borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      background: msg.role === 'user'
                        ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
                        : 'rgba(255,255,255,0.05)',
                      border: msg.role === 'assistant' ? '1px solid rgba(255,255,255,0.07)' : 'none',
                      fontSize: 12.5,
                      lineHeight: 1.6,
                      color: '#e2e8f0',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}>
                      {msg.content || (msg.isStreaming && (
                        <span style={{ display: 'flex', gap: 4 }}>
                          {[0,1,2].map(i => (
                            <span key={i} style={{
                              width: 5, height: 5, borderRadius: '50%',
                              background: '#94a3b8',
                              animation: `bounce 1s infinite ${i * 0.15}s`,
                              display: 'inline-block',
                            }} />
                          ))}
                        </span>
                      ))}
                      {msg.isStreaming && msg.content && (
                        <span style={{ display: 'inline-block', width: 2, height: 12, background: '#3b82f6', marginLeft: 2, animation: 'pulse 1s infinite', verticalAlign: 'middle' }} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Suggestions */}
            {messages.length <= 1 && (
              <div style={{ padding: '4px 12px 8px', display: 'flex', gap: 6, overflowX: 'auto', flexShrink: 0 }}>
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => sendMessage(s)} style={{
                    whiteSpace: 'nowrap', fontSize: 10.5,
                    padding: '4px 10px', borderRadius: 20,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                    flexShrink: 0, transition: 'all 0.2s',
                  }}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div style={{
              borderTop: '1px solid rgba(255,255,255,0.06)',
              padding: '10px 12px',
              display: 'flex', gap: 8, alignItems: 'flex-end',
              background: 'rgba(0,0,0,0.2)',
            }}>
              <textarea
                ref={inputRef}
                rows={2}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendMessage(input) }}
                placeholder="Ask about any data you see..."
                disabled={isLoading}
                style={{
                  flex: 1, background: 'transparent',
                  border: 'none', outline: 'none',
                  color: '#e2e8f0', fontSize: 12.5,
                  resize: 'none', lineHeight: 1.5,
                  fontFamily: 'inherit',
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={isLoading || !input.trim()}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: input.trim() ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : 'rgba(255,255,255,0.06)',
                  border: 'none', cursor: input.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 16, transition: 'all 0.2s', flexShrink: 0,
                  boxShadow: input.trim() ? '0 0 12px rgba(96,165,250,0.4)' : 'none',
                }}
              >
                {isLoading ? '◌' : '↑'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button */}
      <motion.button
        onClick={isOpen ? () => setIsOpen(false) : handleOpen}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, color: '#fff', alignSelf: 'flex-end',
          boxShadow: '0 0 0 1px rgba(96,165,250,0.3), 0 8px 32px rgba(96,165,250,0.35)',
        }}
      >
        {isOpen ? '×' : 'A'}
        {!isOpen && unread > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            width: 18, height: 18, borderRadius: '50%',
            background: '#ef4444', fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', border: '2px solid #080c18',
          }}>{unread > 9 ? '9+' : unread}</span>
        )}
      </motion.button>
    </div>
  )
}
