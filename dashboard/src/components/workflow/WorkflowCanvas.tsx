import { useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
  ConnectionLineType,
  type Node,
  type Edge,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Globe,
  MousePointerClick,
  Keyboard,
  Database,
  Timer,
  GitBranch,
  Play,
  Flag,
  Sparkles,
} from 'lucide-react';
import type { WorkflowStep } from '../../types/workflow';

/* ── Action config ────────────────────────────────────────── */

const ACTION_STYLE: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string; label: string }> = {
  navigate: { icon: <Globe className="w-4 h-4" />, color: '#3b82f6', bg: '#eff6ff', border: '#93c5fd', label: 'Navigate' },
  click:    { icon: <MousePointerClick className="w-4 h-4" />, color: '#f59e0b', bg: '#fffbeb', border: '#fcd34d', label: 'Click' },
  type:     { icon: <Keyboard className="w-4 h-4" />, color: '#22c55e', bg: '#f0fdf4', border: '#86efac', label: 'Type' },
  extract:  { icon: <Database className="w-4 h-4" />, color: '#a855f7', bg: '#faf5ff', border: '#c4b5fd', label: 'Extract' },
  wait:     { icon: <Timer className="w-4 h-4" />, color: '#6b7280', bg: '#f9fafb', border: '#d1d5db', label: 'Wait' },
  conditional: { icon: <GitBranch className="w-4 h-4" />, color: '#f43f5e', bg: '#fff1f2', border: '#fda4af', label: 'Condition' },
};

/* ── Run step status → node styling ──────────────────────── */

interface RunStepStatus {
  step_number: number;
  status: string;
  healed?: boolean;
}

function statusBorder(status?: string) {
  switch (status) {
    case 'running':   return { borderColor: '#3b82f6', boxShadow: '0 0 12px rgba(59,130,246,0.4)' };
    case 'completed': return { borderColor: '#22c55e', boxShadow: '0 0 8px rgba(34,197,94,0.3)' };
    case 'failed':    return { borderColor: '#ef4444', boxShadow: '0 0 8px rgba(239,68,68,0.3)' };
    case 'skipped':   return { borderColor: '#eab308', boxShadow: '0 0 6px rgba(234,179,8,0.2)' };
    default:          return {};
  }
}

function statusDot(status?: string) {
  const base = 'w-2.5 h-2.5 rounded-full absolute -top-1 -right-1 border-2 border-white';
  switch (status) {
    case 'running':   return <div className={`${base} bg-blue-500 animate-pulse`} />;
    case 'completed': return <div className={`${base} bg-green-500`} />;
    case 'failed':    return <div className={`${base} bg-red-500`} />;
    case 'skipped':   return <div className={`${base} bg-yellow-500`} />;
    default:          return null;
  }
}

/* ── Custom nodes ─────────────────────────────────────────── */

