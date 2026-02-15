import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play,
  Pencil,
  Clock,
  Zap,
  Loader2,
  Copy,
  Globe,
  MousePointerClick,
  Keyboard,
  Database,
  Timer,
  GitBranch,
  Trash2,
  TrendingUp,
  CheckCircle,
  Link2,
  ClipboardCopy,
  Check,
  BarChart3,
  Share2,
  Sparkles,
  AlertTriangle,
  Info,
  TrendingDown,
  ChevronDown,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useState } from 'react';
import toast from 'react-hot-toast';
import StatusBadge from '../components/StatusBadge';
import WorkflowCanvas from '../components/workflow/WorkflowCanvas';
import { getWorkflow, triggerRun, listRuns, deleteWorkflow, cloneWorkflow, publishTemplate, generateInsights, type Insight } from '../services/api';
import type { WorkflowStep } from '../types/workflow';

const actionIcons: Record<string, React.ReactNode> = {
  navigate: <Globe className="w-4 h-4 text-blue-500" />,
  click: <MousePointerClick className="w-4 h-4 text-amber-500" />,
  type: <Keyboard className="w-4 h-4 text-green-500" />,
  extract: <Database className="w-4 h-4 text-purple-500" />,
  wait: <Timer className="w-4 h-4 text-gray-500" />,
  conditional: <GitBranch className="w-4 h-4 text-rose-500" />,
};

const actionColors: Record<string, string> = {
  navigate: 'bg-blue-50 text-blue-700',
  click: 'bg-amber-50 text-amber-700',
  type: 'bg-green-50 text-green-700',
  extract: 'bg-purple-50 text-purple-700',
  wait: 'bg-gray-50 text-gray-700',
  conditional: 'bg-rose-50 text-rose-700',
};

