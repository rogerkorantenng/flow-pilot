import { useState } from 'react';
import { Zap, ArrowRight, Loader2 } from 'lucide-react';
import { enterUser } from '../services/api';

interface NameModalProps {
  onSubmit: (name: string, userId: string) => void;
}

export default function NameModal({ onSubmit }: NameModalProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || loading) return;

    setLoading(true);
    setError('');
    try {
      const res = await enterUser(name.trim());
      onSubmit(res.name, res.id);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl animate-in">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-600/20">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Welcome to FlowPilot</h1>
          <p className="text-gray-500 mt-1 text-sm">
            AI-powered workflow automation
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            What's your name?
          </label>
          <input
            type="text"
            className="input mb-2"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            disabled={loading}
          />
          {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
          <button
            type="submit"
            className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            disabled={!name.trim() || loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                Get Started
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