function ActionNode({ data, selected }: { data: Record<string, unknown>; selected: boolean }) {
  const step = data.step as WorkflowStep;
  const runStatus = data.runStatus as string | undefined;
  const healed = data.healed as boolean | undefined;
  const cfg = ACTION_STYLE[step.action] || ACTION_STYLE.navigate;

  return (
    <div
      className={`relative bg-white rounded-xl shadow-md border-2 transition-all duration-200 min-w-[240px] max-w-[300px] ${
        selected ? 'shadow-xl scale-[1.02]' : 'hover:shadow-lg'
      } ${runStatus === 'running' ? 'animate-pulse' : ''}`}
      style={{
        borderColor: selected ? cfg.color : (statusBorder(runStatus).borderColor || cfg.border),
        ...statusBorder(runStatus),
      }}
    >
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-gray-300 !border-2 !border-white" />

      {/* Color bar */}
      <div className="h-1.5 rounded-t-[10px]" style={{ backgroundColor: cfg.color }} />

      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center relative"
            style={{ backgroundColor: cfg.bg, color: cfg.color }}
          >
            {cfg.icon}
            {statusDot(runStatus)}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
          {healed && (
            <span className="ml-auto flex items-center gap-0.5 text-[9px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">
              <Sparkles className="w-3 h-3" /> HEALED
            </span>
          )}
          <span className="text-[10px] text-gray-400 font-mono ml-auto">#{step.step_number}</span>
        </div>
        <p className="text-sm font-medium text-gray-800 truncate">{step.description || 'Untitled step'}</p>
        {step.target && (
          <p className="text-[11px] text-gray-400 truncate font-mono mt-1">{step.target}</p>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-gray-300 !border-2 !border-white" />
    </div>
  );
}

function ConditionalNode({ data, selected }: { data: Record<string, unknown>; selected: boolean }) {
  const step = data.step as WorkflowStep;
  const runStatus = data.runStatus as string | undefined;

  return (
    <div
      className={`relative bg-white rounded-xl shadow-md border-2 transition-all duration-200 min-w-[240px] max-w-[300px] ${
        selected ? 'shadow-xl scale-[1.02]' : 'hover:shadow-lg'
      } ${runStatus === 'running' ? 'animate-pulse' : ''}`}
      style={{
        borderColor: selected ? '#f43f5e' : (statusBorder(runStatus).borderColor || '#fda4af'),
        ...statusBorder(runStatus),
      }}
    >
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-gray-300 !border-2 !border-white" />

      <div className="h-1.5 rounded-t-[10px] bg-gradient-to-r from-rose-400 to-rose-600" />

      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-rose-50 text-rose-500 relative">
            <GitBranch className="w-4 h-4" />
            {statusDot(runStatus)}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Condition</span>
          <span className="text-[10px] text-gray-400 font-mono ml-auto">#{step.step_number}</span>
        </div>
        <p className="text-sm font-medium text-gray-800 truncate">{step.description || 'Condition check'}</p>
        {step.condition && (
          <div className="mt-2 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-100">
            <code className="text-[11px] text-rose-600 font-mono">if: {step.condition}</code>
          </div>
        )}
      </div>

      <div className="flex justify-between px-8 pb-2">
        <span className="text-[9px] font-bold text-green-600 uppercase tracking-wider">True</span>
        <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider">False</span>
      </div>

      <Handle type="source" position={Position.Bottom} id="true" className="!w-3 !h-3 !bg-green-400 !border-2 !border-white" style={{ left: '30%' }} />
      <Handle type="source" position={Position.Bottom} id="false" className="!w-3 !h-3 !bg-red-400 !border-2 !border-white" style={{ left: '70%' }} />
    </div>
  );
}

function StartNode() {
  return (
    <div className="flex flex-col items-center">
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-200/50 ring-4 ring-green-100">
        <Play className="w-6 h-6 text-white ml-0.5" />
      </div>
      <span className="text-[10px] font-bold text-green-600 mt-2 uppercase tracking-widest">Start</span>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-green-400 !border-2 !border-white" />
    </div>
  );
}

function EndNode() {
  return (
    <div className="flex flex-col items-center">
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-red-300 !border-2 !border-white" />
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-400 to-rose-600 flex items-center justify-center shadow-lg shadow-red-200/50 ring-4 ring-red-100">
        <Flag className="w-5 h-5 text-white" />
      </div>
      <span className="text-[10px] font-bold text-red-500 mt-2 uppercase tracking-widest">End</span>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  action: ActionNode,
  conditional: ConditionalNode,
  start: StartNode,
  end: EndNode,
};

/* ── Steps → React Flow conversion ───────────────────────── */

function stepsToFlow(
  steps: WorkflowStep[],
  runSteps?: RunStepStatus[],
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const cx = 250;
  const yGap = 150;

  const statusMap = new Map<number, RunStepStatus>();
  runSteps?.forEach((rs) => statusMap.set(rs.step_number, rs));

  // Start
  nodes.push({
    id: 'start',
    type: 'start',
    position: { x: cx, y: 0 },
    data: {},
    draggable: false,
    selectable: false,
  });

  // Steps
  steps.forEach((step, i) => {
    const rs = statusMap.get(step.step_number);
    nodes.push({
      id: `step-${step.step_number}`,
      type: step.action === 'conditional' ? 'conditional' : 'action',
      position: { x: cx - 120, y: 90 + i * yGap },
      data: {
        step,
        runStatus: rs?.status,
        healed: rs?.healed,
      },
    });

    const prevId = i === 0 ? 'start' : `step-${steps[i - 1].step_number}`;
    const srcHandle = steps[i - 1]?.action === 'conditional' ? 'true' : undefined;

    const isAnimated = rs?.status === 'running' || statusMap.get(steps[i - 1]?.step_number)?.status === 'running';

    edges.push({
      id: `e-${prevId}-step-${step.step_number}`,
      source: prevId,
      target: `step-${step.step_number}`,
      sourceHandle: srcHandle,
      type: 'smoothstep',
      animated: isAnimated,
      style: {
        stroke: isAnimated ? '#6366f1' : srcHandle === 'true' ? '#22c55e' : '#94a3b8',
        strokeWidth: isAnimated ? 2.5 : 2,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isAnimated ? '#6366f1' : srcHandle === 'true' ? '#22c55e' : '#94a3b8',
        width: 14,
        height: 14,
      },
    });

    // Add "false" branch edge from conditional → step after next (skip edge)
    if (step.action === 'conditional' && i + 2 < steps.length) {
      const skipTargetId = `step-${steps[i + 2].step_number}`;
      edges.push({
        id: `e-false-${step.step_number}-${steps[i + 2].step_number}`,
        source: `step-${step.step_number}`,
        target: skipTargetId,
        sourceHandle: 'false',
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#f87171', strokeWidth: 1.5, strokeDasharray: '6 3' },
        label: 'skip',
        labelStyle: { fontSize: 9, fill: '#f87171', fontWeight: 600 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#f87171', width: 12, height: 12 },
      });
    }
    // If conditional is last-1 step, false branch → end
    if (step.action === 'conditional' && i + 2 >= steps.length && i + 1 < steps.length) {
      edges.push({
        id: `e-false-${step.step_number}-end`,
        source: `step-${step.step_number}`,
        target: 'end',
        sourceHandle: 'false',
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#f87171', strokeWidth: 1.5, strokeDasharray: '6 3' },
        label: 'skip',
        labelStyle: { fontSize: 9, fill: '#f87171', fontWeight: 600 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#f87171', width: 12, height: 12 },
      });
    }
  });

  // End
  const lastId = steps.length > 0 ? `step-${steps[steps.length - 1].step_number}` : 'start';
  nodes.push({
    id: 'end',
    type: 'end',
    position: { x: cx, y: 90 + steps.length * yGap },
    data: {},
    draggable: false,
    selectable: false,
  });
  edges.push({
    id: `e-${lastId}-end`,
    source: lastId,
    target: 'end',
    sourceHandle: steps[steps.length - 1]?.action === 'conditional' ? 'true' : undefined,
    type: 'smoothstep',
    style: { stroke: '#94a3b8', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8', width: 14, height: 14 },
  });

  return { nodes, edges };
}

/* ── Main component ──────────────────────────────────────── */

interface WorkflowCanvasProps {
  steps: WorkflowStep[];
  onChange?: (steps: WorkflowStep[]) => void;
  readOnly?: boolean;
  className?: string;
  height?: string;
  runSteps?: RunStepStatus[];
}

export default function WorkflowCanvas({
  steps,
  onChange,
  readOnly = false,
  className = '',
  height = '500px',
  runSteps,
}: WorkflowCanvasProps) {
  const { nodes: init, edges: initEdges } = useMemo(
    () => stepsToFlow(steps, runSteps),
    [steps, runSteps],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(init);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);

  useEffect(() => {
    const { nodes: n, edges: e } = stepsToFlow(steps, runSteps);
    setNodes(n);
    setEdges(e);
  }, [steps, runSteps, setNodes, setEdges]);

  return (
    <div
      className={`bg-gradient-to-br from-gray-50 to-slate-100 rounded-xl border border-gray-200 overflow-hidden ${className}`}
      style={{ height }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onEdgesChange={readOnly ? undefined : onEdgesChange}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        fitViewOptions={{ padding: 0.4 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={!readOnly}
        nodesConnectable={false}
        elementsSelectable={!readOnly}
      >
        <Background color="#cbd5e1" gap={24} size={1} />
        <Controls
          showInteractive={false}
          className="!bg-white !rounded-xl !shadow-lg !border-0"
        />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'start') return '#22c55e';
            if (node.type === 'end') return '#ef4444';
            const step = node.data?.step as WorkflowStep | undefined;
            return step ? (ACTION_STYLE[step.action]?.color || '#6b7280') : '#e5e7eb';
          }}
          className="!bg-white/90 !rounded-xl !shadow-lg !border-0"
          maskColor="rgba(0,0,0,0.08)"
        />

        {/* Add node toolbar (edit mode) */}
        {!readOnly && onChange && (
          <Panel position="top-right">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 p-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Add Step</p>
              <div className="flex flex-col gap-1.5">
                {Object.entries(ACTION_STYLE).map(([action, cfg]) => (
                  <button
                    key={action}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:scale-[1.02] hover:shadow-sm"
                    style={{ backgroundColor: cfg.bg, color: cfg.color }}
                    onClick={() => {
                      const newStep: WorkflowStep = {
                        step_number: steps.length + 1,
                        action,
                        target: '',
                        description: `New ${cfg.label} step`,
                      };
                      onChange([...steps, newStep]);
                    }}
                  >
                    {cfg.icon}
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>
          </Panel>
        )}

        {/* Step count badge */}
        <Panel position="top-left">
          <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-gray-100 px-3 py-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary-500" />
            <span className="text-xs font-medium text-gray-600">
              {steps.length} step{steps.length !== 1 ? 's' : ''}
            </span>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
