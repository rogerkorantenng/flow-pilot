import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Workflow, Play, CheckCircle, Clock, ArrowRight, Zap, Loader2, Sparkles } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { SkeletonStatCards, SkeletonChart, SkeletonTable } from '../components/Skeleton';
import { listWorkflows, listRuns, planWorkflow, createWorkflow, triggerRun } from '../services/api';

const PIE_COLORS: Record<string, string> = {
  completed: '#22c55e',
  running: '#3b82f6',
  failed: '#ef4444',
  pending: '#eab308',
  cancelled: '#6b7280',
};

const DEMO_PROMPTS = [
  { label: 'Price Monitor', desc: 'Compare headphone prices on Amazon vs eBay', prompt: 'Check and compare prices for Sony WH-1000XM5 headphones on Amazon and eBay' },
  { label: 'Tech News', desc: 'Gather top AI headlines from multiple sources', prompt: 'Gather the latest AI and technology news from Google News and TechCrunch' },
  { label: 'Lead Research', desc: 'Research company profiles on LinkedIn', prompt: 'Research the CTO and VP Engineering profiles at Stripe on LinkedIn and gather company info' },
];

export default function Dashboard() {
  const userName = localStorage.getItem('userName') || 'there';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [demoRunning, setDemoRunning] = useState(false);

  const { data: workflows = [], isLoading: loadingWorkflows } = useQuery({
    queryKey: ['workflows'],
    queryFn: listWorkflows,
  });
  const { data: runs = [], isLoading: loadingRuns } = useQuery({
    queryKey: ['runs'],
    queryFn: () => listRuns(),
  });

  const isLoading = loadingWorkflows || loadingRuns;

  const demoMutation = useMutation({
    mutationFn: async (prompt: string) => {
      setDemoRunning(true);
      const { steps } = await planWorkflow(prompt);
      const workflow = await createWorkflow({
        name: prompt.slice(0, 60),
        description: prompt,
        steps_json: JSON.stringify(steps),
        trigger_type: 'manual',
      });
      const run = await triggerRun(workflow.id);
      return run.run_id;
    },
    onSuccess: (runId) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['runs'] });
      toast.success('Demo workflow created and running!');
      navigate(`/runs/${runId}`);
    },
    onError: () => {
      toast.error('Failed to start demo');
      setDemoRunning(false);
    },
  });

  const activeWorkflows = workflows.filter((w) => w.status === 'active').length;
  const recentRuns = runs.slice(0, 8);
  const completedRuns = runs.filter((r) => r.status === 'completed').length;
  const successRate = runs.length > 0 ? Math.round((completedRuns / runs.length) * 100) : 0;
  const scheduledWorkflows = workflows.filter((w) => w.trigger_type === 'scheduled').length;

  // Runs per day for last 7 days
  const now = new Date();
  const lineData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (6 - i));
    const dateStr = date.toISOString().slice(0, 10);
    const count = runs.filter((r) => r.created_at.slice(0, 10) === dateStr).length;
    return { date: date.toLocaleDateString('en', { weekday: 'short' }), runs: count };
  });

  // Status breakdown
  const statusCounts: Record<string, number> = {};
  for (const r of runs) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  }
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div>
      {/* Greeting */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">{greeting}, {userName}</h1>
          <p className="text-gray-500 mt-1">Here's an overview of your workflow automation</p>
        </div>
        <Link to="/workflows/new" className="btn-primary flex items-center gap-2">
          <Zap className="w-4 h-4" /> New Workflow
        </Link>
      </div>

      {/* Try Demo Banner */}
      <div className="mb-8 card bg-gradient-to-r from-primary-600 to-purple-600 border-0 p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5" />
              <h2 className="font-semibold">Try a Demo</h2>
            </div>
            <p className="text-primary-100 text-sm mb-4 max-w-lg">
              See FlowPilot in action! Pick a demo below — it will create a workflow, plan the steps with AI, and execute it live so you can watch the full automation loop.
            </p>
          </div>
          {demoRunning && (
            <div className="flex items-center gap-2 text-sm bg-white/20 rounded-lg px-3 py-1.5">
              <Loader2 className="w-4 h-4 animate-spin" /> Running...
            </div>
          )}
        </div>
        <div className="flex gap-3">
          {DEMO_PROMPTS.map((d) => (
            <button
              key={d.label}
              onClick={() => demoMutation.mutate(d.prompt)}
              disabled={demoRunning}
              className="flex-1 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 text-left transition-all disabled:opacity-50"
            >
              <span className="text-sm font-semibold block">{d.label}</span>
              <span className="text-xs text-primary-100">{d.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="mb-8"><SkeletonStatCards /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard label="Active Workflows" value={activeWorkflows} icon={Workflow} color="primary" />
          <StatCard label="Total Runs" value={runs.length} icon={Play} color="blue" />
          <StatCard label="Success Rate" value={runs.length > 0 ? `${successRate}%` : '--'} icon={CheckCircle} color="green" />
          <StatCard label="Scheduled" value={scheduledWorkflows} icon={Clock} color="amber" />
        </div>
      )}

      {/* Charts */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <SkeletonChart />
          <SkeletonChart />
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card p-6">
          <h3 className="font-semibold mb-4">Runs This Week</h3>
          {runs.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="runs" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex flex-col items-center justify-center text-gray-400">
              <Play className="w-10 h-10 mb-2 text-gray-300" />
              <p className="text-sm">Run a workflow to see activity here</p>
            </div>
          )}
        </div>

        <div className="card p-6">
          <h3 className="font-semibold mb-4">Status Breakdown</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} innerRadius={40} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={PIE_COLORS[entry.name] || '#6b7280'} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex flex-col items-center justify-center text-gray-400">
              <CheckCircle className="w-10 h-10 mb-2 text-gray-300" />
              <p className="text-sm">No data yet</p>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Recent runs */}
      {isLoading ? <SkeletonTable rows={4} /> : (
      <div className="card">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold">Recent Runs</h3>
          {runs.length > 0 && (
            <Link to="/workflows" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
        {recentRuns.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {recentRuns.map((run) => (
              <Link
                key={run.id}
                to={`/runs/${run.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{run.workflow_name || 'Unnamed Workflow'}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(run.created_at).toLocaleString()} &middot; {run.trigger}
                  </p>
                </div>
                <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                  <div className="text-sm text-gray-500">
                    <span className="font-medium">{run.completed_steps}</span>/{run.total_steps} steps
                  </div>
                  <StatusBadge status={run.status} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <Zap className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No runs yet</p>
            <p className="text-sm text-gray-400 mt-1">Create a workflow and trigger a run to get started</p>
            <Link to="/workflows/new" className="btn-primary mt-4 inline-flex items-center gap-2">
              <Zap className="w-4 h-4" /> Create Your First Workflow
            </Link>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
