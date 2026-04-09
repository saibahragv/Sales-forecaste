import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const internalRoutes = [
    { name: 'Executive Overview', path: '/overview' },
    { name: 'Forecast Explorer', path: '/forecast' },
    { name: 'Scenario Simulation', path: '/scenario' },
    { name: 'Explainability & SHAP', path: '/explainability' },
    { name: 'Risk & Stability', path: '/risk' },
    { name: 'Governance', path: '/governance' }
  ];

  const filteredRoutes = internalRoutes.filter(r => r.name.toLowerCase().includes(query.toLowerCase()));

  const handleSelect = (path: string) => {
    navigate(path);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div className={`cmd-k-overlay ${isOpen ? 'active' : ''}`} onClick={() => setIsOpen(false)}>
      <div className="cmd-k-modal" onClick={(e) => e.stopPropagation()}>
        <input 
          type="text" 
          className="w-full bg-transparent border-none p-6 text-xl focus:outline-none placeholder-gray-500 glow-text" 
          placeholder="Search commands or routes... (ESC to close)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus={isOpen}
        />
        <div className="border-t border-gray-700 max-h-64 overflow-y-auto p-2">
          {filteredRoutes.map((route, idx) => (
            <div 
              key={idx}
              className="p-4 hover:bg-gray-800 cursor-pointer transition-colors flex justify-between items-center interactive-hover rounded-md"
              onClick={() => handleSelect(route.path)}
            >
              <span className="font-semibold text-gray-200">{route.name}</span>
              <span className="text-gray-500 text-sm">{route.path}</span>
            </div>
          ))}
          {filteredRoutes.length === 0 && (
            <div className="p-4 text-gray-500">No results found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
