import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Receipt,
  Users,
  Megaphone,
  TrendingUp,
  Newspaper,
  Loader2,
  Workflow,
  Star,
  ArrowRight,
  Search,
  Globe,
  MousePointerClick,
  Keyboard,
  Database,
  Timer,
  GitBranch,
  Sparkles,
  Crown,
  Flame,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { listTemplates, useTemplate } from '../services/api';

const categoryIcons: Record<string, React.ElementType> = {
  finance: Receipt,
  sales: Users,
  marketing: Megaphone,
  monitoring: TrendingUp,
  research: Newspaper,
  general: Workflow,
};

const categoryColors: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  finance: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200', badge: 'bg-green-100 text-green-700' },
  sales: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
  marketing: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700' },
  monitoring: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
  research: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', badge: 'bg-rose-100 text-rose-700' },
  general: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-700' },
};

const actionIcons: Record<string, React.ReactNode> = {
  navigate: <Globe className="w-3 h-3" />,
  click: <MousePointerClick className="w-3 h-3" />,
  type: <Keyboard className="w-3 h-3" />,
  extract: <Database className="w-3 h-3" />,
  wait: <Timer className="w-3 h-3" />,
  conditional: <GitBranch className="w-3 h-3" />,
};

const CATEGORIES = ['all', 'finance', 'sales', 'marketing', 'monitoring', 'research', 'general'];

interface ParsedStep {
  action: string;
  description?: string;
}

function parseSteps(stepsJson: string): ParsedStep[] {
  try {
    return JSON.parse(stepsJson);
  } catch {
    return [];
  }
}

export default function Templates() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates', activeCategory],
    queryFn: () => listTemplates(activeCategory === 'all' ? undefined : activeCategory),
  });

  const useTemplateMutation = useMutation({
    mutationFn: useTemplate,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success('Workflow created from template');
      navigate(`/workflows/${data.id}`);
    },
    onError: () => toast.error('Failed to use template'),
  });

  const filtered = templates.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q);
  });

  const trending = [...templates].sort((a, b) => b.popularity - a.popularity).slice(0, 3);
  const hasTrending = activeCategory === 'all' && !search && trending.length > 0 && trending[0].popularity > 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Workflow Marketplace</h1>
            <p className="text-gray-500 text-sm">
              {templates.length} template{templates.length !== 1 ? 's' : ''} available — start automating in seconds
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="Search templates by name or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {CATEGORIES.map((cat) => {
          const Icon = categoryIcons[cat] || Workflow;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium capitalize whitespace-nowrap transition-colors ${
                activeCategory === cat
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat !== 'all' && <Icon className="w-3.5 h-3.5" />}
              {cat}
            </button>
          );
        })}
      </div>

      {/* Trending Section */}
      {hasTrending && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-5 h-5 text-orange-500" />
            <h2 className="font-semibold text-gray-800">Trending Templates</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {trending.map((template, rank) => {
              const Icon = categoryIcons[template.category] || Workflow;
              const colors = categoryColors[template.category] || categoryColors.general;
              const steps = parseSteps(template.steps_json);

              return (
                <div
                  key={template.id}
                  className={`card p-5 hover:shadow-lg transition-all group relative overflow-hidden border-2 ${colors.border}`}
                >
                  {rank === 0 && (
                    <div className="absolute top-3 right-3">
                      <Crown className="w-5 h-5 text-amber-400" />
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colors.bg} ${colors.text}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{template.name}</h3>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${colors.badge}`}>
                          {template.category}
                        </span>
                        <div className="flex items-center gap-0.5 text-xs text-amber-500">
                          <Star className="w-3 h-3 fill-current" />
                          {template.popularity} uses
                        </div>
                      </div>
                    </div>
                  </div>

                  {template.description && (
                    <p className="text-sm text-gray-500 mb-3 line-clamp-2">{template.description}</p>
                  )}

                  {/* Step preview chips */}
                  {steps.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {steps.slice(0, 4).map((s, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-50 text-[10px] text-gray-500 font-medium"
                        >
                          {actionIcons[s.action]} {s.action}
                        </span>
                      ))}
                      {steps.length > 4 && (
                        <span className="px-1.5 py-0.5 rounded bg-gray-50 text-[10px] text-gray-400">
                          +{steps.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  <button
                    className="w-full btn-primary flex items-center justify-center gap-2 text-sm"
                    onClick={() => useTemplateMutation.mutate(template.id)}
                    disabled={useTemplateMutation.isPending}
                  >
                    {useTemplateMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5" />
                    )}
                    Use Template
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All Templates Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600 mb-3" />
          <p className="text-sm text-gray-500">Loading templates...</p>
        </div>
      ) : filtered.length > 0 ? (
        <>
          {hasTrending && (
            <div className="flex items-center gap-2 mb-4">
              <Workflow className="w-5 h-5 text-gray-400" />
              <h2 className="font-semibold text-gray-800">All Templates</h2>
              <span className="text-xs text-gray-400">{filtered.length} templates</span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((template) => {
              const Icon = categoryIcons[template.category] || Workflow;
              const colors = categoryColors[template.category] || categoryColors.general;
              const steps = parseSteps(template.steps_json);

              return (
                <div key={template.id} className="card hover:shadow-md transition-all group overflow-hidden">
                  {/* Color bar */}
                  <div className={`h-1 ${colors.bg}`} style={{
                    background: `linear-gradient(90deg, ${
                      template.category === 'finance' ? '#22c55e' :
                      template.category === 'sales' ? '#3b82f6' :
                      template.category === 'marketing' ? '#a855f7' :
                      template.category === 'monitoring' ? '#f59e0b' :
                      template.category === 'research' ? '#f43f5e' : '#6b7280'
                    }, transparent)`,
                  }} />

                  <div className="p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colors.bg} ${colors.text}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{template.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${colors.badge}`}>
                            {template.category}
                          </span>
                        </div>
                      </div>
                      {template.popularity > 0 && (
                        <div className="flex items-center gap-0.5 text-xs text-amber-500 flex-shrink-0">
                          <Star className="w-3 h-3 fill-current" />
                          {template.popularity}
                        </div>
                      )}
                    </div>

                    {template.description && (
                      <p className="text-sm text-gray-500 mb-3 line-clamp-2">{template.description}</p>
                    )}

                    {/* Step preview */}
                    {steps.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {steps.slice(0, 5).map((s, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-50 text-[10px] text-gray-500 font-medium"
                          >
                            {actionIcons[s.action]} {s.action}
                          </span>
                        ))}
                        {steps.length > 5 && (
                          <span className="px-1.5 py-0.5 rounded bg-gray-50 text-[10px] text-gray-400">
                            +{steps.length - 5}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <span className="text-xs text-gray-400">{steps.length} steps</span>
                      <button
                        className="text-sm text-primary-600 font-medium flex items-center gap-1 hover:underline group-hover:gap-2 transition-all"
                        onClick={() => useTemplateMutation.mutate(template.id)}
                        disabled={useTemplateMutation.isPending}
                      >
                        {useTemplateMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            Use Template <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : search ? (
        <div className="card p-12 text-center">
          <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-gray-600 font-medium mb-1">No matching templates</h3>
          <p className="text-sm text-gray-400">Try adjusting your search terms.</p>
        </div>
      ) : (
        <div className="card p-12 text-center text-gray-400">
          No templates in this category yet. Publish your workflows to share them!
        </div>
      )}
    </div>
  );
}
