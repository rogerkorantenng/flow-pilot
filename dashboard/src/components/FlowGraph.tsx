import {
  Globe,
  MousePointerClick,
  Keyboard,
  Database,
  Timer,
  GitBranch,
  Zap,
} from 'lucide-react';
import type { WorkflowStep } from '../types/workflow';

const actionConfig: Record<string, { icon: React.ReactNode; bg: string; border: string; text: string }> = {
  navigate: { icon: <Globe className="w-4 h-4" />, bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-300 dark:border-blue-700', text: 'text-blue-600 dark:text-blue-400' },
  click: { icon: <MousePointerClick className="w-4 h-4" />, bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-300 dark:border-amber-700', text: 'text-amber-600 dark:text-amber-400' },
  type: { icon: <Keyboard className="w-4 h-4" />, bg: 'bg-green-50 dark:bg-green-900/30', border: 'border-green-300 dark:border-green-700', text: 'text-green-600 dark:text-green-400' },
  extract: { icon: <Database className="w-4 h-4" />, bg: 'bg-purple-50 dark:bg-purple-900/30', border: 'border-purple-300 dark:border-purple-700', text: 'text-purple-600 dark:text-purple-400' },
  wait: { icon: <Timer className="w-4 h-4" />, bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-300 dark:border-gray-600', text: 'text-gray-500 dark:text-gray-400' },
  conditional: { icon: <GitBranch className="w-4 h-4" />, bg: 'bg-rose-50 dark:bg-rose-900/30', border: 'border-rose-300 dark:border-rose-700', text: 'text-rose-600 dark:text-rose-400' },
};

export default function FlowGraph({ steps }: { steps: WorkflowStep[] }) {
  if (steps.length === 0) return null;

  return (
    <div className="card p-6 mb-6">
      <h2 className="font-semibold mb-4">Visual Flow</h2>
      <div className="flex items-center overflow-x-auto pb-2 gap-0">
        {/* Start node */}
        <div className="flex items-center flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 border-2 border-green-400 dark:border-green-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
        </div>

        {steps.map((step, i) => {
          const config = actionConfig[step.action] || actionConfig.navigate;
          const isConditional = step.action === 'conditional';

          return (
            <div key={i} className="flex items-center flex-shrink-0">
              {/* Connector arrow */}
              <div className="flex items-center">
                <div className="w-8 h-0.5 bg-gray-300 dark:bg-gray-600" />
                <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[6px] border-l-gray-300 dark:border-l-gray-600" />
              </div>

              {/* Node */}
              {isConditional ? (
                <div className="group relative">
                  <div className={`w-16 h-16 rotate-45 rounded-lg border-2 ${config.border} ${config.bg} flex items-center justify-center`}>
                    <div className="-rotate-45">
                      {config.icon}
                    </div>
                  </div>
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                      <span className="font-medium">#{step.step_number}</span> {step.description || step.action}
                      {step.condition && <div className="text-gray-300 mt-0.5">if: {step.condition}</div>}
                    </div>
                    <div className="w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45 mx-auto -mt-1" />
                  </div>
                </div>
              ) : (
                <div className="group relative">
                  <div className={`w-16 h-12 rounded-xl border-2 ${config.border} ${config.bg} flex flex-col items-center justify-center gap-0.5`}>
                    <div className={config.text}>{config.icon}</div>
                    <span className={`text-[9px] font-semibold uppercase ${config.text}`}>{step.action}</span>
                  </div>
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg max-w-[200px]">
                      <span className="font-medium">#{step.step_number}</span> {step.description || step.action}
                      {step.target && <div className="text-gray-300 mt-0.5 truncate">{step.target}</div>}
                    </div>
                    <div className="w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45 mx-auto -mt-1" />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* End node */}
        <div className="flex items-center flex-shrink-0">
          <div className="flex items-center">
            <div className="w-8 h-0.5 bg-gray-300 dark:bg-gray-600" />
            <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[6px] border-l-gray-300 dark:border-l-gray-600" />
          </div>
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 border-2 border-red-400 dark:border-red-600 flex items-center justify-center">
            <div className="w-3 h-3 rounded-sm bg-red-500 dark:bg-red-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
