import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Send, X, Bot, User, Sparkles, Loader2, Zap, Play, ArrowRight,
  Trash2, Copy, Share2, BarChart3, Activity, XCircle, FileText, Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  sendChat, triggerRun, deleteWorkflow, getWorkflow,
  publishTemplate, useTemplate, generateInsights, getAIStatus, abortRun,
  getRunSummary, enterUser, createWorkflow, planWorkflow,
} from '../services/api';

/* ── Types ──────────────────────────────────────────────────── */

interface ChatAction {
  type: string;
  description?: string;
  workflow_id?: string;
  workflow_name?: string;
  template_id?: string;
  template_name?: string;
  run_id?: string;
  name?: string;
  path?: string;
  category?: string;
  message?: string;
}

interface WizardOption {
  label: string;
  value: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  ai_generated?: boolean;
  action?: ChatAction;
  actionExecuted?: boolean;
  options?: WizardOption[];
  optionsUsed?: boolean;
}

interface WizardData {
  name?: string;
  description?: string;
  trigger_type?: string;
  schedule_cron?: string;
}

interface CreateWizard {
  step: 'name' | 'description' | 'trigger' | 'schedule' | 'confirm';
  data: WizardData;
}

interface PendingAction {
  action: ChatAction;
  phase: 'input' | 'confirm';
  inputField?: string;
  collected: Record<string, string>;
}

/* ── Constants ──────────────────────────────────────────────── */

const TRIGGER_OPTIONS: WizardOption[] = [
  { label: 'Manual', value: 'manual' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Webhook', value: 'webhook' },
];

const SCHEDULE_PRESETS: WizardOption[] = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Daily at 9 AM', value: '0 9 * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Weekly (Monday)', value: '0 9 * * 1' },
];

const CATEGORY_OPTIONS: WizardOption[] = [
  { label: 'Finance', value: 'finance' },
  { label: 'Sales', value: 'sales' },
  { label: 'Marketing', value: 'marketing' },
  { label: 'Monitoring', value: 'monitoring' },
  { label: 'Research', value: 'research' },
  { label: 'General', value: 'general' },
];

const YES_NO_OPTIONS: WizardOption[] = [
  { label: 'Yes, proceed', value: 'yes' },
  { label: 'Cancel', value: 'cancel' },
];

/* ── Main Component ─────────────────────────────────────────── */

