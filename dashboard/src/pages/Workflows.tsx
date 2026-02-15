import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Play,
  Pencil,
  Trash2,
  Clock,
  Zap,
  Loader2,
  Search,
  Filter,
  Globe,
  MousePointerClick,
  Keyboard,
  Database,
  Timer,
  GitBranch,
  ArrowRight,
  Workflow,
} from 'lucide-react';
import toast from 'react-hot-toast';
import StatusBadge from '../components/StatusBadge';
import { SkeletonCard } from '../components/Skeleton';
import { listWorkflows, deleteWorkflow, triggerRun, generateWorkflow } from '../services/api';
import type { WorkflowStep } from '../types/workflow';

const actionIcons: Record<string, React.ReactNode> = {
  navigate: <Globe className="w-3 h-3" />,
  click: <MousePointerClick className="w-3 h-3" />,
  type: <Keyboard className="w-3 h-3" />,
  extract: <Database className="w-3 h-3" />,
  wait: <Timer className="w-3 h-3" />,
  conditional: <GitBranch className="w-3 h-3" />,
};

const FILTERS = ['all', 'active', 'paused', 'archived'] as const;

export default function Workflows() {
  const [nlInput, setNlInput] = useState('');
  const [planning, setPlanning] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: listWorkflows,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWorkflow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success('Workflow deleted');
    },
  });

  const runMutation = useMutation({
    mutationFn: triggerRun,
    onSuccess: (data) => {
      toast.success('Run started');
      navigate(`/runs/${data.run_id}`);
    },
    onError: () => toast.error('Failed to start run'),
  });

  const handleQuickCreate = async () => {
    if (!nlInput.trim()) return;
    setPlanning(true);
    try {
      const result = await generateWorkflow(nlInput);
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success(`Workflow created with ${result.steps_count} steps${result.trigger_type === 'scheduled' ? ' (scheduled)' : ''}`);
      navigate(`/workflows/${result.id}`);
    } catch {
      toast.error('Failed to generate workflow');
    } finally {
      setPlanning(false);
    }
  };

  const filtered = workflows.filter((w) => {
    const matchesSearch =
      !search ||
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.description?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || w.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStepPreview = (stepsJson: string | null): WorkflowStep[] => {
    if (!stepsJson) return [];
    try {
      return JSON.parse(stepsJson);
    } catch {
      return [];
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Workflows</h1>
          <p className="text-gray-500 mt-1">
            {workflows.length} workflow{workflows.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <Link to="/workflows/new" className="btn-primary flex items-center gap-2">
          <Zap className="w-4 h-4" /> New Workflow
        </Link>
      </div>

      {/* NL Quick Create */}
      <div className="card p-6 mb-6 bg-gradient-to-r from-primary-50 to-blue-50 border-primary-100">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-5 h-5 text-primary-600" />
          <h2 className="font-semibold text-primary-900">Quick Create with AI</h2>
        </div>
        <p className="text-sm text-primary-700 mb-3">
          Describe what you want to automate and AI will generate the workflow steps.
        </p>
        <div className="flex gap-3">
          <input
            className="input flex-1 bg-white"
            placeholder="e.g., Check competitor prices on Amazon every morning and save results..."
            value={nlInput}
            onChange={(e) => setNlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuickCreate()}
          />
          <button
            className="btn-primary whitespace-nowrap flex items-center gap-2"
            onClick={handleQuickCreate}
            disabled={planning || !nlInput.trim()}
          >
            {planning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {planning ? 'Planning...' : 'Generate'}
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search workflows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                statusFilter === f
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Workflow Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((w) => {
            const steps = getStepPreview(w.steps_json);
            return (
              <div key={w.id} className="card hover:shadow-md transition-all group">
                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        {w.trigger_type === 'scheduled' ? (
                          <Clock className="w-4.5 h-4.5 text-primary-600" />
                        ) : (
                          <Zap className="w-4.5 h-4.5 text-primary-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{w.name}</h3>
                        <span className="text-xs text-gray-400 capitalize">{w.trigger_type}</span>
                      </div>
                    </div>
                    <StatusBadge status={w.status} />
                  </div>

                  {/* Description */}
                  {w.description && (
                    <p className="text-sm text-gray-500 mb-3 line-clamp-2">{w.description}</p>
                  )}

                  {/* Step Preview */}
                  {steps.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {steps.slice(0, 5).map((s, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-50 text-[10px] text-gray-500 font-medium"
                        >
                          {actionIcons[s.action]} {s.action}
                        </span>
                      ))}
                      {steps.length > 5 && (
                        <span className="px-2 py-0.5 rounded bg-gray-50 text-[10px] text-gray-400">
                          +{steps.length - 5} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                    <span>{steps.length} steps</span>
                    <span>{w.run_count} runs</span>
                    {w.last_run && (
                      <span>Last: {new Date(w.last_run.created_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex border-t border-gray-100">
                  <button
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-primary-600 hover:bg-primary-50 transition-colors"
                    onClick={() => runMutation.mutate(w.id)}
                    disabled={runMutation.isPending || steps.length === 0}
                  >
                    {runMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    Run
                  </button>
                  <Link
                    to={`/workflows/${w.id}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors border-l border-gray-100"
                  >
                    <ArrowRight className="w-3.5 h-3.5" /> View
                  </Link>
                  <Link
                    to={`/workflows/${w.id}/edit`}
                    className="flex items-center justify-center px-3 py-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors border-l border-gray-100"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Link>
                  <button
                    className="flex items-center justify-center px-3 py-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors border-l border-gray-100"
                    onClick={() => {
                      if (confirm('Delete this workflow?')) deleteMutation.mutate(w.id);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : workflows.length > 0 ? (
        <div className="card p-12 text-center">
          <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-gray-600 font-medium mb-1">No matching workflows</h3>
          <p className="text-sm text-gray-400">
            Try adjusting your search or filter.
          </p>
        </div>
      ) : (
        <div className="card p-12 text-center">
          <Workflow className="w-14 h-14 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No workflows yet</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Create your first workflow by describing it above, or use the builder for manual control.
          </p>
          <div className="flex gap-3 justify-center">
            <Link to="/workflows/new" className="btn-primary flex items-center gap-2">
              <Zap className="w-4 h-4" /> New Workflow
            </Link>
            <Link to="/templates" className="btn-secondary flex items-center gap-2">
              Start from Template <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
