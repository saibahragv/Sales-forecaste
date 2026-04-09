import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChatBubbleLeftRightIcon, XMarkIcon, PaperAirplaneIcon } from '@heroicons/react/24/solid'
import { useFiltersStore } from '../store/filters'

type MessageRole = 'user' | 'assistant' | 'system'
interface ToolCall { tool: string; args: Record<string, unknown> }
interface Message {
  id: string; role: MessageRole; content: string;
  toolCalls?: ToolCall[]; isStreaming?: boolean; timestamp: Date;
  model?: string; // 🧠 Active neural brain indicator
}

const QUICK_PROMPTS = [
  'Critical risks?',
  'Briefing on Store 1',
  '30% promo effect?',
]

const TOOL_LABELS: Record<string, string> = {
  get_forecast: '📈 Forecast',
  get_risk: '🛡️ Risk',
  get_overview: '📊 Pulse',
  get_scenario: '🧪 Sim',
  get_inventory: '📦 Stock',
  get_top_risks: '🚨 Audit',
}

export function AIAssistantBubble() {
  const [isOpen, setIsOpen] = useState(false)
  const { store, item } = useFiltersStore()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome', role: 'assistant',
      content: `👋 Hello! I'm **ARIA**. I'm here to simulate scenarios, detect risks, and forecast into the future past 2026! What do you need?`,
      timestamp: new Date(),
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  // ⏲️ Cooldown Timer Logic
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [cooldown])

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen])

  const sendMessage = useCallback(async (forcedText?: string) => {
    const text = (typeof forcedText === 'string' ? forcedText : input).trim()
    if (!text || isLoading) return

    const userMsg: Message = { id: `user-${Date.now()}`, role: 'user', content: text, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput(''); setIsLoading(true)

    const history = [...messages.slice(1), userMsg]
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }))

    const assistantId = `aria-${Date.now()}`
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', toolCalls: [], isStreaming: true, timestamp: new Date() }
    setMessages(prev => [...prev, assistantMsg])

    try {
      const response = await fetch('http://localhost:8000/agent/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, store: store ?? undefined, item: item ?? undefined }),
      })

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'model_info') {
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, model: event.model } : m))
            } else if (event.type === 'tool_call') {
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, toolCalls: [...(m.toolCalls || []), { tool: event.tool, args: event.args }] } : m))
            } else if (event.type === 'thought') {
              setMessages(prev => prev.map(m => {
                if (m.id !== assistantId) return m;
                // Append logic to the 'thinking' block
                const current = m.content.replace("🤔 _Thinking..._", "");
                // Display reasoning in a subtle way (or just keep the placeholder)
                return { ...m, content: current + "🤔 _Thinking..._" };
              }))
            } else if (event.type === 'delta') {
              setMessages(prev => prev.map(m => {
                if (m.id !== assistantId) return m;
                if (!event.content) return m; // Ignore empty deltas
                let newContent = m.content.replace("🤔 _Thinking..._", "") + event.content;
                // Soft-catch for LLaMA 3 tool-calling system hallucination leaks
                newContent = newContent.replace("No function call is necessary for this prompt.", "");
                newContent = newContent.replace("No function call is needed for this prompt.", "");
                if (newContent.trim() === "None") newContent = "";
                return { ...m, content: newContent };
              }))
            } else if (event.type === 'rate_limit') {
              setCooldown(60);
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: "⚠️ NVIDIA API Rate Limit reached. Please wait for the 60s cooldown.", isStreaming: false } : m))
            } else if (event.type === 'safety_block' || event.type === 'error') {
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: event.content, isStreaming: false } : m))
            } else if (event.type === 'done') {
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, isStreaming: false } : m))
            }
          } catch { /* skip */ }
        }
      }
    } catch (err: any) {
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: `❌ Connect error: ${err.message}`, isStreaming: false } : m))
    } finally {
      setIsLoading(false)
    }
  }, [messages, store, item, isLoading, input])

  useEffect(() => {
    const handleOpenAria = (e: any) => {
      setIsOpen(true);
      if (e.detail?.prompt) {
        setTimeout(() => sendMessage(e.detail.prompt), 100);
      }
    };
    window.addEventListener('open-aria', handleOpenAria);
    return () => window.removeEventListener('open-aria', handleOpenAria);
  }, [sendMessage]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="bg-slate-900/90 backdrop-blur-xl border border-slate-700 shadow-2xl rounded-2xl w-[400px] h-[550px] flex flex-col mb-4 overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-700 flex justify-between items-center bg-slate-800/80">
              <div className="flex flex-col">
                <span className="font-bold text-sm text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]">ARIA Intelligence</span>
                <span className="text-[10px] text-slate-400">v2.0.1 • Neural Matrix Edition</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] text-xs leading-relaxed ${msg.role === 'user' ? 'bg-blue-600 text-white px-3 py-2 rounded-xl rounded-tr-sm shadow-sm' : ''}`}>
                    {msg.role !== 'user' && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[9px] font-bold text-white shadow shadow-blue-500/50">A</div>
                        <span className="text-[10px] font-medium text-slate-400">ARIA</span>
                        {msg.isStreaming && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse ml-1"/>}
                      </div>
                    )}
                    
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {msg.toolCalls.map((tc, i) => (
                           <div key={i} className="text-[9px] bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-400 flex items-center gap-1 shadow-inner">
                             <span className="w-1 h-1 bg-blue-400 rounded-full animate-ping"/> {TOOL_LABELS[tc.tool] || tc.tool}
                           </div>
                        ))}
                      </div>
                    )}

                    <div className={msg.role === 'user' ? '' : 'bg-slate-800 border border-slate-700 px-3 py-2 rounded-xl rounded-tl-sm text-slate-200 shadow-inner'}>
                      {msg.role === 'assistant' && msg.model && (
                        <div className="flex items-center gap-1.5 mb-1.5 border-b border-slate-700/50 pb-1.5">
                          {msg.model.includes('deepseek') ? (
                            <>
                              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                              <span className="text-[9px] font-mono tracking-widest uppercase text-cyan-400/80">Neural Brain: DeepSeek V3</span>
                            </>
                          ) : (
                            <>
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                              <span className="text-[9px] font-mono tracking-widest uppercase text-emerald-400/80">Logic Node: LLaMA 70B</span>
                            </>
                          )}
                        </div>
                      )}
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Quick Prompts */}
            <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto scrollbar-hide">
              {QUICK_PROMPTS.map(p => (
                <button key={p} onClick={() => sendMessage(p)} disabled={isLoading || cooldown > 0} className="whitespace-nowrap text-[10px] px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors">
                  {p}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-700 bg-slate-800/80">
            {cooldown > 0 ? (
              <div className="flex items-center justify-center space-x-2 text-orange-400 text-xs py-2 bg-orange-900/20 rounded-lg border border-orange-500/30">
                <span className="animate-pulse">⏳ Rate limit cooldown active:</span>
                <span className="font-mono font-bold text-sm bg-orange-500 text-black px-2 rounded">{cooldown}s</span>
              </div>
            ) : (
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Ask ARIA anything..."
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  disabled={isLoading}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={isLoading || !input.trim()}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white p-2 rounded-lg transition-colors shadow-lg shadow-blue-900/20"
                >
                  <PaperAirplaneIcon className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.5)] relative hover:bg-blue-500 hover:shadow-[0_0_40px_rgba(59,130,246,0.6)] transition-all"
      >
        {isOpen ? <XMarkIcon className="w-6 h-6" /> : <ChatBubbleLeftRightIcon className="w-6 h-6" />}
        {!isOpen && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-slate-900 flex items-center justify-center shadow-lg">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          </span>
        )}
      </motion.button>
    </div>
  )
}
