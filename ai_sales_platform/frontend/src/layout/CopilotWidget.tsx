import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function CopilotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user'|'copilot', text: string}[]>([{role: 'copilot', text: 'Hi! I can help you filter data or explain anomalies. Try "Show me store 2".'}]);
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages(prev => [...prev, {role: 'user', text: input}]);
    
    // Simulate AI response stream
    setTimeout(() => {
        setMessages(prev => [...prev, {role: 'copilot', text: 'Applying global filter for your request...'}]);
    }, 600);
    setInput('');
  };

  return (
    <div className="copilot-widget">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 glass-panel flex flex-col flex-grow overflow-hidden"
          >
            <div className="p-3 border-b border-gray-700 bg-gray-800 font-semibold text-accent-hover flex justify-between">
              <span>AI Copilot</span>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col justify-end min-h-[300px]">
              {messages.map((m, i) => (
                <div key={i} className={`p-2 rounded-lg text-sm max-w-[85%] ${m.role === 'user' ? 'bg-accent-glow self-end' : 'bg-gray-800 self-start border border-gray-700'}`}>
                    {m.text}
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="p-3 border-t border-gray-700 bg-gray-900 flex">
               <input 
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask ai..."
                className="flex-1 bg-transparent border-none outline-none text-sm placeholder-gray-500"
               />
               <button type="submit" className="text-accent-hover font-bold ml-2">↑</button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
      
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="btn-magnetic bg-accent-base text-white self-end shadow-lg rounded-full w-14 h-14 flex items-center justify-center text-2xl"
      >
        ✨
      </button>
    </div>
  );
}
