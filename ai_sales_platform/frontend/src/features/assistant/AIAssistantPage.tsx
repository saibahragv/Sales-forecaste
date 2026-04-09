import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useFiltersStore } from '../../store/filters'

type MessageRole = 'user' | 'assistant' | 'system'

interface ToolCall {
  tool: string
  args: Record<string, unknown>
}

interface Message {
  id: string
  role: MessageRole
  content: string
  toolCalls?: ToolCall[]
  isStreaming?: boolean
  timestamp: Date
}

const QUICK_PROMPTS = [
  'Which items are at critical stock-out risk?',
  'Give me a full briefing on store 1',
  'What if I run a 30% promotion on item 5?',
  'Why is the forecast trending down for this item?',
  'Compare risk levels across all stores',
  'How accurate is our model for item 1?',
]

const TOOL_LABELS: Record<string, string> = {
  get_forecast: '📈 Loading forecast data...',
  get_risk: '🛡️ Analyzing risk metrics...',
  get_overview: '📊 Fetching executive overview...',
  get_scenario: '🧪 Running scenario simulation...',
  get_inventory: '📦 Checking inventory signals...',
  get_top_risks: '🔍 Scanning all store-item pairs...',
  get_forecast_accuracy: '🎯 Computing model accuracy...',
  get_shap: '🧠 Calculating SHAP drivers...',
}

function ToolBadge({ tool }: { tool: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-2 text-xs text-fg-muted bg-bg-surface border border-border-light rounded-full px-3 py-1 w-fit"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-accent-base animate-pulse" />
      {TOOL_LABELS[tool] || `⚙️ Using ${tool}...`}
    </motion.div>
  )
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}>
        {!isUser && (
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-full bg-accent-base flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-accent-glow">A</div>
            <span className="text-xs text-fg-muted font-medium">ARIA</span>
            <span className="text-xs text-fg-muted opacity-50">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )}
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="flex flex-col gap-1 mb-2">
            {msg.toolCalls.map((tc, i) => (
              <ToolBadge key={i} tool={tc.tool} />
            ))}
          </div>
        )}
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-accent-base text-white rounded-tr-sm shadow-lg shadow-accent-glow/30'
            : 'bg-bg-surface border border-border-light text-fg-primary rounded-tl-sm'
        }`}>
          {msg.content || (msg.isStreaming && (
            <span className="flex gap-1 items-center h-4">
              <span className="w-1.5 h-1.5 bg-fg-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-fg-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-fg-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          ))}
          {msg.isStreaming && msg.content && (
            <span className="inline-block w-0.5 h-4 bg-accent-base ml-0.5 animate-pulse" />
          )}
        </div>
        {isUser && (
          <div className="text-xs text-fg-muted text-right mt-1 pr-1">
            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    </motion.div>
  )
}

export function AIAssistantPage() {
  const { store, item, horizonDays, anchorDate } = useFiltersStore()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `👋 Hello! I'm **ARIA** — your Advanced Retail Intelligence Agent.\n\nI have full access to your LightGBM sales model, all 50 stores × 50 items, and real-time analytics. I can help you with:\n\n• **Forecasting** — What will sales look like next month?\n• **Risk & Inventory** — Which items are at stock-out risk?\n• **Scenario Planning** — What if you run a promotion?\n• **Explainability** — Why did the model predict that?\n\nWhat would you like to know?`,
      timestamp: new Date(),
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    // Build conversation history (exclude welcome msg)
    const history = [...messages.slice(1), userMsg]
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }))

    const assistantId = `aria-${Date.now()}`
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      toolCalls: [],
      isStreaming: true,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, assistantMsg])

    try {
      const response = await fetch('http://localhost:8000/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          store: store ?? undefined,
          item: item ?? undefined,
        }),
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

            if (event.type === 'tool_call') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? { ...m, toolCalls: [...(m.toolCalls || []), { tool: event.tool, args: event.args }] }
                  : m
              ))
            } else if (event.type === 'delta') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? { ...m, content: m.content + event.content }
                  : m
              ))
            } else if (event.type === 'safety_block' || event.type === 'error') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? { ...m, content: event.content, isStreaming: false }
                  : m
              ))
            } else if (event.type === 'done') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, isStreaming: false } : m
              ))
            }
          } catch { /* skip malformed events */ }
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Connection failed'
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: `❌ ${errorMsg}. Make sure the backend is running.`, isStreaming: false }
          : m
      ))
    } finally {
      setIsLoading(false)
    }
  }, [messages, store, item, isLoading])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      sendMessage(input)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] space-y-4">

      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-bold glow-text">ARIA — Retail Intelligence Agent</h2>
          <p className="text-xs text-fg-muted mt-0.5">
            Powered by LLaMA 3.1 70B · Safety: llama-guard-4-12b ·{' '}
            {store && item ? `Context: Store ${store}, Item ${item}` : 'Global context'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-risk-low animate-pulse" />
          <span className="text-xs text-fg-muted">Agent Online</span>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 glass-panel p-4 overflow-y-auto min-h-0">
        <AnimatePresence>
          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {QUICK_PROMPTS.map(prompt => (
          <button
            key={prompt}
            onClick={() => sendMessage(prompt)}
            disabled={isLoading}
            className="whitespace-nowrap text-xs px-3 py-1.5 rounded-full bg-bg-surface border border-border-light text-fg-secondary hover:bg-bg-primary hover:text-white hover:border-accent-base transition-all duration-200 disabled:opacity-50 flex-shrink-0"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div className="glass-panel p-3">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            rows={2}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Ask ARIA anything about your sales data, forecasts, inventory, or scenarios..."
            className="flex-1 bg-transparent text-sm text-fg-primary placeholder-fg-muted resize-none outline-none leading-relaxed"
          />
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              className="btn-magnetic px-4 py-2 text-sm font-semibold bg-accent-base text-white border-0 hover:opacity-90 disabled:opacity-40 rounded-xl min-w-[80px]"
            >
              {isLoading ? (
                <span className="flex gap-1 justify-center">
                  <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              ) : 'Send'}
            </button>
            <span className="text-[10px] text-fg-muted">⌘+Enter</span>
          </div>
        </div>
      </div>
    </div>
  )
}

