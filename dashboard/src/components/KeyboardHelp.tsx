import { Keyboard } from 'lucide-react';
import { SHORTCUTS } from '../hooks/useKeyboardShortcuts';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function KeyboardHelp({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <Keyboard className="w-5 h-5 text-primary-600" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Keyboard Shortcuts</h2>
        </div>
        <div className="space-y-2">
          {SHORTCUTS.map((s) => (
            <div key={s.desc} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-gray-600 dark:text-gray-400">{s.desc}</span>
              <div className="flex gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-mono text-gray-700 dark:text-gray-300"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full btn-secondary text-sm"
        >
          Close
        </button>
      </div>
    </div>
  );
}