export default function ChatSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        "Hi! I'm your FlowPilot AI copilot. I can **do everything** for you:\n\n" +
        '- **"Create a workflow"** — guided step-by-step\n' +
        '- **"Run my Price Monitor"**\n' +
        '- **"Delete / Clone / Publish a workflow"**\n' +
        '- **"Analyze my data"**\n' +
        '- **"Go to templates"**\n\n' +
        'Just tell me what to do!',
      ai_generated: false,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [executingAction, setExecutingAction] = useState(false);
  const [wizard, setWizard] = useState<CreateWizard | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  /* ── Helpers ── */

  const addBot = (content: string, extra?: Partial<Message>) => {
    setMessages((prev) => [...prev, { role: 'assistant', content, ...extra }]);
  };

  const clearOpts = (msgs: Message[]) =>
    msgs.map((m) => (m.options && !m.optionsUsed ? { ...m, optionsUsed: true } : m));

  const isActive = wizard || pending;

  /* ─────────────────────────────────────────────────────────────
     CREATE WORKFLOW WIZARD (multi-step)
     ───────────────────────────────────────────────────────────── */

  const startWizard = (initialDescription?: string, initialName?: string) => {
    const data: WizardData = {};
    if (initialDescription && initialDescription.length >= 5) data.description = initialDescription;
    if (initialName && initialName.length >= 1) data.name = initialName;

    // Skip steps that are already filled
    if (data.name && data.description) {
      // Both provided — skip to trigger
      setWizard({ step: 'trigger', data });
      addBot(
        `Got it — **${data.name}**: *"${data.description}"*\n\n**How should this workflow be triggered?**`,
        { options: TRIGGER_OPTIONS }
      );
    } else if (data.name) {
      // Name provided, need description
      setWizard({ step: 'description', data });
      addBot(`**What should "${data.name}" do?**\n\nDescribe the automation, e.g. *"Check Amazon laptop prices and save the results"*`);
    } else if (data.description) {
      // Description provided, need name
      setWizard({ step: 'name', data });
      addBot(`Let's build it! First, **what would you like to name this workflow?**`);
    } else {
      // Nothing provided
      setWizard({ step: 'name', data });
      addBot(`Let's build a workflow step by step!\n\n**What would you like to name it?**`);
    }
  };

  const cancelActive = (display?: string) => {
    setWizard(null);
    setPending(null);
    setMessages((prev) => [
      ...clearOpts(prev),
      ...(display ? [{ role: 'user' as const, content: display }] : []),
      { role: 'assistant' as const, content: 'Cancelled! Let me know if you need anything else.' },
    ]);
  };

  const advanceWizard = (display: string, value: string) => {
    if (!wizard) return;
    const lower = value.toLowerCase().trim();

    if (['cancel', 'nevermind', 'stop', 'quit', 'exit'].includes(lower)) {
      cancelActive(display);
      return;
    }

    switch (wizard.step) {
      case 'name': {
        const newData = { ...wizard.data, name: value.trim() };
        if (newData.description) {
          setWizard({ step: 'trigger', data: newData });
          setMessages((prev) => [
            ...clearOpts(prev),
            { role: 'user', content: display },
            {
              role: 'assistant',
              content: `Great name — **${value.trim()}**!\n\n**How should this workflow be triggered?**`,
              options: TRIGGER_OPTIONS,
            },
          ]);
        } else {
          setWizard({ step: 'description', data: newData });
          setMessages((prev) => [
            ...clearOpts(prev),
            { role: 'user', content: display },
            {
              role: 'assistant',
              content: `**What should "${value.trim()}" do?**\n\nDescribe the automation, e.g. *"Check Amazon laptop prices and save the results"*`,
            },
          ]);
        }
        break;
      }

      case 'description': {
        if (value.trim().length < 5) {
          setMessages((prev) => [
            ...clearOpts(prev),
            { role: 'user', content: display },
            { role: 'assistant', content: 'Please give a more detailed description (at least a few words) so the AI can generate good steps.' },
          ]);
          break;
        }
        const newData = { ...wizard.data, description: value.trim() };
        setWizard({ step: 'trigger', data: newData });
        setMessages((prev) => [
          ...clearOpts(prev),
          { role: 'user', content: display },
          {
            role: 'assistant',
            content: `Got it!\n\n**How should this workflow be triggered?**`,
            options: TRIGGER_OPTIONS,
          },
        ]);
        break;
      }

      case 'trigger': {
        const trigger = parseTrigger(value);
        const newData = { ...wizard.data, trigger_type: trigger };
        if (trigger === 'scheduled') {
          setWizard({ step: 'schedule', data: newData });
          setMessages((prev) => [
            ...clearOpts(prev),
            { role: 'user', content: display },
            {
              role: 'assistant',
              content: `**How often should it run?**\n\nPick a preset or type a custom cron expression:`,
              options: SCHEDULE_PRESETS,
            },
          ]);
        } else {
          setWizard({ step: 'confirm', data: newData });
          setMessages((prev) => [
            ...clearOpts(prev),
            { role: 'user', content: display },
            buildCreateConfirm(newData),
          ]);
        }
        break;
      }

      case 'schedule': {
        const cron = parseSchedule(value);
        const newData = { ...wizard.data, schedule_cron: cron };
        setWizard({ step: 'confirm', data: newData });
        setMessages((prev) => [
          ...clearOpts(prev),
          { role: 'user', content: display },
          buildCreateConfirm(newData),
        ]);
        break;
      }

      case 'confirm': {
        if (['yes', 'y', 'create', 'confirm', 'go', 'do it', 'approve', 'ok', 'sure', 'yep', 'yeah', 'proceed'].some((w) => lower.includes(w))) {
          setMessages((prev) => [
            ...clearOpts(prev).map((m) =>
              m.action?.type === 'wizard_confirm' && !m.actionExecuted ? { ...m, actionExecuted: true } : m
            ),
            { role: 'user', content: display },
          ]);
          executeWizardCreate();
        } else {
          cancelActive(display);
        }
        break;
      }
    }
  };

  const buildCreateConfirm = (data: WizardData): Message => {
    const triggerLabel =
      data.trigger_type === 'scheduled'
        ? `Scheduled (\`${data.schedule_cron}\`)`
        : data.trigger_type === 'webhook'
          ? 'Webhook'
          : 'Manual';

    return {
      role: 'assistant',
      content:
        `Here's your workflow summary:\n\n` +
        `**Name:** ${data.name}\n` +
        `**Does:** ${data.description}\n` +
        `**Trigger:** ${triggerLabel}\n\n` +
        `Ready to create? AI will generate the automation steps.`,
      action: { type: 'wizard_confirm' },
      actionExecuted: false,
    };
  };

  const executeWizardCreate = async () => {
    if (!wizard) return;
    const { data } = wizard;
    setExecutingAction(true);

    setMessages((prev) =>
      prev.map((m) =>
        m.action?.type === 'wizard_confirm' && !m.actionExecuted ? { ...m, actionExecuted: true } : m
      )
    );

    addBot(`Creating **${data.name}**... AI is generating the steps now.`);

    try {
      const plan = await planWorkflow(data.description || data.name || 'automation workflow');
      const result = await createWorkflow({
        name: data.name || 'My Workflow',
        description: data.description || '',
        steps_json: JSON.stringify(plan.steps),
        trigger_type: data.trigger_type || 'manual',
        schedule_cron: data.schedule_cron,
      });

      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success(`Workflow created with ${plan.steps.length} steps!`);

      addBot(
        `Done! Created **${result.name}** with **${plan.steps.length} steps**` +
          (data.trigger_type === 'scheduled' ? ` (${data.schedule_cron})` : '') +
          `.\n\nTaking you there now...`
      );
      navigate(`/workflows/${result.id}`);
    } catch {
      toast.error('Failed to create workflow');
      addBot("Sorry, creation failed. You can try again or create manually from the Workflows page.");
    } finally {
      setWizard(null);
      setExecutingAction(false);
    }
  };

  /* ─────────────────────────────────────────────────────────────
     PENDING ACTION FLOW (confirmation for all other actions)
     ───────────────────────────────────────────────────────────── */

  const startPending = (action: ChatAction) => {
    switch (action.type) {
      case 'run_workflow': {
        setPending({ action, phase: 'confirm', collected: {} });
        addBot(
          `I'll run **${action.workflow_name}** now. It will start executing all steps immediately.\n\n**Shall I proceed?**`,
          { options: YES_NO_OPTIONS }
        );
        break;
      }
      case 'delete_workflow': {
        setPending({ action, phase: 'confirm', collected: {} });
        addBot(
          `I'll delete **${action.workflow_name}** and all its run history. **This cannot be undone.**\n\n**Are you sure?**`,
          { options: YES_NO_OPTIONS }
        );
        break;
      }
      case 'clone_workflow': {
        setPending({ action, phase: 'input', inputField: 'new_name', collected: {} });
        addBot(`I'll clone **${action.workflow_name}**.\n\n**What should the copy be called?**`);
        break;
      }
      case 'publish_workflow': {
        setPending({ action, phase: 'input', inputField: 'category', collected: {} });
        addBot(
          `I'll publish **${action.workflow_name}** to the marketplace.\n\n**What category?**`,
          { options: CATEGORY_OPTIONS }
        );
        break;
      }
      case 'use_template': {
        setPending({ action, phase: 'confirm', collected: {} });
        addBot(
          `I'll create a new workflow from the **${action.template_name}** template.\n\n**Sound good?**`,
          { options: YES_NO_OPTIONS }
        );
        break;
      }
      case 'abort_run': {
        setPending({ action, phase: 'confirm', collected: {} });
        addBot(
          `I'll stop the currently running execution.\n\n**Are you sure?**`,
          { options: YES_NO_OPTIONS }
        );
        break;
      }
      case 'change_name': {
        if (action.name) {
          setPending({ action, phase: 'confirm', collected: { name: action.name } });
          addBot(
            `I'll switch your profile to **${action.name}**.\n\n**Ready?**`,
            { options: YES_NO_OPTIONS }
          );
        } else {
          setPending({ action, phase: 'input', inputField: 'name', collected: {} });
          addBot(`**What would you like your new name to be?**`);
        }
        break;
      }
      default:
        break;
    }
  };

  const processPending = (display: string, value: string) => {
    if (!pending) return;
    const lower = value.toLowerCase().trim();

    if (['cancel', 'nevermind', 'stop', 'no', 'nope', 'nah', 'quit'].includes(lower)) {
      cancelActive(display);
      return;
    }

    if (pending.phase === 'input') {
      const newCollected = { ...pending.collected, [pending.inputField!]: value.trim() };

      let confirmMsg: string;
      switch (pending.action.type) {
        case 'clone_workflow':
          confirmMsg = `I'll create **${value.trim()}** as a copy of **${pending.action.workflow_name}**.\n\n**Ready?**`;
          break;
        case 'publish_workflow':
          confirmMsg = `Publishing **${pending.action.workflow_name}** under **${value.trim()}**.\n\n**Ready?**`;
          break;
        case 'change_name':
          confirmMsg = `Switch your profile to **${value.trim()}**?\n\n**Ready?**`;
          break;
        default:
          confirmMsg = `**Ready to proceed?**`;
      }

      setPending({ ...pending, phase: 'confirm', collected: newCollected });
      setMessages((prev) => [
        ...clearOpts(prev),
        { role: 'user', content: display },
        { role: 'assistant', content: confirmMsg, options: YES_NO_OPTIONS },
      ]);
    } else if (pending.phase === 'confirm') {
      if (['yes', 'y', 'sure', 'ok', 'go', 'do it', 'proceed', 'confirm', 'yep', 'yeah', 'approve'].some((w) => lower.includes(w))) {
        setMessages((prev) => [
          ...clearOpts(prev),
          { role: 'user', content: display },
        ]);
        executePendingAction();
      } else {
        cancelActive(display);
      }
    }
  };

  const executePendingAction = async () => {
    if (!pending) return;
    const { action, collected } = pending;
    setPending(null);
    setExecutingAction(true);

    try {
      switch (action.type) {
        case 'run_workflow': {
          addBot(`Starting **${action.workflow_name}**...`);
          const result = await triggerRun(action.workflow_id!);
          toast.success('Run started!');
          addBot(`**${action.workflow_name}** is running! Taking you to the live viewer...`);
          navigate(`/runs/${result.run_id}`);
          break;
        }

        case 'delete_workflow': {
          addBot(`Deleting **${action.workflow_name}**...`);
          await deleteWorkflow(action.workflow_id!);
          queryClient.invalidateQueries({ queryKey: ['workflows'] });
          toast.success(`Deleted ${action.workflow_name}`);
          addBot(`**${action.workflow_name}** has been deleted.`);
          break;
        }

        case 'clone_workflow': {
          const newName = collected.new_name || `${action.workflow_name} (Copy)`;
          addBot(`Cloning to **${newName}**...`);
          const original = await getWorkflow(action.workflow_id!);
          const cloned = await createWorkflow({
            name: newName,
            description: original.description || '',
            steps_json: original.steps_json || '[]',
            trigger_type: 'manual',
          });
          queryClient.invalidateQueries({ queryKey: ['workflows'] });
          toast.success('Workflow cloned!');
          addBot(`Done! **${newName}** is ready. Taking you there...`);
          navigate(`/workflows/${cloned.id}`);
          break;
        }

        case 'publish_workflow': {
          const cat = collected.category || 'general';
          addBot(`Publishing **${action.workflow_name}** under **${cat}**...`);
          await publishTemplate(action.workflow_id!, cat);
          toast.success('Published to marketplace!');
          addBot(`**${action.workflow_name}** is now live in the marketplace!`);
          break;
        }

        case 'use_template': {
          addBot(`Creating workflow from **${action.template_name}**...`);
          const wf = await useTemplate(action.template_id!);
          queryClient.invalidateQueries({ queryKey: ['workflows'] });
          toast.success('Template applied!');
          addBot(`Done! Taking you to your new workflow...`);
          navigate(`/workflows/${(wf as { id: string }).id}`);
          break;
        }

        case 'abort_run': {
          addBot(`Aborting run...`);
          await abortRun(action.run_id!);
          toast.success('Run aborted');
          addBot('The run has been stopped.');
          break;
        }

        case 'change_name': {
          const newName = collected.name || action.name || '';
          addBot(`Switching to **${newName}**...`);
          const user = await enterUser(newName);
          localStorage.setItem('userName', user.name);
          localStorage.setItem('userId', user.id);
          queryClient.clear();
          addBot(`Profile switched to **${user.name}**! Refreshing...`);
          setTimeout(() => window.location.reload(), 1500);
          break;
        }

        default:
          break;
      }
    } catch {
      toast.error('Action failed. Please try again.');
      addBot("Sorry, that action failed. You can try it manually or ask me to try again.");
    } finally {
      setExecutingAction(false);
    }
  };

  /* ─────────────────────────────────────────────────────────────
     AUTO-EXECUTE (read-only actions — no confirmation needed)
     ───────────────────────────────────────────────────────────── */

  const autoExecute = async (action: ChatAction) => {
    setExecutingAction(true);
    try {
      switch (action.type) {
        case 'generate_insights': {
          const insights = await generateInsights();
          const summary =
            insights.insights.length > 0
              ? insights.insights.map((ins) => `- **${ins.title}**: ${ins.description}`).join('\n')
              : 'No insights available yet — run some workflows first!';
          addBot(`**AI Insights:**\n\n${summary}\n\n${insights.summary}`);
          break;
        }
        case 'check_ai_status': {
          const status = await getAIStatus();
          addBot(
            `**AI Status:**\n\n` +
              `- **Connected:** ${status.connected ? 'Yes' : 'No'}\n` +
              `- **Text Model:** ${status.text_model}\n` +
              `- **Image Model:** ${status.image_model}\n` +
              `- **Region:** ${status.region}\n` +
              `- **Throttled:** ${status.throttled ? 'Yes' : 'No'}\n\n` +
              status.message
          );
          break;
        }
        case 'summarize_run': {
          if (!action.run_id) break;
          const summary = await getRunSummary(action.run_id);
          addBot(`**Run Summary:**\n\n${summary.summary}`);
          break;
        }
      }
    } catch {
      addBot('Sorry, that failed. Please try again.');
    } finally {
      setExecutingAction(false);
    }
  };

  /* ─────────────────────────────────────────────────────────────
     OPTION CLICK HANDLER (shared by wizard + pending)
     ───────────────────────────────────────────────────────────── */

  const handleOptionClick = (opt: WizardOption) => {
    if (wizard) {
      advanceWizard(opt.label, opt.value);
    } else if (pending) {
      processPending(opt.label, opt.value);
    }
  };

  /* ─────────────────────────────────────────────────────────────
     WIZARD_CONFIRM BUTTON HANDLER
     ───────────────────────────────────────────────────────────── */

  const executeAction = (action: ChatAction) => {
    if (action.type === 'wizard_confirm') {
      executeWizardCreate();
    } else if (action.type === 'wizard_cancel') {
      cancelActive();
    }
  };

  /* ─────────────────────────────────────────────────────────────
     SEND HANDLER
     ───────────────────────────────────────────────────────────── */

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading || executingAction) return;
    setInput('');

    // 1. Create wizard active
    if (wizard) {
      advanceWizard(text, text);
      return;
    }

    // 2. Pending action active
    if (pending) {
      processPending(text, text);
      return;
    }

    // 3. Normal chat
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
        actionExecuted: false,
      };

      if (!action) {
        // No action — just show the reply
        setMessages((prev) => [...prev, newMsg]);
      } else if (action.type === 'create_workflow') {
        // Start multi-step create wizard
        setMessages((prev) => [...prev, newMsg]);
        startWizard(action.description, action.name);
      } else if (action.type === 'navigate') {
        // Auto-execute navigation (instant, no harm)
        setMessages((prev) => [...prev, newMsg]);
        navigate(action.path!);
      } else if (action.type === 'not_found') {
        // Append error to reply
        if (action.message) newMsg.content += `\n\n*${action.message}*`;
        setMessages((prev) => [...prev, newMsg]);
      } else if (['generate_insights', 'check_ai_status', 'summarize_run'].includes(action.type)) {
        // Read-only: auto-execute and show results inline
        setMessages((prev) => [...prev, newMsg]);
        autoExecute(action);
      } else {
        // State-changing: start confirmation flow
        setMessages((prev) => [...prev, newMsg]);
        startPending(action);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Sorry, I couldn't process that. Please try again.", ai_generated: false },
      ]);
    } finally {
      setLoading(false);
    }
  };

  /* ─────────────────────────────────────────────────────────────
     RENDER
     ───────────────────────────────────────────────────────────── */

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
            <p className="text-xs text-gray-500">
              {wizard ? 'Creating workflow...' : pending ? 'Confirming action...' : 'Can do everything'}
            </p>
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

            {/* Option chips */}
            {msg.options && !msg.optionsUsed && (
              <div className="ml-9 mt-2 flex flex-wrap gap-1.5">
                {msg.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleOptionClick(opt)}
                    disabled={executingAction}
                    className={`text-xs px-3 py-1.5 rounded-full transition-colors border ${
                      opt.value === 'cancel'
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-300 dark:border-gray-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 hover:border-red-300'
                        : 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900/50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {/* Wizard confirm button (create workflow only) */}
            {msg.role === 'assistant' && msg.action && !msg.actionExecuted && (
              <div className="ml-9 mt-2">
                <ActionButton
                  action={msg.action}
                  executing={executingAction}
                  onExecute={() => executeAction(msg.action!)}
                  onCancel={msg.action.type === 'wizard_confirm' ? () => cancelActive() : undefined}
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
      {messages.length <= 1 && !isActive && (
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

      {/* Input area */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        {isActive && (
          <div className="mb-2 flex items-center gap-2 text-xs text-primary-600 dark:text-primary-400">
            <Zap className="w-3 h-3" />
            <span>
              {wizard ? 'Creating workflow' : 'Confirming action'} — type your answer or click an option
            </span>
            <button
              onClick={() => cancelActive()}
              className="ml-auto text-gray-400 hover:text-red-500 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
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
            placeholder={getPlaceholder(wizard, pending)}
            className="input text-sm flex-1"
            disabled={loading || executingAction}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading || executingAction}
            className="btn-primary px-3"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────── */

function getPlaceholder(wizard: CreateWizard | null, pending: PendingAction | null): string {
  if (wizard) {
    switch (wizard.step) {
      case 'name': return 'Enter workflow name...';
      case 'description': return 'Describe what it should do...';
      case 'trigger': return 'manual, scheduled, or webhook';
      case 'schedule': return 'e.g. every hour, daily at 9am';
      case 'confirm': return 'Type "yes" to create or "cancel"';
    }
  }
  if (pending) {
    if (pending.phase === 'input') {
      switch (pending.inputField) {
        case 'new_name': return 'Enter name for the copy...';
        case 'category': return 'Pick or type a category...';
        case 'name': return 'Enter your new name...';
      }
    }
    return 'Type "yes" to proceed or "cancel"';
  }
  return 'Ask anything or tell me to do something...';
}

function parseTrigger(text: string): string {
  const t = text.toLowerCase().trim();
  if (t.includes('schedule') || t.includes('cron') || t.includes('timer') || t === 'scheduled')
    return 'scheduled';
  if (t.includes('webhook') || t.includes('hook') || t.includes('api') || t === 'webhook')
    return 'webhook';
  return 'manual';
}

function parseSchedule(text: string): string {
  const t = text.toLowerCase().trim();
  if (/^[\d*\/\-,\s]+$/.test(t) && t.split(/\s+/).length >= 5) return t;
  if (t.includes('every hour') || t === 'hourly') return '0 * * * *';
  if (t.includes('every morning') || t.includes('daily') || t.includes('every day')) return '0 9 * * *';
  if (t.includes('every 6 hour')) return '0 */6 * * *';
  if (t.includes('every 12 hour') || t.includes('twice')) return '0 */12 * * *';
  if (t.includes('every 30 min')) return '*/30 * * * *';
  if (t.includes('every 15 min')) return '*/15 * * * *';
  if (t.includes('monday')) return '0 9 * * 1';
  if (t.includes('weekly') || t.includes('every week')) return '0 9 * * 1';
  if (t.includes('monthly') || t.includes('every month')) return '0 9 1 * *';
  return text.trim();
}

/* ── Action Button Component ─────────────────────────────────── */

function ActionButton({
  action,
  executing,
  onExecute,
  onCancel,
}: {
  action: ChatAction;
  executing: boolean;
  onExecute: () => void;
  onCancel?: () => void;
}) {
  const config: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    wizard_confirm: {
      label: 'Create Workflow',
      icon: <Check className="w-3.5 h-3.5" />,
      color: 'bg-green-600 hover:bg-green-700 text-white',
    },
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
    delete_workflow: {
      label: `Delete ${action.workflow_name || 'Workflow'}`,
      icon: <Trash2 className="w-3.5 h-3.5" />,
      color: 'bg-red-600 hover:bg-red-700 text-white',
    },
    clone_workflow: {
      label: `Clone ${action.workflow_name || 'Workflow'}`,
      icon: <Copy className="w-3.5 h-3.5" />,
      color: 'bg-blue-600 hover:bg-blue-700 text-white',
    },
    publish_workflow: {
      label: `Publish ${action.workflow_name || 'Workflow'}`,
      icon: <Share2 className="w-3.5 h-3.5" />,
      color: 'bg-purple-600 hover:bg-purple-700 text-white',
    },
    use_template: {
      label: `Use ${action.template_name || 'Template'}`,
      icon: <Zap className="w-3.5 h-3.5" />,
      color: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    },
    generate_insights: {
      label: 'Generate Insights',
      icon: <BarChart3 className="w-3.5 h-3.5" />,
      color: 'bg-amber-600 hover:bg-amber-700 text-white',
    },
    check_ai_status: {
      label: 'Check AI Status',
      icon: <Activity className="w-3.5 h-3.5" />,
      color: 'bg-cyan-600 hover:bg-cyan-700 text-white',
    },
    abort_run: {
      label: 'Abort Run',
      icon: <XCircle className="w-3.5 h-3.5" />,
      color: 'bg-red-600 hover:bg-red-700 text-white',
    },
    summarize_run: {
      label: 'Summarize Run',
      icon: <FileText className="w-3.5 h-3.5" />,
      color: 'bg-blue-600 hover:bg-blue-700 text-white',
    },
    change_name: {
      label: `Switch to "${action.name || ''}"`,
      icon: <User className="w-3.5 h-3.5" />,
      color: 'bg-gray-600 hover:bg-gray-700 text-white',
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
    <div className="flex gap-2">
      <button
        onClick={onExecute}
        disabled={executing}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm ${c.color}`}
      >
        {executing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : c.icon}
        {executing ? 'Working...' : c.label}
      </button>
      {onCancel && (
        <button
          onClick={onCancel}
          disabled={executing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
        >
          <XCircle className="w-3.5 h-3.5" />
          Cancel
        </button>
      )}
    </div>
  );
}

/* ── Markdown Formatter ──────────────────────────────────────── */

function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-gray-200 dark:bg-gray-700 px-1 rounded text-xs">$1</code>')
    .replace(/\n/g, '<br/>');
}
