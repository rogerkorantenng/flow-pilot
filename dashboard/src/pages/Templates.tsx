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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { listTemplates, useTemplate } from '../services/api';

const categoryIcons: Record<string, React.ElementType> = {
  finance: Receipt,
  sales: Users,
  marketing: Megaphone,
  monitoring: TrendingUp,
  research: Newspaper,
};

const categoryColors: Record<string, string> = {
  finance: 'bg-green-50 text-green-600',
  sales: 'bg-blue-50 text-blue-600',
  marketing: 'bg-purple-50 text-purple-600',
  monitoring: 'bg-amber-50 text-amber-600',
  research: 'bg-rose-50 text-rose-600',
};

const CATEGORIES = ['all', 'finance', 'sales', 'marketing', 'monitoring', 'research'];

export default function Templates() {
  const [activeCategory, setActiveCategory] = useState('all');
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Templates</h1>
        <p className="text-gray-500 mt-1">Pre-built workflow templates to get started quickly</p>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize whitespace-nowrap transition-colors ${
              activeCategory === cat
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600 mb-3" />
          <p className="text-sm text-gray-500">Loading templates...</p>
        </div>
      ) : templates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => {
            const Icon = categoryIcons[template.category] || Workflow;
            const colorClass = categoryColors[template.category] || 'bg-gray-50 text-gray-600';
            let stepCount = 0;
            try {
              stepCount = JSON.parse(template.steps_json).length;
            } catch {
              // ignore
            }

            return (
              <div key={template.id} className="card p-6 hover:shadow-md transition-all group">
                <div className="flex items-start gap-4 mb-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{template.name}</h3>
                    <span className="text-xs text-gray-400 capitalize">{template.category}</span>
                  </div>
                  {template.popularity > 0 && (
                    <div className="flex items-center gap-1 text-xs text-amber-500">
                      <Star className="w-3 h-3 fill-current" />
                      {template.popularity}
                    </div>
                  )}
                </div>

                {template.description && (
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                    {template.description}
                  </p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="text-xs text-gray-400">{stepCount} steps</span>
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
            );
          })}
        </div>
      ) : (
        <div className="card p-12 text-center text-gray-400">
          No templates in this category
        </div>
      )}
    </div>
  );
}
