import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Workflow,
  Play,
  Sparkles,
  Database,
  Settings,
  Link2,
  MousePointerClick,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  MessageCircle,
  Star,
  Shield,
  Wrench,
  Eye,
} from 'lucide-react';

/* ── Section data ────────────────────────────────────────── */

interface GuideStep {
  text: string;
  detail?: string;
}

interface GuideSection {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
  steps: GuideStep[];
  tips?: string[];
  link?: { label: string; to: string };
}

const sections: GuideSection[] = [
  // 1 — Getting Started
  {
    id: 'getting-started',
    icon: <Shield className="w-5 h-5" />,
    title: 'Getting Started',
    subtitle: 'Create your account and explore the dashboard',
    color: 'from-green-500 to-emerald-600',
    steps: [
      {
        text: 'Enter your name in the welcome popup',
        detail:
          'When you first open FlowPilot, a popup asks for your name. Type any name (e.g. "Alice") and click "Enter". This creates your personal workspace — all your workflows, runs, and data are private to you.',
      },
      {
        text: 'Explore the Dashboard',
        detail:
          'After entering your name, you land on the Dashboard. It shows an overview: total workflows, recent runs, success rate, and quick-action cards. This is your home base.',
      },
      {
        text: 'Use the sidebar to navigate',
        detail:
          'The left sidebar has links to all sections: Dashboard, Workflows, Results, Templates, and Settings. Click any item to navigate. The active page is highlighted in blue.',
      },
      {
        text: 'Try the AI Copilot chat',
        detail:
          'See the blue chat bubble in the bottom-right corner? Click it to open the AI Copilot. Ask questions like "How many workflows do I have?" or "What does the extract action do?" and get instant answers.',
      },
    ],
    tips: [
      'Your data is isolated — other users can\'t see your workflows',
      'You can change your name anytime in Settings to switch accounts',
      'Press Ctrl+K to see keyboard shortcuts',
    ],
    link: { label: 'Go to Dashboard', to: '/' },
  },

  // 2 — Creating Workflows with AI
  {
    id: 'ai-create',
    icon: <Sparkles className="w-5 h-5" />,
    title: 'Create Workflows with AI',
    subtitle: 'Describe what you want in plain English — AI builds it',
    color: 'from-purple-500 to-indigo-600',
    steps: [
      {
        text: 'Go to the Workflows page',
        detail: 'Click "Workflows" in the sidebar. At the top, you\'ll see a blue gradient card that says "Quick Create with AI".',
      },
      {
        text: 'Type a description of what you want to automate',
        detail:
          'In the input field, describe your workflow in plain English. For example:\n\n"Check competitor prices on Amazon every morning and save results"\n"Go to Hacker News, extract the top 5 stories, and save the titles"\n"Monitor Twitter for brand mentions and analyze sentiment"',
      },
      {
        text: 'Click "Generate" or press Enter',
        detail:
          'The AI will analyze your description and automatically:\n1. Generate workflow steps (navigate, click, type, extract, etc.)\n2. Detect if it should be scheduled (e.g. "every morning" → daily at 9 AM)\n3. Create the workflow and take you to its detail page',
      },
      {
        text: 'Review the generated workflow',
        detail:
          'You\'ll land on the workflow detail page showing the visual flow canvas, steps list, and settings. Everything is editable — click "Edit" to modify any step.',
      },
    ],
    tips: [
      'Use time words like "every morning", "daily", "weekly" and the AI will auto-set a schedule',
      'Be specific — "extract prices from Amazon search results" works better than "check Amazon"',
      'You can also create workflows manually with the "New Workflow" button',
    ],
    link: { label: 'Go to Workflows', to: '/workflows' },
  },

  // 3 — Workflow Builder
  {
    id: 'builder',
    icon: <Wrench className="w-5 h-5" />,
    title: 'The Workflow Builder',
    subtitle: 'Build and edit workflows step by step',
    color: 'from-blue-500 to-cyan-600',
    steps: [
      {
        text: 'Open the builder',
        detail:
          'Click "New Workflow" on the Workflows page, or click "Edit" on any existing workflow. This opens the full builder with all editing tools.',
      },
      {
        text: 'Set the workflow name and trigger type',
        detail:
          'At the top, enter a name (required). Choose the trigger:\n\n- Manual: Run on-demand by clicking "Run Now"\n- Scheduled: Runs automatically on a cron schedule (pick a preset or enter custom)',
      },
      {
        text: 'Use the AI Step Generator',
        detail:
          'In the purple "AI Step Generator" section, describe what you want and click "Generate Steps". The AI creates structured steps you can then edit. Try the example prompts shown below the input.',
      },
      {
        text: 'Add steps manually',
        detail:
          'Click "Add Step" to add a new step. Each step has:\n\n- Action Type: navigate, click, type, extract, wait, or condition\n- Description: What this step does (human-readable)\n- Target: CSS selector, URL, or element identifier\n- Value: Text to type, wait time, etc.',
      },
      {
        text: 'Switch between List and Visual mode',
        detail:
          'Above the steps, toggle between "List" and "Visual" view. List mode lets you drag-reorder and expand each step. Visual mode shows the React Flow canvas where you can add nodes from the right panel.',
      },
      {
        text: 'Configure variables',
        detail:
          'Click "Variables & Secrets" to define reusable values. Reference them in step fields as {{variable_name}}. Mark sensitive values as "secret" — they\'ll be masked in the UI.',
      },
      {
        text: 'Save your workflow',
        detail:
          'Click "Create Workflow" (or "Update Workflow" if editing). You need at least a name and one step to save.',
      },
    ],
    tips: [
      'Drag steps by the grip handle (6 dots icon) to reorder them',
      'Click a step to expand and see all editable fields',
      'The visual canvas "Add Step" panel on the right adds nodes to the end',
      'Conditional steps need a condition expression like "result.price < 100"',
    ],
    link: { label: 'Create New Workflow', to: '/workflows/new' },
  },

  // 4 — Understanding Actions
  {
    id: 'actions',
    icon: <MousePointerClick className="w-5 h-5" />,
    title: 'Step Action Types',
    subtitle: 'What each action does in a workflow',
    color: 'from-amber-500 to-orange-600',
    steps: [
      {
        text: 'Navigate',
        detail:
          'Opens a URL in the browser. Target should be a full URL like "https://amazon.com". This is usually the first step in any workflow.',
      },
      {
        text: 'Click',
        detail:
          'Clicks an element on the page. Target should be a CSS selector like "button.submit", "#login-btn", or ".next-page". The automation engine finds the element and clicks it.',
      },
      {
        text: 'Type',
        detail:
          'Types text into an input field. Target is the CSS selector of the input, and Value is the text to type. Example: target = "input#search", value = "wireless headphones".',
      },
      {
        text: 'Extract',
        detail:
          'Extracts data from the current page. Target is the CSS selector of the data container. The AI generates realistic structured data (products, prices, news, leads, etc.) based on context.',
      },
      {
        text: 'Wait',
        detail:
          'Pauses execution for a specified time. Set the Value to milliseconds (e.g. "2000" for 2 seconds). Use this to wait for dynamic content to load.',
      },
      {
        text: 'Condition',
        detail:
          'Evaluates a condition and branches. If the condition is TRUE, the next step runs normally. If FALSE, the next step is SKIPPED. Set the condition expression like "result.price < 100" or "data_valid == true".',
      },
    ],
    tips: [
      'Extract steps generate context-aware data — mention "prices" to get product data, "news" for articles, etc.',
      'Conditions create branching: the visual canvas shows green (true) and red dashed (false/skip) edges',
      'You can chain multiple conditions to build complex logic',
    ],
  },

  // 5 — Running Workflows
  {
    id: 'running',
    icon: <Play className="w-5 h-5" />,
    title: 'Running Workflows',
    subtitle: 'Execute, monitor, and debug your automations',
    color: 'from-green-500 to-teal-600',
    steps: [
      {
        text: 'Start a run from the workflow detail page',
        detail:
          'Open any workflow and click the blue "Run Now" button in the top-right. This immediately starts executing all steps in order.',
      },
      {
        text: 'Or run directly from the Workflows list',
        detail:
          'On the Workflows page, each card has a "Run" button at the bottom. Click it to start a run and jump to the live viewer.',
      },
      {
        text: 'Watch the Live Execution Replay',
        detail:
          'The Run Viewer shows a real-time visual canvas with nodes lighting up as they execute:\n\n- Blue pulsing = currently running\n- Green = completed successfully\n- Red = failed\n- Yellow = skipped\n- Purple "HEALED" badge = AI auto-fixed a failure',
      },
      {
        text: 'View step details and results',
        detail:
          'Below the canvas, each step shows its status, execution time, and result data. Click a step to expand and see the full extracted data, error messages, or navigation results.',
      },
      {
        text: 'Handle failures',
        detail:
          'If a step fails:\n\n1. AI Self-Healing tries to auto-fix it first (you\'ll see a purple "HEALED" badge if successful)\n2. If self-healing fails, you get three options: Retry (run the step again), Skip (move to next step), or Abort (stop the entire run)\n3. You can also click "AI Fix" to get a suggestion for what went wrong',
      },
      {
        text: 'View the run summary',
        detail:
          'After a run completes, click "View Summary" to get an AI-generated natural language summary of what happened, how many steps passed, and any issues encountered.',
      },
    ],
    tips: [
      'Steps have realistic random failure rates (8% for extract, 4% for click) to simulate real-world scenarios',
      'The AI self-healer fixes common issues like stale selectors and timeout errors automatically',
      'You can trigger runs via webhook too — see the Webhook section on any workflow detail page',
    ],
  },

  // 6 — Webhook Triggers
  {
    id: 'webhooks',
    icon: <Link2 className="w-5 h-5" />,
    title: 'Webhook Triggers',
    subtitle: 'Trigger workflows from external services',
    color: 'from-indigo-500 to-violet-600',
    steps: [
      {
        text: 'Find the webhook section',
        detail:
          'Open any workflow detail page. Just below the header, you\'ll see the "Webhook Trigger" card with a POST URL.',
      },
      {
        text: 'Copy the cURL command',
        detail:
          'Click "Copy cURL" to copy a ready-to-paste curl command. Run it in your terminal to trigger the workflow remotely.',
      },
      {
        text: 'Test the webhook',
        detail:
          'Click the blue "Test" button to fire the webhook right from the browser. You\'ll see a green success message or red error message inline.',
      },
      {
        text: 'See code examples',
        detail:
          'Click the webhook card header to expand it. You\'ll see copy-paste code snippets for:\n\n- cURL (terminal)\n- JavaScript / Node.js (fetch)\n- Python (requests)\n\nEach has a copy button in the top-right corner.',
      },
      {
        text: 'Integrate with external services',
        detail:
          'The expanded section also shows integration ideas:\n\n- GitHub Actions: Trigger on push or PR merge\n- Zapier / Make: Connect to 5000+ apps\n- Cron Job: Schedule with system crontab\n- Slack Bot: Trigger from slash commands',
      },
    ],
    tips: [
      'Every workflow automatically gets a unique webhook URL',
      'Webhooks don\'t require authentication — the URL contains the workflow ID',
      'You can copy just the raw URL from the bottom of the expanded section',
    ],
  },

  // 7 — Visual Flow Canvas
  {
    id: 'canvas',
    icon: <Eye className="w-5 h-5" />,
    title: 'Visual Flow Canvas',
    subtitle: 'See your workflow as an interactive node graph',
    color: 'from-cyan-500 to-blue-600',
    steps: [
      {
        text: 'View on the workflow detail page',
        detail:
          'Every workflow with steps shows a "Visual Flow" section with the React Flow canvas. It displays Start → Steps → End with colored nodes for each action type.',
      },
      {
        text: 'Understand the node colors',
        detail:
          'Each action type has its own color:\n\n- Blue = Navigate\n- Amber = Click\n- Green = Type\n- Purple = Extract\n- Gray = Wait\n- Rose/Red = Condition',
      },
      {
        text: 'See conditional branching',
        detail:
          'Condition nodes have two outputs: a green "True" edge (continues normally) and a red dashed "False" edge labeled "skip" (jumps over the next step). This visually shows the branching logic.',
      },
      {
        text: 'Use canvas controls',
        detail:
          'The canvas has:\n\n- Zoom controls (bottom-left + / - buttons)\n- MiniMap (bottom-right corner) showing the full graph\n- Step count badge (top-left)\n- Drag to pan, scroll to zoom',
      },
      {
        text: 'Edit in visual mode',
        detail:
          'In the Workflow Builder, switch to "Visual" mode. An "Add Step" panel appears on the right — click any action type to add it to your workflow. Drag nodes to rearrange.',
      },
    ],
    tips: [
      'During a live run, nodes animate: blue pulsing for running, green for done, red for failed',
      'The "HEALED" purple badge appears on nodes that AI auto-fixed during execution',
      'Canvas is read-only on detail/run pages, editable in the builder',
    ],
  },

  // 8 — Extracted Data & Results
  {
    id: 'results',
    icon: <Database className="w-5 h-5" />,
    title: 'Extracted Data & Results',
    subtitle: 'View, analyze, and get AI insights on your data',
    color: 'from-purple-500 to-pink-600',
    steps: [
      {
        text: 'Go to the Results page',
        detail:
          'Click "Results" in the sidebar. This page shows all data extracted by your workflows across all runs.',
      },
      {
        text: 'View the dashboard stats',
        detail:
          'At the top, four stat cards show: Total Results, Unique Workflows, Extract Steps, and Success Rate. These give you a quick health overview.',
      },
      {
        text: 'Explore the charts',
        detail:
          'Two charts are shown:\n\n- Pie Chart: Results broken down by action type (extract, navigate, click, etc.)\n- Bar Chart: Results per workflow, so you can see which workflows produce the most data',
      },
      {
        text: 'Browse individual results',
        detail:
          'Below the charts, each result card shows the workflow name, step action, description, and the extracted JSON data. Expand any card to see the full structured data.',
      },
      {
        text: 'Generate AI Insights',
        detail:
          'Click the purple "Generate AI Insights" button. The AI analyzes all your extracted data and produces:\n\n- Price alerts (significant price drops or increases)\n- Sentiment analysis (positive/negative trends)\n- Trend detection (patterns across multiple runs)\n- Actionable recommendations',
      },
    ],
    tips: [
      'Insights work best when you have multiple runs with extracted data',
      'The AI uses rule-based analysis plus Nova AI (when available) for richer insights',
      'Each workflow detail page also has its own "Generate AI Insights" button scoped to that workflow',
    ],
    link: { label: 'Go to Results', to: '/results' },
  },

  // 9 — Workflow Marketplace
  {
    id: 'marketplace',
    icon: <Star className="w-5 h-5" />,
    title: 'Workflow Marketplace',
    subtitle: 'Browse, use, and publish workflow templates',
    color: 'from-amber-500 to-yellow-600',
    steps: [
      {
        text: 'Browse templates',
        detail:
          'Click "Templates" in the sidebar. You\'ll see the Workflow Marketplace with all available templates, sorted by popularity.',
      },
      {
        text: 'Check the Trending section',
        detail:
          'At the top, the "Trending Templates" section highlights the 3 most popular templates. The #1 template has a gold crown badge. Each card shows the category, usage count, description, and step preview.',
      },
      {
        text: 'Filter by category',
        detail:
          'Use the category tabs (Finance, Sales, Marketing, Monitoring, Research, General) to filter. Each category has its own icon and color.',
      },
      {
        text: 'Search templates',
        detail:
          'Use the search bar to find templates by name or description. Results update instantly as you type.',
      },
      {
        text: 'Use a template',
        detail:
          'Click "Use Template" on any card. This instantly creates a new workflow in your account with all the template\'s steps pre-configured. You\'re taken to the new workflow\'s detail page where you can edit or run it immediately.',
      },
      {
        text: 'Publish your own workflows',
        detail:
          'Open any of your workflows and click the "Publish" button in the header. Choose a category and your workflow becomes a template that appears in the marketplace for everyone.',
      },
    ],
    tips: [
      'Using a template increments its popularity counter',
      'Published templates are visible to all users',
      'Step preview chips on each card show what actions the template uses',
      'You can publish any workflow that has at least one step',
    ],
    link: { label: 'Go to Marketplace', to: '/templates' },
  },

  // 10 — Settings
  {
    id: 'settings',
    icon: <Settings className="w-5 h-5" />,
    title: 'Settings & Configuration',
    subtitle: 'Customize your experience and check AI status',
    color: 'from-gray-500 to-slate-600',
    steps: [
      {
        text: 'Change your profile',
        detail:
          'In Settings > Profile, change your name and click "Save Profile". This switches your user context — you\'ll see a different set of workflows and data. Reload the page after switching.',
      },
      {
        text: 'Configure execution settings',
        detail:
          'Adjust how workflows run:\n\n- Step Timeout: How long to wait before a step fails (5–120 seconds)\n- Max Retries: How many times to retry a failed step (0–5)\n- Failure Mode: What happens on failure — Ask Me, Skip Step, or Stop Run\n- Screenshots: Capture a screenshot after each step\n- Parallel Execution: Run independent steps concurrently',
      },
      {
        text: 'Set notification preferences',
        detail:
          'Toggle notifications for:\n- Run completed successfully\n- Run failed with errors\n- Scheduled run started',
      },
      {
        text: 'Check AI model status',
        detail:
          'The "AI Models" section shows live connection status for:\n\n- Amazon Nova Lite (workflow planning & data extraction)\n- Amazon Nova Pro (screenshot analysis)\n- Nova Act SDK (browser automation engine)\n\nGreen = Connected, Amber = Rate Limited, Gray = Offline. Click "Refresh" to check again.',
      },
    ],
    tips: [
      'Execution settings are saved to your browser (localStorage)',
      'If AI models show "Rate Limited", the system falls back to simulation mode automatically',
      'Use "Clear Local Data" in the Danger Zone to reset all preferences to defaults',
    ],
    link: { label: 'Go to Settings', to: '/settings' },
  },

  // 11 — AI Copilot Chat
  {
    id: 'copilot',
    icon: <MessageCircle className="w-5 h-5" />,
    title: 'AI Copilot Chat',
    subtitle: 'Get instant help and answers about your workflows',
    color: 'from-primary-500 to-blue-600',
    steps: [
      {
        text: 'Open the chat panel',
        detail:
          'Click the blue chat bubble icon in the bottom-right corner of any page. A side panel slides in from the right.',
      },
      {
        text: 'Ask questions',
        detail:
          'Type any question about FlowPilot or your workflows. Examples:\n\n- "How do I create a scheduled workflow?"\n- "What does the extract action do?"\n- "How many workflows do I have?"\n- "Why did my last run fail?"',
      },
      {
        text: 'Get contextual answers',
        detail:
          'The AI Copilot knows about your workflows, runs, and the platform. It provides relevant, helpful answers based on your current data and context.',
      },
    ],
    tips: [
      'The chat panel can be open while you work — it doesn\'t block the main UI',
      'Click the chat bubble again (or the X) to close the panel',
      'Messages are not saved between sessions',
    ],
  },
];

