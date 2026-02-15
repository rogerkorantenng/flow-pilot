import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Send, X, Bot, User, Sparkles, Loader2, Zap, Play, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { sendChat, generateWorkflow, triggerRun } from '../services/api';

interface ChatAction {
  type: string;
  description?: string;
  workflow_id?: string;
  workflow_name?: string;
  name?: string;
  path?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  ai_generated?: boolean;
  action?: ChatAction;
  actionExecuted?: boolean;
}

export default function ChatSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        "Hi! I'm your FlowPilot AI copilot. I can **do things** for you:\n\n" +
        "- **\"Create a workflow that checks Amazon prices\"**\n" +
        "- **\"Run my Price Monitor\"**\n" +
        "- **\"Show my workflows\"**\n" +
        "- **\"Go to templates\"**\n\n" +
        "Or ask me anything about how FlowPilot works!",
      ai_generated: false,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [executingAction, setExecutingAction] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const executeAction = async (action: ChatAction, msgIndex: number) => {
    setExecutingAction(true);
    try {
      if (action.type === 'create_workflow' && action.description) {
        const result = await generateWorkflow(action.description);
        queryClient.invalidateQueries({ queryKey: ['workflows'] });
        toast.success(`Workflow created with ${result.steps_count} steps!`);

        setMessages((prev) =>
          prev.map((m, i) =>
            i === msgIndex ? { ...m, actionExecuted: true } : m
          )
        );
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Done! Created **${result.name}** with ${result.steps_count} steps${
              result.trigger_type === 'scheduled' ? ` (scheduled: ${result.schedule_cron})` : ''
            }. Taking you there now...`,
          },
        ]);
        navigate(`/workflows/${result.id}`);
      } else if (action.type === 'run_workflow' && action.workflow_id) {
        const result = await triggerRun(action.workflow_id);
        toast.success('Run started!');

        setMessages((prev) =>
          prev.map((m, i) =>
            i === msgIndex ? { ...m, actionExecuted: true } : m
          )
        );
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `**${action.workflow_name}** is now running! Taking you to the live viewer...`,
          },
        ]);
        navigate(`/runs/${result.run_id}`);
      } else if (action.type === 'navigate' && action.path) {
        setMessages((prev) =>
          prev.map((m, i) =>
            i === msgIndex ? { ...m, actionExecuted: true } : m
          )
        );
        navigate(action.path);
      } else if (action.type === 'list_workflows') {
        setMessages((prev) =>
          prev.map((m, i) =>
            i === msgIndex ? { ...m, actionExecuted: true } : m
          )
        );
        navigate('/workflows');
      }
    } catch {
      toast.error('Action failed. Please try again.');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "Sorry, that action failed. You can try it manually or ask me to try again.",
        },
      ]);
    } finally {
      setExecutingAction(false);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const context = `Page: ${window.location.pathname}`;
      const data = await sendChat(text, context);
      const action = (data as Record<string, unknown>).action as ChatAction | undefined;

      const newMsg: Message = {
        role: 'assistant',
        content: data.reply,
        ai_generated: data.ai_generated,
        action: action || undefined,
        actionExecuted: false,
      };
      setMessages((prev) => [...prev, newMsg]);

      // Auto-execute navigation actions (they're instant and non-destructive)
      if (action?.type === 'navigate' && action.path) {
        navigate(action.path);
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, actionExecuted: true } : m
          )
        );
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "Sorry, I couldn't process that. Please try again.",
          ai_generated: false,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl z-50 flex flex-col transition-transform duration-300 ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/40 rounded-lg flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-gray-900 dark:text-white">AI Copilot</h3>
            <p className="text-xs text-gray-500">Can create, run, and navigate</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i}>
            <div className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                }`}
              >
                <div
                  className="whitespace-pre-wrap break-words"
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
                />
                {msg.role === 'assistant' && msg.ai_generated && (
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-primary-500">
                    <Sparkles className="w-3 h-3" />
                    AI Generated
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </div>
              )}
            </div>

            {/* Action button */}
            {msg.role === 'assistant' && msg.action && !msg.actionExecuted && (
              <div className="ml-9 mt-2">
                <ActionButton
                  action={msg.action}
                  executing={executingAction}
                  onExecute={() => executeAction(msg.action!, i)}
                />
              </div>
            )}
            {msg.role === 'assistant' && msg.action && msg.actionExecuted && (
              <div className="ml-9 mt-1.5 flex items-center gap-1.5 text-xs text-green-600">
                <Sparkles className="w-3 h-3" />
                Done!
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-xl px-3.5 py-2.5">
              <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick prompts */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {[
            { label: 'Create a workflow', icon: <Zap className="w-3 h-3" /> },
            { label: 'Run a workflow', icon: <Play className="w-3 h-3" /> },
            { label: 'Show my workflows', icon: <ArrowRight className="w-3 h-3" /> },
            { label: 'Go to templates', icon: <ArrowRight className="w-3 h-3" /> },
          ].map((q) => (
            <button
              key={q.label}
              onClick={() => {
                setInput(q.label);
                inputRef.current?.focus();
              }}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              {q.icon} {q.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything or tell me to do something..."
            className="input text-sm flex-1"
            disabled={loading}
          />
          <button type="submit" disabled={!input.trim() || loading} className="btn-primary px-3">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Action Button Component ──────────────────────────────── */

function ActionButton({
  action,
  executing,
  onExecute,
}: {
  action: ChatAction;
  executing: boolean;
  onExecute: () => void;
}) {
  const config: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    create_workflow: {
      label: 'Create Workflow',
      icon: <Zap className="w-3.5 h-3.5" />,
      color: 'bg-purple-600 hover:bg-purple-700 text-white',
    },
    run_workflow: {
      label: `Run ${action.workflow_name || 'Workflow'}`,
      icon: <Play className="w-3.5 h-3.5" />,
      color: 'bg-green-600 hover:bg-green-700 text-white',
    },
    list_workflows: {
      label: 'View Workflows',
      icon: <ArrowRight className="w-3.5 h-3.5" />,
      color: 'bg-blue-600 hover:bg-blue-700 text-white',
    },
    navigate: {
      label: 'Go There',
      icon: <ArrowRight className="w-3.5 h-3.5" />,
      color: 'bg-blue-600 hover:bg-blue-700 text-white',
    },
  };

  const c = config[action.type];
  if (!c) return null;

  return (
    <button
      onClick={onExecute}
      disabled={executing}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm ${c.color}`}
    >
      {executing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : c.icon}
      {executing ? 'Working...' : c.label}
    </button>
  );
}

/* ── Markdown Formatter ───────────────────────────────────── */

function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-gray-200 dark:bg-gray-700 px-1 rounded text-xs">$1</code>')
    .replace(/\n/g, '<br/>');
}
