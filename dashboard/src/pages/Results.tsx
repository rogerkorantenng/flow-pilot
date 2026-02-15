import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Database,
  Globe,
  MousePointerClick,
  Keyboard,
  Timer,
  GitBranch,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Filter,
  Copy,
  Check,
  Download,
  ArrowUpDown,
  Code,
  Eye,
  Sparkles,
  Loader2,
  BarChart3,
  Activity,
  TrendingUp,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import StatusBadge from '../components/StatusBadge';
import { SkeletonCard } from '../components/Skeleton';
import ResultRenderer from '../components/ResultRenderer';
import { listResults, listWorkflows, generateInsights, type Insight } from '../services/api';

const actionIcons: Record<string, React.ReactNode> = {
  navigate: <Globe className="w-3.5 h-3.5 text-blue-500" />,
  click: <MousePointerClick className="w-3.5 h-3.5 text-amber-500" />,
  type: <Keyboard className="w-3.5 h-3.5 text-green-500" />,
  extract: <Database className="w-3.5 h-3.5 text-purple-500" />,
  wait: <Timer className="w-3.5 h-3.5 text-gray-500" />,
  conditional: <GitBranch className="w-3.5 h-3.5 text-rose-500" />,
};

const ACTION_FILTERS = ['all', 'navigate', 'click', 'type', 'extract', 'wait', 'conditional'];

function ResultCard({
  result,
}: {
  result: {
    step_id: string;
    run_id: string;
    workflow_id: string;
    workflow_name: string;
    step_number: number;
    action: string;
    description: string | null;
    target: string | null;
    result_data: string;
    run_status: string;
    extracted_at: string | null;
  };
}) {
  const [expanded, setExpanded] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);

  let parsedData: Record<string, unknown> | null = null;
  try {
    parsedData = JSON.parse(result.result_data);
  } catch {
    // raw string
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = parsedData
      ? JSON.stringify(parsedData, null, 2)
      : result.result_data;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getPreview = (): string => {
    if (!parsedData) return result.result_data.slice(0, 100);
    if (typeof parsedData === 'object') {
      const keys = Object.keys(parsedData);
      const preview = keys.slice(0, 3).map((k) => {
        const val = parsedData![k];
        const valStr = typeof val === 'string' ? val : JSON.stringify(val);
        return `${k}: ${typeof valStr === 'string' ? valStr.slice(0, 40) : valStr}`;
      });
      if (keys.length > 3) preview.push(`+${keys.length - 3} more fields`);
      return preview.join(' | ');
    }
    return String(parsedData).slice(0, 100);
  };

  return (
    <div className="card overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
          {actionIcons[result.action] || <Database className="w-3.5 h-3.5 text-gray-400" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium truncate">
              {result.description || result.action}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-purple-50 text-purple-600">
              {result.action}
            </span>
          </div>
          <p className="text-xs text-gray-400 truncate">{getPreview()}</p>
        </div>

        <Link
          to={`/workflows/${result.workflow_id}`}
          className="text-xs text-gray-400 hover:text-primary-600 flex items-center gap-1 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {result.workflow_name}
          <ExternalLink className="w-3 h-3" />
        </Link>

        <StatusBadge status={result.run_status} />

        {result.extracted_at && (
          <span className="text-[10px] text-gray-400 flex-shrink-0 w-20 text-right">
            {new Date(result.extracted_at).toLocaleDateString()}
          </span>
        )}

        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>Step #{result.step_number}</span>
              {result.target && (
                <span className="truncate max-w-[300px]">
                  Target: <span className="font-mono">{result.target}</span>
                </span>
              )}
              <Link
                to={`/runs/${result.run_id}`}
                className="text-primary-600 hover:underline flex items-center gap-1"
              >
                View Run <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); setShowJson(!showJson); }}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                  showJson ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {showJson ? <Eye className="w-3.5 h-3.5" /> : <Code className="w-3.5 h-3.5" />}
                {showJson ? 'Visual' : 'JSON'}
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-500" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </>
                )}
              </button>
            </div>
          </div>
          {showJson ? (
            <pre className="text-xs text-gray-700 overflow-auto max-h-64 font-mono bg-white rounded-lg p-3 border border-gray-200">
              {parsedData
                ? JSON.stringify(parsedData, null, 2)
                : result.result_data}
            </pre>
          ) : parsedData ? (
            <ResultRenderer data={parsedData} action={result.action} />
          ) : (
            <p className="text-sm text-gray-600 bg-white rounded-lg p-3 border border-gray-200">{result.result_data}</p>
          )}
        </div>
      )}
    </div>
  );
}

const PIE_COLORS = ['#3b82f6', '#f59e0b', '#22c55e', '#a855f7', '#6b7280', '#f43f5e'];

