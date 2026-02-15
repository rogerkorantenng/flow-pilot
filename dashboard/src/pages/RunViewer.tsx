import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  RotateCcw,
  SkipForward,
  StopCircle,
  ArrowLeft,
  Monitor,
  Globe,
  MousePointerClick,
  Keyboard,
  Database,
  Timer,
  GitBranch,
  Terminal,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Brain,
  FileDown,
  Play,
  Pause,
} from 'lucide-react';
import toast from 'react-hot-toast';
import StatusBadge from '../components/StatusBadge';
import { useSSE } from '../hooks/useSSE';
import ResultRenderer from '../components/ResultRenderer';
import { getRun, retryStep, skipStep, abortRun, getRunSummary, getAIFix } from '../services/api';
import type { SSEEvent, RunStep } from '../types/workflow';

interface LogEntry {
  time: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
}

const stepStatusIcon: Record<string, React.ReactNode> = {
  pending: <Clock className="w-5 h-5 text-gray-400" />,
  running: <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />,
  completed: <CheckCircle className="w-5 h-5 text-green-500" />,
  failed: <XCircle className="w-5 h-5 text-red-500" />,
  skipped: <SkipForward className="w-5 h-5 text-yellow-500" />,
};

const actionIcons: Record<string, React.ReactNode> = {
  navigate: <Globe className="w-3.5 h-3.5" />,
  click: <MousePointerClick className="w-3.5 h-3.5" />,
  type: <Keyboard className="w-3.5 h-3.5" />,
  extract: <Database className="w-3.5 h-3.5" />,
  wait: <Timer className="w-3.5 h-3.5" />,
  conditional: <GitBranch className="w-3.5 h-3.5" />,
};

