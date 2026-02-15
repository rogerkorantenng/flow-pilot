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
import FlowGraph from '../components/FlowGraph';
import { getWorkflow, triggerRun, listRuns, deleteWorkflow, cloneWorkflow } from '../services/api';
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

      {/* Visual Flow Graph */}
      {steps.length > 0 && <FlowGraph steps={steps} />}

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
  const [copied, setCopied] = useState(false);
  const webhookUrl = `${window.location.origin}/api/workflows/webhook/${workflowId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(`curl -X POST ${webhookUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mb-6 card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Link2 className="w-4 h-4 text-primary-600" />
        <h3 className="text-sm font-semibold">Webhook Trigger</h3>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        Trigger this workflow from external services using a POST request:
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 font-mono text-gray-700 dark:text-gray-300 truncate">
          curl -X POST {webhookUrl}
        </code>
        <button onClick={handleCopy} className="btn-secondary flex items-center gap-1.5 text-xs py-2">
          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