export default function Results() {
  const [actionFilter, setActionFilter] = useState('all');
  const [workflowFilter, setWorkflowFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [insights, setInsights] = useState<Insight[]>([]);
  const [insightsSummary, setInsightsSummary] = useState('');
  const [insightsLoading, setInsightsLoading] = useState(false);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['results', actionFilter],
    queryFn: () =>
      listResults({
        action: actionFilter === 'all' ? undefined : actionFilter,
        limit: 200,
      }),
  });

  const { data: workflows = [] } = useQuery({
    queryKey: ['workflows'],
    queryFn: listWorkflows,
  });

  // Apply client-side filters
  const filtered = results
    .filter((r) => workflowFilter === 'all' || r.workflow_id === workflowFilter)
    .sort((a, b) => {
      const da = a.extracted_at ? new Date(a.extracted_at).getTime() : 0;
      const db = b.extracted_at ? new Date(b.extracted_at).getTime() : 0;
      return sortOrder === 'newest' ? db - da : da - db;
    });

  const totalResults = filtered.length;

  const handleExportJSON = () => {
    const exportData = filtered.map((r) => {
      let parsed;
      try { parsed = JSON.parse(r.result_data); } catch { parsed = r.result_data; }
      return {
        workflow: r.workflow_name,
        step: r.step_number,
        action: r.action,
        description: r.description,
        target: r.target,
        data: parsed,
        status: r.run_status,
        date: r.extracted_at,
      };
    });
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flowpilot-results-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const headers = ['Workflow', 'Step', 'Action', 'Description', 'Target', 'Status', 'Date', 'Data'];
    const rows = filtered.map((r) => [
      r.workflow_name,
      r.step_number,
      r.action,
      r.description || '',
      r.target || '',
      r.run_status,
      r.extracted_at || '',
      r.result_data.replace(/"/g, '""'),
    ]);
    const csv = [headers.join(','), ...rows.map((row) => row.map((v) => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flowpilot-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Extracted Results</h1>
          <p className="text-gray-500 mt-1">
            {totalResults} result{totalResults !== 1 ? 's' : ''} from workflow runs
          </p>
        </div>
        {filtered.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={handleExportJSON}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" /> JSON
            </button>
            <button
              onClick={handleExportCSV}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" /> CSV
            </button>
          </div>
        )}
      </div>

      {/* Data Dashboard */}
      {filtered.length > 0 && (
        <div className="mb-6 space-y-4">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Database className="w-4 h-4 text-purple-500" />
                <span className="text-xs text-gray-500">Total Results</span>
              </div>
              <span className="text-2xl font-bold">{filtered.length}</span>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-gray-500">Workflows</span>
              </div>
              <span className="text-2xl font-bold">
                {new Set(filtered.map((r) => r.workflow_id)).size}
              </span>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-4 h-4 text-green-500" />
                <span className="text-xs text-gray-500">Extract Steps</span>
              </div>
              <span className="text-2xl font-bold">
                {filtered.filter((r) => r.action === 'extract').length}
              </span>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-gray-500">Success Rate</span>
              </div>
              <span className="text-2xl font-bold text-green-600">
                {Math.round((filtered.filter((r) => r.run_status === 'completed').length / filtered.length) * 100)}%
              </span>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Action breakdown pie */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-600 mb-3">Results by Action Type</h3>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={(() => {
                      const counts: Record<string, number> = {};
                      filtered.forEach((r) => { counts[r.action] = (counts[r.action] || 0) + 1; });
                      return Object.entries(counts).map(([name, value]) => ({ name, value }));
                    })()}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {ACTION_FILTERS.filter((f) => f !== 'all').map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Results by workflow bar */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-600 mb-3">Results by Workflow</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={(() => {
                    const counts: Record<string, { name: string; count: number }> = {};
                    filtered.forEach((r) => {
                      if (!counts[r.workflow_id]) counts[r.workflow_id] = { name: r.workflow_name.slice(0, 20), count: 0 };
                      counts[r.workflow_id].count++;
                    });
                    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 6);
                  })()}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AI Insights */}
          {insights.length > 0 ? (
            <div className="card p-5 bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-purple-900">AI Insights</h3>
              </div>
              {insightsSummary && <p className="text-sm text-purple-800 mb-3">{insightsSummary}</p>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {insights.map((insight, i) => (
                  <div key={i} className={`bg-white rounded-lg p-3 border ${
                    insight.severity === 'warning' ? 'border-amber-200' :
                    insight.severity === 'success' ? 'border-green-200' : 'border-gray-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      {insight.severity === 'warning' ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> :
                       insight.severity === 'success' ? <TrendingUp className="w-3.5 h-3.5 text-green-500" /> :
                       <Info className="w-3.5 h-3.5 text-blue-500" />}
                      <h4 className="text-xs font-semibold">{insight.title}</h4>
                    </div>
                    <p className="text-[11px] text-gray-600">{insight.description}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <button
              className="card p-4 w-full text-left flex items-center gap-3 hover:shadow-md transition-all bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200"
              onClick={async () => {
                setInsightsLoading(true);
                try {
                  const res = await generateInsights();
                  setInsights(res.insights);
                  setInsightsSummary(res.summary);
                } catch { /* ignore */ } finally {
                  setInsightsLoading(false);
                }
              }}
              disabled={insightsLoading}
            >
              {insightsLoading ? <Loader2 className="w-5 h-5 text-purple-500 animate-spin" /> : <Sparkles className="w-5 h-5 text-purple-500" />}
              <div>
                <span className="font-semibold text-purple-900 block">Generate AI Insights</span>
                <span className="text-xs text-purple-600">Analyze all extracted data for trends and patterns</span>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400" />
          {ACTION_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActionFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                actionFilter === f
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'All Actions' : f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input text-sm py-1.5"
            value={workflowFilter}
            onChange={(e) => setWorkflowFilter(e.target.value)}
          >
            <option value="all">All Workflows</option>
            {workflows.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
          </button>
        </div>
      </div>

      {/* Results List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((result) => (
            <ResultCard key={result.step_id} result={result} />
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <Database className="w-14 h-14 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No results yet</h3>
          <p className="text-gray-400 mb-4 max-w-md mx-auto">
            Run a workflow to see extracted data here. Results from all completed steps will appear in this view.
          </p>
          <Link to="/workflows" className="btn-primary inline-flex items-center gap-2">
            Go to Workflows
          </Link>
        </div>
      )}
    </div>
  );
}