function formatElapsed(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return '';
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function RunViewer() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [failedStep, setFailedStep] = useState<RunStep | null>(null);
  const [liveSteps, setLiveSteps] = useState<Record<string, Partial<RunStep>>>({});
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [logOpen, setLogOpen] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [aiFix, setAiFix] = useState<string | null>(null);
  const [aiFixLoading, setAiFixLoading] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [replayStep, setReplayStep] = useState(0);
  const replayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((type: LogEntry['type'], message: string) => {
    const time = new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogEntries((prev) => [...prev, { time, type, message }]);
  }, []);

  const { data: run, isLoading } = useQuery({
    queryKey: ['run', id],
    queryFn: () => getRun(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data && (data.status === 'running' || data.status === 'pending') ? 2000 : false;
    },
  });

  const isLive = run?.status === 'running' || run?.status === 'pending';

  const handleSSEEvent = useCallback(
    (event: SSEEvent) => {
      if (event.type === 'step_started' && event.step_id) {
        setLiveSteps((prev) => ({
          ...prev,
          [event.step_id!]: { status: 'running', description: event.description },
        }));
        setSelectedStep(event.step_id);
        addLog('info', `Step ${event.step_number || '?'} started: ${event.description || event.action || 'executing...'}`);
      } else if (event.type === 'step_completed' && event.step_id) {
        setLiveSteps((prev) => ({
          ...prev,
          [event.step_id!]: {
            status: 'completed',
            result_data: event.result ? JSON.stringify(event.result) : null,
          },
        }));
        addLog('success', `Step ${event.step_number || '?'} completed successfully`);
      } else if (event.type === 'step_failed' && event.step_id) {
        setLiveSteps((prev) => ({
          ...prev,
          [event.step_id!]: { status: 'failed', error_message: event.error },
        }));
        const step = run?.steps.find((s) => s.id === event.step_id);
        if (step) {
          setFailedStep({ ...step, status: 'failed', error_message: event.error || null });
          setAiFix(null);
        }
        addLog('error', `Step ${event.step_number || '?'} failed: ${event.error || 'unknown error'}`);
      } else if (event.type === 'step_skipped' && event.step_id) {
        setLiveSteps((prev) => ({
          ...prev,
          [event.step_id!]: { status: 'skipped' },
        }));
        setFailedStep(null);
        addLog('warning', `Step ${event.step_number || '?'} skipped`);
      } else if (event.type === 'run_completed' || event.type === 'run_failed') {
        queryClient.invalidateQueries({ queryKey: ['run', id] });
        setLiveSteps({});
        setFailedStep(null);
        if (event.type === 'run_completed') {
          toast.success('Run completed successfully');
          addLog('success', 'Run completed successfully');
        } else {
          addLog('error', 'Run failed');
        }
      }
    },
    [id, queryClient, run?.steps, addLog]
  );

  useSSE(isLive ? id! : null, handleSSEEvent);

  // Auto-scroll to running step
  useEffect(() => {
    if (stepsRef.current && selectedStep) {
      const el = stepsRef.current.querySelector(`[data-step-id="${selectedStep}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedStep]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current && logOpen) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logEntries, logOpen]);

  // Fetch summary when run completes
  useEffect(() => {
    if (run && (run.status === 'completed' || run.status === 'failed') && !summary && !summaryLoading) {
      setSummaryLoading(true);
      getRunSummary(run.id)
        .then((res) => setSummary(res.summary))
        .catch(() => {})
        .finally(() => setSummaryLoading(false));
    }
  }, [run?.status, run?.id, summary, summaryLoading]);

  const handleAIFix = async () => {
    if (!failedStep || !id) return;
    setAiFixLoading(true);
    try {
      const res = await getAIFix(id, failedStep.id, {
        error_message: failedStep.error_message || 'Unknown error',
        step_action: failedStep.action,
        step_description: failedStep.description || undefined,
        step_target: failedStep.target || undefined,
      });
      setAiFix(res.suggestion);
    } catch {
      toast.error('Failed to get AI suggestion');
    } finally {
      setAiFixLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!failedStep || !id) return;
    try {
      await retryStep(id, failedStep.id);
      setFailedStep(null);
      toast.success('Retrying step...');
    } catch {
      toast.error('Failed to retry');
    }
  };

  const handleSkip = async () => {
    if (!failedStep || !id) return;
    try {
      await skipStep(id, failedStep.id);
      setFailedStep(null);
      toast.success('Step skipped');
    } catch {
      toast.error('Failed to skip');
    }
  };

  const handleAbort = async () => {
    if (!id) return;
    try {
      await abortRun(id);
      setFailedStep(null);
      toast.success('Run aborted');
      queryClient.invalidateQueries({ queryKey: ['run', id] });
    } catch {
      toast.error('Failed to abort');
    }
  };

  // Step Replay
  const startReplay = useCallback(() => {
    if (!run || run.steps.length === 0) return;
    setReplaying(true);
    setReplayStep(0);
    setSelectedStep(run.steps[0].id);
    let i = 0;
    replayTimerRef.current = setInterval(() => {
      i++;
      if (i >= run.steps.length) {
        if (replayTimerRef.current) clearInterval(replayTimerRef.current);
        setReplaying(false);
        return;
      }
      setReplayStep(i);
      setSelectedStep(run.steps[i].id);
    }, 1500);
  }, [run]);

  const stopReplay = useCallback(() => {
    if (replayTimerRef.current) clearInterval(replayTimerRef.current);
    setReplaying(false);
  }, []);

  useEffect(() => {
    return () => { if (replayTimerRef.current) clearInterval(replayTimerRef.current); };
  }, []);

  // PDF Export
  const exportPDF = useCallback(() => {
    if (!run) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const stepsHtml = (run.steps || []).map((s) => {
      const statusColor = s.status === 'completed' ? '#22c55e' : s.status === 'failed' ? '#ef4444' : '#6b7280';
      let resultHtml = '';
      if (s.result_data) {
        try {
          const parsed = JSON.parse(s.result_data);
          resultHtml = `<pre style="background:#f3f4f6;padding:8px;border-radius:6px;font-size:11px;overflow:auto;max-height:200px">${JSON.stringify(parsed, null, 2)}</pre>`;
        } catch {
          resultHtml = `<pre style="background:#f3f4f6;padding:8px;border-radius:6px;font-size:11px">${s.result_data}</pre>`;
        }
      }
      if (s.error_message) {
        resultHtml += `<div style="background:#fef2f2;border:1px solid #fecaca;padding:8px;border-radius:6px;color:#dc2626;font-size:12px;margin-top:6px">${s.error_message}</div>`;
      }
      return `<div style="margin-bottom:16px;padding:12px;border:1px solid #e5e7eb;border-radius:8px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="color:${statusColor};font-weight:600">${s.status === 'completed' ? 'PASS' : s.status === 'failed' ? 'FAIL' : s.status.toUpperCase()}</span>
          <span style="font-weight:600">Step ${s.step_number}: ${s.description || s.action}</span>
          <span style="color:#9ca3af;font-size:11px;text-transform:uppercase">${s.action}</span>
        </div>
        ${s.target ? `<div style="font-size:12px;color:#6b7280">Target: ${s.target}</div>` : ''}
        ${resultHtml}
      </div>`;
    }).join('');

    const dur = run.started_at && run.completed_at
      ? `${((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000).toFixed(1)}s`
      : 'N/A';

    w.document.write(`<!DOCTYPE html><html><head><title>FlowPilot Run Report</title>
      <style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:800px;margin:0 auto;padding:40px 20px;color:#1f2937}
      @media print{body{padding:20px}}</style></head><body>
      <h1 style="font-size:24px;margin-bottom:4px">FlowPilot Run Report</h1>
      <p style="color:#6b7280;margin-bottom:24px">${run.workflow_name} &mdash; ${new Date(run.created_at).toLocaleString()}</p>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
        <div style="background:#f9fafb;padding:12px;border-radius:8px;text-align:center">
          <div style="font-size:11px;color:#6b7280">Status</div>
          <div style="font-size:18px;font-weight:700;color:${run.status === 'completed' ? '#22c55e' : '#ef4444'}">${run.status}</div>
        </div>
        <div style="background:#f9fafb;padding:12px;border-radius:8px;text-align:center">
          <div style="font-size:11px;color:#6b7280">Steps</div>
          <div style="font-size:18px;font-weight:700">${run.completed_steps}/${run.total_steps}</div>
        </div>
        <div style="background:#f9fafb;padding:12px;border-radius:8px;text-align:center">
          <div style="font-size:11px;color:#6b7280">Duration</div>
          <div style="font-size:18px;font-weight:700">${dur}</div>
        </div>
        <div style="background:#f9fafb;padding:12px;border-radius:8px;text-align:center">
          <div style="font-size:11px;color:#6b7280">Trigger</div>
          <div style="font-size:18px;font-weight:700">${run.trigger}</div>
        </div>
      </div>
      ${summary ? `<div style="background:#faf5ff;border:1px solid #e9d5ff;padding:12px;border-radius:8px;margin-bottom:24px"><strong>AI Summary:</strong> ${summary}</div>` : ''}
      <h2 style="font-size:18px;margin-bottom:12px">Step Results</h2>
      ${stepsHtml}
      <p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:32px">Generated by FlowPilot &mdash; ${new Date().toLocaleString()}</p>
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }, [run, summary]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600 mb-3" />
        <p className="text-gray-500">Loading run details...</p>
      </div>
    );
  }

  if (!run) {
    return <div className="text-center py-20 text-gray-400">Run not found</div>;
  }

  const steps = run.steps || [];
  const selected = steps.find((s) => s.id === selectedStep);
  const selectedLive = selectedStep ? liveSteps[selectedStep] : undefined;
  const progressPercent = run.total_steps > 0 ? Math.round((run.completed_steps / run.total_steps) * 100) : 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <Link to={`/workflows/${run.workflow_id}`} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{run.workflow_name || 'Workflow Run'}</h1>
            <StatusBadge status={run.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {run.trigger} trigger &middot; {new Date(run.created_at).toLocaleString()}
            {run.started_at && run.completed_at && (
              <> &middot; Duration: {formatElapsed(run.started_at, run.completed_at)}</>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {/* Step Replay */}
          {!isLive && steps.length > 0 && (
            <button
              className={`btn-secondary flex items-center gap-1.5 text-sm ${replaying ? 'ring-2 ring-primary-300' : ''}`}
              onClick={replaying ? stopReplay : startReplay}
            >
              {replaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {replaying ? `Replaying ${replayStep + 1}/${steps.length}` : 'Replay'}
            </button>
          )}
          {/* PDF Export */}
          {!isLive && (
            <button className="btn-secondary flex items-center gap-1.5 text-sm" onClick={exportPDF}>
              <FileDown className="w-4 h-4" /> Export
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="text-gray-500">Progress</span>
          <span className="font-medium">{run.completed_steps}/{run.total_steps} steps ({progressPercent}%)</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ${
              run.status === 'failed' ? 'bg-red-500' : run.status === 'completed' ? 'bg-green-500' : 'bg-primary-600'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* AI Summary */}
      {(summary || summaryLoading) && (
        <div className="mb-6 card bg-gradient-to-r from-purple-50 to-primary-50 dark:from-purple-900/20 dark:to-primary-900/20 border-purple-200 dark:border-purple-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-400">AI Summary</h3>
          </div>
          {summaryLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Generating summary...
            </div>
          ) : (
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{summary}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step Timeline */}
        <div className="lg:col-span-1 card p-4 max-h-[600px] overflow-y-auto" ref={stepsRef}>
          <h2 className="font-semibold mb-3 px-2">Steps</h2>
          <div className="space-y-0.5">
            {steps.map((step, i) => {
              const live = liveSteps[step.id];
              const status = live?.status || step.status;
              const isSelected = selectedStep === step.id;

              return (
                <button
                  key={step.id}
                  data-step-id={step.id}
                  onClick={() => setSelectedStep(step.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                    replaying && steps[replayStep]?.id === step.id
                      ? 'bg-primary-100 ring-2 ring-primary-400 scale-[1.02]'
                      : isSelected
                      ? 'bg-primary-50 ring-1 ring-primary-200'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    {stepStatusIcon[status] || stepStatusIcon.pending}
                    {i < steps.length - 1 && (
                      <div className={`absolute left-2.5 top-7 w-0.5 h-4 ${
                        status === 'completed' ? 'bg-green-200' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400">{actionIcons[step.action]}</span>
                      <p className="text-sm font-medium truncate">
                        {step.description || step.action}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-400 uppercase font-medium">{step.action}</span>
                      {(step.started_at || live?.status === 'completed') && (
                        <span className="text-[10px] text-gray-400">
                          {formatElapsed(step.started_at, step.completed_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step Detail */}
        <div className="lg:col-span-2 card p-6">
          {selected ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">{actionIcons[selected.action]}</span>
                  <h2 className="font-semibold">
                    Step {selected.step_number}: {selected.description}
                  </h2>
                </div>
                <StatusBadge status={selectedLive?.status || selected.status} />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <span className="text-xs text-gray-500 block mb-1">Action</span>
                  <span className="text-sm font-medium uppercase flex items-center gap-1.5">
                    {actionIcons[selected.action]} {selected.action}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <span className="text-xs text-gray-500 block mb-1">Target</span>
                  <span className="text-sm font-medium truncate block">{selected.target || '-'}</span>
                </div>
                {selected.value && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <span className="text-xs text-gray-500 block mb-1">Value</span>
                    <span className="text-sm font-medium">{selected.value}</span>
                  </div>
                )}
                {selected.condition && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <span className="text-xs text-gray-500 block mb-1">Condition</span>
                    <span className="text-sm font-medium font-mono">{selected.condition}</span>
                  </div>
                )}
              </div>

              {/* Screenshot */}
              {selected.screenshot_b64 ? (
                <div className="border rounded-lg overflow-hidden mb-4">
                  <img
                    src={`data:image/png;base64,${selected.screenshot_b64}`}
                    alt="Step screenshot"
                    className="w-full"
                  />
                </div>
              ) : (
                <div className="border border-dashed rounded-lg h-48 flex flex-col items-center justify-center text-gray-300 mb-4 bg-gray-50/50">
                  <Monitor className="w-10 h-10 mb-2" />
                  <span className="text-sm">
                    {(selectedLive?.status || selected.status) === 'running'
                      ? 'Step executing...'
                      : (selectedLive?.status || selected.status) === 'pending'
                      ? 'Waiting to execute'
                      : 'No screenshot captured'}
                  </span>
                </div>
              )}

              {/* Result data */}
              {(selectedLive?.result_data || selected.result_data) && (() => {
                const raw = (selectedLive?.result_data as string) || selected.result_data || '{}';
                let parsed: Record<string, unknown> | null = null;
                try { parsed = JSON.parse(raw); } catch { /* raw */ }
                return (
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <h3 className="text-sm font-medium text-gray-600 mb-2">Result Data</h3>
                    {parsed ? (
                      <ResultRenderer data={parsed} action={selected.action} />
                    ) : (
                      <pre className="text-xs text-gray-700 overflow-auto max-h-48 font-mono bg-white rounded p-3 border">{raw}</pre>
                    )}
                  </div>
                );
              })()}

              {/* Error */}
              {(selectedLive?.error_message || selected.error_message) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-red-700 mb-1">Error</h3>
                  <p className="text-sm text-red-600">
                    {(selectedLive?.error_message as string) || selected.error_message}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-gray-400">
              <Monitor className="w-12 h-12 mb-3 text-gray-300" />
              <p>Select a step to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Live Execution Log */}
      {logEntries.length > 0 && (
        <div className="mt-6 card overflow-hidden">
          <button
            onClick={() => setLogOpen(!logOpen)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold">Execution Log</span>
              <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">
                {logEntries.length} events
              </span>
            </div>
            {logOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {logOpen && (
            <div ref={logRef} className="border-t border-gray-100 bg-gray-900 text-gray-300 p-4 max-h-48 overflow-y-auto font-mono text-xs space-y-1">
              {logEntries.map((entry, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-gray-500 flex-shrink-0">{entry.time}</span>
                  <span className={
                    entry.type === 'success' ? 'text-green-400' :
                    entry.type === 'error' ? 'text-red-400' :
                    entry.type === 'warning' ? 'text-yellow-400' :
                    'text-blue-400'
                  }>
                    {entry.type === 'success' ? '  OK' :
                     entry.type === 'error' ? 'FAIL' :
                     entry.type === 'warning' ? 'WARN' :
                     'INFO'}
                  </span>
                  <span>{entry.message}</span>
                </div>
              ))}
              {isLive && (
                <div className="flex gap-3 animate-pulse">
                  <span className="text-gray-500">{new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  <span className="text-blue-400">{'    '}</span>
                  <span className="text-gray-500">Waiting for events...</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error Recovery Dialog */}
      {failedStep && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <XCircle className="w-5 h-5 text-red-500" />
              <h3 className="text-lg font-semibold">Step Failed</h3>
            </div>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-medium">Step {failedStep.step_number}:</span> {failedStep.description}
            </p>
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 my-4">
              <p className="text-sm text-red-600 font-mono">{failedStep.error_message}</p>
            </div>
            {/* AI Fix suggestion */}
            {aiFix ? (
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 my-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <Brain className="w-3.5 h-3.5 text-purple-600" />
                  <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">AI Suggestion</span>
                </div>
                <p className="text-sm text-purple-900 dark:text-purple-200">{aiFix}</p>
              </div>
            ) : (
              <button
                onClick={handleAIFix}
                disabled={aiFixLoading}
                className="w-full my-3 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors disabled:opacity-50"
              >
                {aiFixLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                {aiFixLoading ? 'Analyzing...' : 'Get AI Fix Suggestion'}
              </button>
            )}

            <p className="text-xs text-gray-400 mb-4">Choose how to handle this failure:</p>
            <div className="flex gap-3">
              <button
                className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm"
                onClick={handleRetry}
              >
                <RotateCcw className="w-4 h-4" /> Retry
              </button>
              <button
                className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm"
                onClick={handleSkip}
              >
                <SkipForward className="w-4 h-4" /> Skip
              </button>
              <button
                className="btn-danger flex-1 flex items-center justify-center gap-2 text-sm"
                onClick={handleAbort}
              >
                <StopCircle className="w-4 h-4" /> Abort
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
