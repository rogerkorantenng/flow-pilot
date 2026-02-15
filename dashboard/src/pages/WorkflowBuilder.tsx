import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Trash2,
  Plus,
  Loader2,
  Zap,
  Save,
  Globe,
  MousePointerClick,
  Keyboard,
  Database,
  Timer,
  GitBranch,
  ArrowLeft,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Variable,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getWorkflow, createWorkflow, updateWorkflow, planWorkflow } from '../services/api';
import type { WorkflowStep, WorkflowVariable } from '../types/workflow';

const ACTIONS = ['navigate', 'click', 'type', 'extract', 'wait', 'conditional'];

const actionConfig: Record<string, { icon: React.ReactNode; color: string; label: string; placeholder: string }> = {
  navigate: { icon: <Globe className="w-4 h-4" />, color: 'text-blue-500 bg-blue-50', label: 'Navigate', placeholder: 'https://example.com' },
  click: { icon: <MousePointerClick className="w-4 h-4" />, color: 'text-amber-500 bg-amber-50', label: 'Click', placeholder: 'button.submit, #login-btn' },
  type: { icon: <Keyboard className="w-4 h-4" />, color: 'text-green-500 bg-green-50', label: 'Type', placeholder: 'input#email, .search-field' },
  extract: { icon: <Database className="w-4 h-4" />, color: 'text-purple-500 bg-purple-50', label: 'Extract', placeholder: '.price, table.results' },
  wait: { icon: <Timer className="w-4 h-4" />, color: 'text-gray-500 bg-gray-50', label: 'Wait', placeholder: '2000 (ms)' },
  conditional: { icon: <GitBranch className="w-4 h-4" />, color: 'text-rose-500 bg-rose-50', label: 'Condition', placeholder: 'element.exists(.error)' },
};

const CRON_PRESETS = [
  { label: 'Every hour', value: '0 * * * *', desc: 'Runs at the start of every hour' },
  { label: 'Daily at 9 AM', value: '0 9 * * *', desc: 'Runs every day at 9:00 AM' },
  { label: 'Every 6 hours', value: '0 */6 * * *', desc: 'Runs at 12am, 6am, 12pm, 6pm' },
  { label: 'Weekly (Mon 9 AM)', value: '0 9 * * 1', desc: 'Runs every Monday at 9:00 AM' },
  { label: 'Custom', value: 'custom', desc: 'Enter a custom cron expression' },
];

const EXAMPLE_PROMPTS = [
  'Check the top 5 stories on Hacker News and extract titles and URLs',
  'Go to Amazon, search for "wireless headphones", and extract the top 3 results with prices',
  'Log into my CRM, go to leads page, and extract all new leads from today',
  'Monitor competitor website for price changes on key products',
];