export default function WorkflowDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: workflow, isLoading } = useQuery({
    queryKey: ['workflow', id],
    queryFn: () => getWorkflow(id!),
    enabled: !!id,
  });

  const [insights, setInsights] = useState<Insight[]>([]);
  const [insightsSummary, setInsightsSummary] = useState('');
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [publishCategory] = useState('general');

  const { data: runs = [] } = useQuery({
    queryKey: ['runs', id],
    queryFn: () => listRuns(id),
    enabled: !!id,
  });

  const runMutation = useMutation({
    mutationFn: () => triggerRun(id!),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['runs', id] });
      toast.success('Run started');
      navigate(`/runs/${data.run_id}`);
    },
    onError: () => toast.error('Failed to start run'),
  });

  const cloneMutation = useMutation({
    mutationFn: () => cloneWorkflow(id!),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success('Workflow cloned');
      navigate(`/workflows/${data.id}`);
    },
    onError: () => toast.error('Failed to clone workflow'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteWorkflow(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success('Workflow deleted');
      navigate('/workflows');
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => publishTemplate(id!, publishCategory),
    onSuccess: () => {
      toast.success('Published to marketplace!');
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
    onError: (err: Error & { response?: { data?: { detail?: string } } }) => {
      toast.error(err.response?.data?.detail || 'Failed to publish');
    },
  });

  const handleGetInsights = async () => {
    setInsightsLoading(true);
    try {
      const res = await generateInsights({ workflow_id: id });
      setInsights(res.insights);
      setInsightsSummary(res.summary);
    } catch {
      toast.error('Failed to generate insights');
    } finally {
      setInsightsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600 mb-3" />
        <p className="text-gray-500">Loading workflow...</p>
      </div>
    );
  }

  if (!workflow) {
    return <div className="text-center py-20 text-gray-400">Workflow not found</div>;
  }

  let steps: WorkflowStep[] = [];
  try {
    steps = workflow.steps_json ? JSON.parse(workflow.steps_json) : [];
  } catch {
    // ignore
  }

  const completedRuns = runs.filter((r) => r.status === 'completed').length;
  const failedRuns = runs.filter((r) => r.status === 'failed').length;
  const successRate = runs.length > 0 ? Math.round((completedRuns / runs.length) * 100) : 0;

  // Calculate avg run duration
  const durations = runs
    .filter((r) => r.started_at && r.completed_at)
    .map((r) => new Date(r.completed_at!).getTime() - new Date(r.started_at!).getTime());
  const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 1000) : 0;

  // Runs per day for chart (last 14 days)
  const now = new Date();
  const runChartData = Array.from({ length: 14 }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (13 - i));
    const dateStr = date.toISOString().slice(0, 10);
    const passed = runs.filter((r) => r.created_at.slice(0, 10) === dateStr && r.status === 'completed').length;
    const failed = runs.filter((r) => r.created_at.slice(0, 10) === dateStr && r.status === 'failed').length;
    return {
      date: date.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      passed,
      failed,
    };
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold">{workflow.name}</h1>
            <StatusBadge status={workflow.status} />
          </div>
          {workflow.description && (
            <p className="text-gray-500 max-w-2xl">{workflow.description}</p>
          )}
          <div className="flex items-center gap-4 mt-3 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              {workflow.trigger_type === 'scheduled' ? (
                <Clock className="w-4 h-4" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              {workflow.trigger_type}
            </span>
            {workflow.schedule_cron && <span>Cron: {workflow.schedule_cron}</span>}
            <span>{steps.length} steps</span>
            <span>{workflow.run_count} runs</span>
            {runs.length > 0 && <span>{successRate}% success rate</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending || steps.length === 0}
          >
            {runMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Run Now
          </button>
          <Link to={`/workflows/${id}/edit`} className="btn-secondary flex items-center gap-2">
            <Pencil className="w-4 h-4" /> Edit
          </Link>
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={() => cloneMutation.mutate()}
            disabled={cloneMutation.isPending}
          >
            {cloneMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            Clone
          </button>
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={() => publishMutation.mutate()}
            disabled={publishMutation.isPending}
          >
            {publishMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
            Publish
          </button>
          <button
            className="btn-danger flex items-center gap-2"
            onClick={() => {
              if (confirm('Delete this workflow and all its runs?')) deleteMutation.mutate();
            }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Webhook URL */}
      <WebhookSection workflowId={id!} />

      {/* Analytics */}
      {runs.length > 0 && (
        <div className="mb-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-gray-500">Total Runs</span>
              </div>
              <span className="text-2xl font-bold">{runs.length}</span>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-xs text-gray-500">Success Rate</span>
              </div>
              <span className="text-2xl font-bold text-green-600">{successRate}%</span>
              <span className="text-xs text-gray-400 ml-1">{completedRuns} passed / {failedRuns} failed</span>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Timer className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-gray-500">Avg Duration</span>
              </div>
              <span className="text-2xl font-bold">{avgDuration}s</span>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-purple-500" />
                <span className="text-xs text-gray-500">Steps/Run</span>
              </div>
              <span className="text-2xl font-bold">{steps.length}</span>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Run History (Last 14 Days)</h3>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={runChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={2} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={24} />
                <Tooltip />
                <Area type="monotone" dataKey="passed" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} />
                <Area type="monotone" dataKey="failed" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Smart Insights */}
      {runs.length > 0 && (
        <div className="mb-6">
          {insights.length > 0 || insightsSummary ? (
            <div className="card p-5 bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-purple-900">AI Insights</h3>
              </div>
              {insightsSummary && (
                <p className="text-sm text-purple-800 mb-4 leading-relaxed">{insightsSummary}</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {insights.map((insight, i) => (
                  <div key={i} className={`bg-white rounded-lg p-4 border ${
                    insight.severity === 'warning' ? 'border-amber-200' :
                    insight.severity === 'success' ? 'border-green-200' :
                    insight.severity === 'critical' ? 'border-red-200' : 'border-gray-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      {insight.severity === 'warning' ? <AlertTriangle className="w-4 h-4 text-amber-500" /> :
                       insight.severity === 'success' ? <TrendingUp className="w-4 h-4 text-green-500" /> :
                       insight.severity === 'critical' ? <TrendingDown className="w-4 h-4 text-red-500" /> :
                       <Info className="w-4 h-4 text-blue-500" />}
                      <h4 className="text-sm font-semibold">{insight.title}</h4>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{insight.description}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <button
              className="card p-4 w-full text-left flex items-center gap-3 hover:shadow-md transition-all bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200"
              onClick={handleGetInsights}
              disabled={insightsLoading}
            >
              {insightsLoading ? <Loader2 className="w-5 h-5 text-purple-500 animate-spin" /> : <Sparkles className="w-5 h-5 text-purple-500" />}
              <div>
                <span className="font-semibold text-purple-900 block">Generate AI Insights</span>
                <span className="text-xs text-purple-600">Analyze extracted data for trends, alerts, and recommendations</span>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Visual Flow Canvas */}
      {steps.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold mb-3">Visual Flow</h2>
          <WorkflowCanvas steps={steps} readOnly height="420px" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Steps */}
        <div className="lg:col-span-2">
          <div className="card p-6">
            <h2 className="font-semibold mb-4">Steps ({steps.length})</h2>
            {steps.length > 0 ? (
              <div className="space-y-3">
                {steps.map((step, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center">
                        {actionIcons[step.action] || <Zap className="w-4 h-4 text-primary-500" />}
                      </div>
                      {i < steps.length - 1 && <div className="w-0.5 h-4 bg-gray-200 mt-1" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${actionColors[step.action] || 'bg-gray-100 text-gray-600'}`}>
                          {step.action}
                        </span>
                        <span className="text-sm font-medium">{step.description}</span>
                      </div>
                      {step.target && (
                        <p className="text-xs text-gray-400 truncate">{step.target}</p>
                      )}
                      {step.value && (
                        <p className="text-xs text-gray-400 mt-0.5">Value: {step.value}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-300 mt-1 flex-shrink-0">#{step.step_number}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <p>No steps defined</p>
                <Link to={`/workflows/${id}/edit`} className="text-primary-600 text-sm hover:underline mt-2 inline-block">
                  Add steps in the editor
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Run History */}
        <div>
          <div className="card">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold">Run History</h2>
            </div>
            {runs.length > 0 ? (
              <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                {runs.map((run) => (
                  <Link
                    key={run.id}
                    to={`/runs/${run.id}`}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {new Date(run.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(run.created_at).toLocaleTimeString()} &middot; {run.trigger}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                      <span className="text-xs text-gray-400">
                        {run.completed_steps}/{run.total_steps}
                      </span>
                      <StatusBadge status={run.status} />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-gray-400 text-sm">
                No runs yet. Click "Run Now" to start.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function WebhookSection({ workflowId }: { workflowId: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const webhookUrl = `${window.location.origin}/api/workflows/webhook/${workflowId}`;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(webhookUrl, { method: 'POST' });
      if (res.ok) {
        setTestResult({ ok: true, message: 'Webhook triggered successfully! Check the run viewer.' });
      } else {
        const data = await res.json().catch(() => ({ detail: 'Unknown error' }));
        setTestResult({ ok: false, message: data.detail || `HTTP ${res.status}` });
      }
    } catch {
      setTestResult({ ok: false, message: 'Network error — could not reach webhook endpoint' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mb-6 card overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setShowDetails(!showDetails)}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
            <Link2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Webhook Trigger</h3>
            <p className="text-[11px] text-gray-400">Trigger via API from external services</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Active</span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Always-visible URL */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-gray-100 rounded-lg px-3 py-2 font-mono text-gray-700 truncate">
            POST {webhookUrl}
          </code>
          <button
            onClick={(e) => { e.stopPropagation(); handleCopy(`curl -X POST ${webhookUrl}`, 'curl'); }}
            className="btn-secondary flex items-center gap-1.5 text-xs py-2"
          >
            {copied === 'curl' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
            {copied === 'curl' ? 'Copied' : 'Copy cURL'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleTest(); }}
            className="btn-primary flex items-center gap-1.5 text-xs py-2"
            disabled={testing}
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Test
          </button>
        </div>

        {testResult && (
          <div className={`mt-2 text-xs rounded-lg px-3 py-2 flex items-center gap-2 ${
            testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {testResult.ok ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            {testResult.message}
          </div>
        )}
      </div>

      {/* Expanded details */}
      {showDetails && (
        <div className="border-t border-gray-100 px-4 py-4 bg-gray-50/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* cURL example */}
            <div>
              <h4 className="text-xs font-semibold text-gray-600 mb-2">cURL Example</h4>
              <div className="relative">
                <pre className="text-[11px] bg-gray-900 text-gray-100 rounded-lg p-3 font-mono overflow-x-auto">
{`curl -X POST \\
  ${webhookUrl}`}</pre>
                <button
                  className="absolute top-2 right-2 text-gray-400 hover:text-white"
                  onClick={() => handleCopy(`curl -X POST ${webhookUrl}`, 'curl-full')}
                >
                  {copied === 'curl-full' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* JavaScript example */}
            <div>
              <h4 className="text-xs font-semibold text-gray-600 mb-2">JavaScript / Node.js</h4>
              <div className="relative">
                <pre className="text-[11px] bg-gray-900 text-gray-100 rounded-lg p-3 font-mono overflow-x-auto">
{`fetch('${webhookUrl}', {
  method: 'POST',
})`}</pre>
                <button
                  className="absolute top-2 right-2 text-gray-400 hover:text-white"
                  onClick={() => handleCopy(`fetch('${webhookUrl}', { method: 'POST' })`, 'js')}
                >
                  {copied === 'js' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Python example */}
            <div>
              <h4 className="text-xs font-semibold text-gray-600 mb-2">Python</h4>
              <div className="relative">
                <pre className="text-[11px] bg-gray-900 text-gray-100 rounded-lg p-3 font-mono overflow-x-auto">
{`import requests
requests.post('${webhookUrl}')`}</pre>
                <button
                  className="absolute top-2 right-2 text-gray-400 hover:text-white"
                  onClick={() => handleCopy(`import requests\nrequests.post('${webhookUrl}')`, 'python')}
                >
                  {copied === 'python' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Integration tips */}
            <div>
              <h4 className="text-xs font-semibold text-gray-600 mb-2">Integration Ideas</h4>
              <div className="space-y-1.5">
                {[
                  { label: 'GitHub Actions', desc: 'Trigger on push or PR merge' },
                  { label: 'Zapier / Make', desc: 'Connect to 5000+ apps' },
                  { label: 'Cron Job', desc: 'Schedule with system crontab' },
                  { label: 'Slack Bot', desc: 'Trigger from slash commands' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    <span className="font-medium text-gray-700">{item.label}</span>
                    <span className="text-gray-400">— {item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Raw URL copy */}
          <div className="mt-4 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Raw URL:</span>
              <code className="text-xs font-mono text-gray-600 flex-1 truncate">{webhookUrl}</code>
              <button
                className="text-xs text-primary-600 hover:underline"
                onClick={() => handleCopy(webhookUrl, 'url')}
              >
                {copied === 'url' ? 'Copied!' : 'Copy URL'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