/* ── Expandable Section Component ────────────────────────── */

function GuideAccordion({ section, defaultOpen }: { section: GuideSection; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="card overflow-hidden" id={section.id}>
      {/* Header */}
      <button
        className="w-full flex items-center gap-4 p-5 hover:bg-gray-50 transition-colors text-left"
        onClick={() => setOpen(!open)}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white bg-gradient-to-br ${section.color} flex-shrink-0`}>
          {section.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900">{section.title}</h2>
          <p className="text-sm text-gray-500">{section.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-gray-400">{section.steps.length} steps</span>
          {open ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-gray-100">
          {/* Steps */}
          <div className="p-5">
            <ol className="space-y-4">
              {section.steps.map((step, i) => (
                <li key={i} className="flex gap-4">
                  {/* Step number */}
                  <div className="flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white bg-gradient-to-br ${section.color}`}>
                      {i + 1}
                    </div>
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 mb-1">{step.text}</h3>
                    {step.detail && (
                      <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                        {step.detail}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Tips */}
          {section.tips && section.tips.length > 0 && (
            <div className="mx-5 mb-5 rounded-xl bg-amber-50 border border-amber-200 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2">Pro Tips</h4>
              <ul className="space-y-1.5">
                {section.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
                    <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Link */}
          {section.link && (
            <div className="px-5 pb-5">
              <Link
                to={section.link.to}
                className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
              >
                {section.link.label} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Quick Nav ────────────────────────────────────────────── */

const quickNavItems = [
  { id: 'getting-started', icon: <Shield className="w-3.5 h-3.5" />, label: 'Getting Started' },
  { id: 'ai-create', icon: <Sparkles className="w-3.5 h-3.5" />, label: 'AI Create' },
  { id: 'builder', icon: <Wrench className="w-3.5 h-3.5" />, label: 'Builder' },
  { id: 'actions', icon: <MousePointerClick className="w-3.5 h-3.5" />, label: 'Actions' },
  { id: 'running', icon: <Play className="w-3.5 h-3.5" />, label: 'Running' },
  { id: 'webhooks', icon: <Link2 className="w-3.5 h-3.5" />, label: 'Webhooks' },
  { id: 'canvas', icon: <Eye className="w-3.5 h-3.5" />, label: 'Canvas' },
  { id: 'results', icon: <Database className="w-3.5 h-3.5" />, label: 'Results' },
  { id: 'marketplace', icon: <Star className="w-3.5 h-3.5" />, label: 'Marketplace' },
  { id: 'settings', icon: <Settings className="w-3.5 h-3.5" />, label: 'Settings' },
  { id: 'copilot', icon: <MessageCircle className="w-3.5 h-3.5" />, label: 'Copilot' },
];

/* ── Main page ────────────────────────────────────────────── */

export default function Guide() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-200">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">How to Use FlowPilot</h1>
            <p className="text-gray-500">Complete guide to every feature — step by step</p>
          </div>
        </div>
      </div>

      {/* Quick Start Banner */}
      <div className="card p-6 mb-6 bg-gradient-to-r from-primary-50 to-indigo-50 border-primary-200">
        <h2 className="font-semibold text-primary-900 mb-2">Quick Start (30 seconds)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {[
            { step: '1', label: 'Enter your name', desc: 'In the welcome popup', icon: <Shield className="w-4 h-4" /> },
            { step: '2', label: 'Go to Workflows', desc: 'Click in the sidebar', icon: <Workflow className="w-4 h-4" /> },
            { step: '3', label: 'Describe & Generate', desc: 'Type what to automate', icon: <Sparkles className="w-4 h-4" /> },
            { step: '4', label: 'Click Run', desc: 'Watch it execute live', icon: <Play className="w-4 h-4" /> },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3 bg-white rounded-xl p-3 border border-primary-100">
              <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 flex-shrink-0">
                {item.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-primary-900">{item.label}</p>
                <p className="text-xs text-primary-600">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Nav */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Jump to section</p>
        <div className="flex flex-wrap gap-2">
          {quickNavItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-primary-50 hover:text-primary-700 transition-colors"
            >
              {item.icon} {item.label}
            </a>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {sections.map((section, i) => (
          <GuideAccordion key={section.id} section={section} defaultOpen={i === 0} />
        ))}
      </div>

      {/* Footer help */}
      <div className="mt-8 text-center text-sm text-gray-400 pb-8">
        <p>Still have questions? Click the <MessageCircle className="w-4 h-4 inline text-primary-500" /> chat bubble to ask the AI Copilot.</p>
      </div>
    </div>
  );
}