function SortableStep({
  step,
  index,
  expanded,
  onToggle,
  onUpdate,
  onRemove,
}: {
  step: WorkflowStep;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (index: number, field: string, value: string) => void;
  onRemove: (index: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: step.step_number.toString(),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const config = actionConfig[step.action] || actionConfig.navigate;

  return (
    <div ref={setNodeRef} style={style} className="card overflow-hidden">
      {/* Step Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <button
          {...attributes}
          {...listeners}
          className="text-gray-300 hover:text-gray-500 cursor-grab"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <span className="text-xs text-gray-400 font-mono w-6">#{step.step_number}</span>

        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.color}`}>
          {config.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{step.description || config.label}</span>
          </div>
          {step.target && (
            <p className="text-xs text-gray-400 truncate">{step.target}</p>
          )}
        </div>

        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${config.color}`}>
          {step.action}
        </span>

        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}

        <button
          className="text-gray-300 hover:text-red-500 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(index);
          }}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Expanded Editor */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Action Type</label>
              <div className="grid grid-cols-3 gap-1.5">
                {ACTIONS.map((a) => {
                  const ac = actionConfig[a];
                  return (
                    <button
                      key={a}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        step.action === a
                          ? `${ac.color} ring-1 ring-current`
                          : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'
                      }`}
                      onClick={() => onUpdate(index, 'action', a)}
                    >
                      {ac.icon}
                      {ac.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
              <input
                className="input text-sm"
                placeholder="What this step does..."
                value={step.description}
                onChange={(e) => onUpdate(index, 'description', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Target</label>
              <input
                className="input text-sm font-mono"
                placeholder={config.placeholder}
                value={step.target}
                onChange={(e) => onUpdate(index, 'target', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {step.action === 'type' ? 'Text to type' : step.action === 'wait' ? 'Wait time (ms)' : 'Value'}
              </label>
              <input
                className="input text-sm"
                placeholder={step.action === 'type' ? 'Text to enter...' : step.action === 'wait' ? '2000' : 'Optional...'}
                value={step.value || ''}
                onChange={(e) => onUpdate(index, 'value', e.target.value)}
              />
            </div>

            {step.action === 'conditional' && (
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Condition Expression</label>
                <input
                  className="input text-sm font-mono"
                  placeholder="e.g., result.price < 100"
                  value={step.condition || ''}
                  onChange={(e) => onUpdate(index, 'condition', e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function VariableRow({
  name,
  variable,
  onUpdate,
  onRemove,
}: {
  name: string;
  variable: WorkflowVariable;
  onUpdate: (key: string, val: WorkflowVariable) => void;
  onRemove: () => void;
}) {
  const [showValue, setShowValue] = useState(!variable.secret);

  return (
    <div className="flex items-center gap-2 mb-2">
      <input
        className="input text-sm font-mono w-40"
        value={name}
        placeholder="name"
        onChange={(e) => onUpdate(e.target.value, variable)}
      />
      <span className="text-gray-400">=</span>
      <div className="relative flex-1">
        <input
          className="input text-sm font-mono pr-8"
          type={variable.secret && !showValue ? 'password' : 'text'}
          value={variable.value}
          placeholder="value"
          onChange={(e) => onUpdate(name, { ...variable, value: e.target.value })}
        />
        {variable.secret && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            onClick={() => setShowValue(!showValue)}
          >
            {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      <button
        className={`p-2 rounded-lg text-xs font-medium transition-all ${
          variable.secret
            ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
            : 'bg-gray-50 dark:bg-gray-800 text-gray-400'
        }`}
        title={variable.secret ? 'Secret (masked)' : 'Click to mark as secret'}
        onClick={() => onUpdate(name, { ...variable, secret: !variable.secret })}
      >
        <Lock className="w-4 h-4" />
      </button>
      <button
        className="p-2 text-gray-300 hover:text-red-500 transition-colors"
        onClick={onRemove}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function WorkflowBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [triggerType, setTriggerType] = useState('manual');
  const [cronPreset, setCronPreset] = useState('0 9 * * *');
  const [customCron, setCustomCron] = useState('');
  const [variables, setVariables] = useState<Record<string, WorkflowVariable>>({});
  const [showVars, setShowVars] = useState(false);
  const [nlInput, setNlInput] = useState('');
  const [planning, setPlanning] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { data: existing } = useQuery({
    queryKey: ['workflow', id],
    queryFn: () => getWorkflow(id!),
    enabled: isEditing,
  });

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setDescription(existing.description || '');
      setTriggerType(existing.trigger_type);
      if (existing.schedule_cron) {
        const preset = CRON_PRESETS.find((p) => p.value === existing.schedule_cron);
        setCronPreset(preset ? preset.value : 'custom');
        setCustomCron(existing.schedule_cron);
      }
      if (existing.variables_json) {
        try {
          setVariables(JSON.parse(existing.variables_json));
        } catch {
          // ignore
        }
      }
      if (existing.steps_json) {
        try {
          setSteps(JSON.parse(existing.steps_json));
        } catch {
          // ignore
        }
      }
    }
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const cron = triggerType === 'scheduled'
        ? (cronPreset === 'custom' ? customCron : cronPreset)
        : undefined;
      const varsJson = Object.keys(variables).length > 0 ? JSON.stringify(variables) : undefined;
      const data = {
        name,
        description,
        steps_json: JSON.stringify(steps),
        variables_json: varsJson,
        trigger_type: triggerType,
        schedule_cron: cron,
      };
      if (isEditing) {
        return updateWorkflow(id!, data);
      }
      return createWorkflow(data);
    },
    onSuccess: (workflow) => {
      toast.success(isEditing ? 'Workflow updated' : 'Workflow created');
      navigate(`/workflows/${workflow.id}`);
    },
    onError: () => toast.error('Failed to save workflow'),
  });

  const handleGenerate = async () => {
    if (!nlInput.trim()) return;
    setPlanning(true);
    try {
      const { steps: planned } = await planWorkflow(nlInput);
      setSteps(planned as unknown as WorkflowStep[]);
      if (!name) setName(nlInput.slice(0, 60));
      if (!description) setDescription(nlInput);
      setExpandedStep(0);
      toast.success(`Generated ${planned.length} steps`);
    } catch {
      toast.error('Failed to generate steps');
    } finally {
      setPlanning(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSteps((items) => {
        const oldIndex = items.findIndex((i) => i.step_number.toString() === active.id);
        const newIndex = items.findIndex((i) => i.step_number.toString() === over.id);
        const reordered = arrayMove(items, oldIndex, newIndex);
        return reordered.map((s, i) => ({ ...s, step_number: i + 1 }));
      });
    }
  };

  const updateStep = (index: number, field: string, value: string) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const removeStep = (index: number) => {
    setSteps((prev) =>
      prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_number: i + 1 }))
    );
    if (expandedStep === index) setExpandedStep(null);
  };

  const addStep = () => {
    const newStep: WorkflowStep = {
      step_number: steps.length + 1,
      action: 'navigate',
      target: '',
      description: '',
    };
    setSteps((prev) => [...prev, newStep]);
    setExpandedStep(steps.length);
  };

  const canSave = name.trim() && steps.length > 0;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {isEditing ? 'Edit Workflow' : 'New Workflow'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isEditing ? 'Modify steps and settings' : 'Describe your workflow or build it step by step'}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-sm" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !canSave}
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isEditing ? 'Update' : 'Create'} Workflow
          </button>
        </div>
      </div>

      {/* AI Generator */}
      <div className="card p-6 mb-6 bg-gradient-to-r from-primary-50 to-indigo-50 border-primary-100">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-primary-600" />
          <h2 className="font-semibold text-primary-900">AI Step Generator</h2>
        </div>
        <p className="text-sm text-primary-700 mb-3">
          Describe what you want to automate in plain English. The AI will generate structured steps.
        </p>
        <textarea
          className="input flex-1 min-h-[80px] bg-white mb-3"
          placeholder="e.g., Every morning, check the top 5 stories on Hacker News, summarize them, and save to a Google Sheet..."
          value={nlInput}
          onChange={(e) => setNlInput(e.target.value)}
        />
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                className="text-[11px] px-2.5 py-1 rounded-full bg-white text-primary-600 border border-primary-200 hover:bg-primary-50 transition-colors truncate max-w-[200px]"
                onClick={() => setNlInput(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
          <button
            className="btn-primary flex items-center gap-2 ml-3 flex-shrink-0"
            onClick={handleGenerate}
            disabled={planning || !nlInput.trim()}
          >
            {planning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {planning ? 'Generating...' : 'Generate Steps'}
          </button>
        </div>
      </div>

      {/* Workflow Settings */}
      <div className="card p-6 mb-6">
        <h2 className="font-semibold mb-4">Workflow Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Workflow Name *</label>
            <input
              className="input"
              placeholder="e.g., Daily Price Monitor"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Trigger Type</label>
            <div className="flex gap-2">
              <button
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                  triggerType === 'manual'
                    ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-200'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
                onClick={() => setTriggerType('manual')}
              >
                <Zap className="w-4 h-4" /> Manual
              </button>
              <button
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                  triggerType === 'scheduled'
                    ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-200'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
                onClick={() => setTriggerType('scheduled')}
              >
                <Clock className="w-4 h-4" /> Scheduled
              </button>
            </div>
          </div>
        </div>

        {triggerType === 'scheduled' && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <label className="block text-xs font-medium text-gray-500 mb-2">Schedule</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
              {CRON_PRESETS.map((p) => (
                <button
                  key={p.value}
                  className={`text-left px-3 py-2 rounded-lg text-sm transition-all ${
                    cronPreset === p.value
                      ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-200'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                  onClick={() => setCronPreset(p.value)}
                >
                  <span className="font-medium block">{p.label}</span>
                  <span className="text-xs text-gray-400">{p.desc}</span>
                </button>
              ))}
            </div>
            {cronPreset === 'custom' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Cron Expression
                </label>
                <input
                  className="input font-mono text-sm"
                  placeholder="* * * * * (min hour day month weekday)"
                  value={customCron}
                  onChange={(e) => setCustomCron(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
          <textarea
            className="input min-h-[60px]"
            placeholder="What does this workflow do? (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>

      {/* Variables */}
      <div className="card mb-6 overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          onClick={() => setShowVars(!showVars)}
        >
          <div className="flex items-center gap-2">
            <Variable className="w-5 h-5 text-primary-600" />
            <h2 className="font-semibold">Variables & Secrets</h2>
            {Object.keys(variables).length > 0 && (
              <span className="text-xs bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full">
                {Object.keys(variables).length}
              </span>
            )}
          </div>
          {showVars ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {showVars && (
          <div className="px-6 pb-5 border-t border-gray-100 dark:border-gray-800 pt-4">
            <p className="text-xs text-gray-500 mb-3">
              Define variables referenced in steps as <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{'{{variable_name}}'}</code>. Secret values are masked in the UI.
            </p>

            {Object.entries(variables).map(([key, v]) => (
              <VariableRow
                key={key}
                name={key}
                variable={v}
                onUpdate={(newKey, newVal) => {
                  setVariables((prev) => {
                    const updated = { ...prev };
                    if (newKey !== key) delete updated[key];
                    updated[newKey] = newVal;
                    return updated;
                  });
                }}
                onRemove={() => {
                  setVariables((prev) => {
                    const updated = { ...prev };
                    delete updated[key];
                    return updated;
                  });
                }}
              />
            ))}

            <button
              className="btn-secondary text-sm flex items-center gap-1.5 mt-2"
              onClick={() => {
                const name = `var_${Object.keys(variables).length + 1}`;
                setVariables((prev) => ({ ...prev, [name]: { value: '', secret: false } }));
              }}
            >
              <Plus className="w-4 h-4" /> Add Variable
            </button>
          </div>
        )}
      </div>

      {/* Steps Editor */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Steps ({steps.length})</h2>
            <p className="text-xs text-gray-400 mt-0.5">Drag to reorder. Click to expand and edit.</p>
          </div>
          <button className="btn-secondary text-sm flex items-center gap-1.5" onClick={addStep}>
            <Plus className="w-4 h-4" /> Add Step
          </button>
        </div>

        {steps.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={steps.map((s) => s.step_number.toString())}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {steps.map((step, index) => (
                  <SortableStep
                    key={step.step_number}
                    step={step}
                    index={index}
                    expanded={expandedStep === index}
                    onToggle={() => setExpandedStep(expandedStep === index ? null : index)}
                    onUpdate={updateStep}
                    onRemove={removeStep}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="card p-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="font-medium text-gray-600 mb-1">No steps yet</h3>
            <p className="text-sm text-gray-400 mb-4">
              Use the AI generator above or add steps manually.
            </p>
            <button className="btn-secondary text-sm inline-flex items-center gap-1.5" onClick={addStep}>
              <Plus className="w-4 h-4" /> Add Your First Step
            </button>
          </div>
        )}
      </div>

      {/* Validation Warning */}
      {!canSave && (name.trim() || steps.length > 0) && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 text-amber-700 text-sm mb-6">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>
            {!name.trim() ? 'Please enter a workflow name.' : 'Add at least one step to save.'}
          </span>
        </div>
      )}

      {/* Bottom Save Bar */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 -mx-8 px-8 py-4 flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {steps.length} step{steps.length !== 1 ? 's' : ''} configured
        </p>
        <div className="flex gap-3">
          <button className="btn-secondary" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !canSave}
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isEditing ? 'Update' : 'Create'} Workflow
          </button>
        </div>
      </div>
    </div>
  );
}
