import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);

  const handler = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger in inputs/textareas
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowHelp((p) => !p);
        return;
      }

      if (e.key === 'Escape') {
        setShowHelp(false);
        return;
      }

      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key === 'n') {
        e.preventDefault();
        navigate('/workflows/new');
      } else if (mod && e.key === 'k') {
        e.preventDefault();
        navigate('/workflows');
      } else if (e.key === 'g' && !mod) {
        // g then d = go dashboard (simple: just 'g' goes home)
        navigate('/');
      }
    },
    [navigate]
  );

  useEffect(() => {
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handler]);

  return { showHelp, setShowHelp };
}

export const SHORTCUTS = [
  { keys: ['Ctrl', 'N'], desc: 'New workflow' },
  { keys: ['Ctrl', 'K'], desc: 'Go to workflows' },
  { keys: ['G'], desc: 'Go to dashboard' },
  { keys: ['?'], desc: 'Toggle this help' },
  { keys: ['Esc'], desc: 'Close dialogs' },
];
