import axios from 'axios';
import type { Workflow, WorkflowRun, WorkflowTemplate, ExtractedResult } from '../types/workflow';

const api = axios.create({
  baseURL: '/api',
});

// Attach X-User-Id header to every request
api.interceptors.request.use((config) => {
  const userId = localStorage.getItem('userId');
  if (userId) {
    config.headers['X-User-Id'] = userId;
  }
  return config;
});

// Users
export const enterUser = (name: string) =>
  api.post<{ id: string; name: string; is_new: boolean }>('/users/enter', { name }).then((r) => r.data);

// Workflows
export const listWorkflows = () =>
  api.get<Workflow[]>('/workflows').then((r) => r.data);

export const getWorkflow = (id: string) =>
  api.get<Workflow>(`/workflows/${id}`).then((r) => r.data);

export const createWorkflow = (data: {
  name: string;
  description?: string;
  steps_json?: string;
  variables_json?: string;
  trigger_type?: string;
  schedule_cron?: string;
}) => api.post<Workflow>('/workflows', data).then((r) => r.data);

export const updateWorkflow = (id: string, data: Record<string, unknown>) =>
  api.put<Workflow>(`/workflows/${id}`, data).then((r) => r.data);

export const deleteWorkflow = (id: string) =>
  api.delete(`/workflows/${id}`).then((r) => r.data);

export const planWorkflow = (description: string) =>
  api.post<{ steps: Record<string, unknown>[] }>('/workflows/plan', { description }).then((r) => r.data);

export const triggerRun = (workflowId: string) =>
  api.post<{ run_id: string; status: string }>(`/workflows/${workflowId}/run`).then((r) => r.data);

export const cloneWorkflow = async (id: string): Promise<Workflow> => {
  const original = await getWorkflow(id);
  return createWorkflow({
    name: `${original.name} (Copy)`,
    description: original.description || '',
    steps_json: original.steps_json || '[]',
    trigger_type: 'manual',
  });
};

// Runs
export const listRuns = (workflowId?: string) => {
  const params = workflowId ? { workflow_id: workflowId } : {};
  return api.get<WorkflowRun[]>('/runs', { params }).then((r) => r.data);
};

export const getRun = (id: string) =>
  api.get<WorkflowRun>(`/runs/${id}`).then((r) => r.data);

export const retryStep = (runId: string, stepId: string) =>
  api.post(`/runs/${runId}/steps/${stepId}/retry`).then((r) => r.data);

export const skipStep = (runId: string, stepId: string) =>
  api.post(`/runs/${runId}/steps/${stepId}/skip`).then((r) => r.data);

export const abortRun = (runId: string) =>
  api.post(`/runs/${runId}/abort`).then((r) => r.data);

// Templates
export const listTemplates = (category?: string) => {
  const params = category ? { category } : {};
  return api.get<WorkflowTemplate[]>('/templates', { params }).then((r) => r.data);
};

export const useTemplate = (templateId: string) =>
  api.post(`/templates/use/${templateId}`).then((r) => r.data);

// Results
export const listResults = (params?: { workflow_id?: string; action?: string; limit?: number }) =>
  api.get<ExtractedResult[]>('/results', { params }).then((r) => r.data);

// Run Summary & AI Fix
export const getRunSummary = (runId: string) =>
  api.get<{ summary: string; ai_generated: boolean }>(`/runs/${runId}/summary`).then((r) => r.data);

export const getAIFix = (runId: string, stepId: string, data: {
  error_message: string;
  step_action: string;
  step_description?: string;
  step_target?: string;
}) => api.post<{ suggestion: string; ai_generated: boolean }>(`/runs/${runId}/steps/${stepId}/ai-fix`, data).then((r) => r.data);

// AI Status
export interface AIStatus {
  text_model: string;
  image_model: string;
  region: string;
  connected: boolean;
  throttled: boolean;
  message: string;
}

export const getAIStatus = () =>
  api.get<AIStatus>('/workflows/ai/status').then((r) => r.data);

// Generate Workflow (one-shot: describe → create)
export const generateWorkflow = (description: string) =>
  api.post<{
    id: string;
    name: string;
    description: string;
    steps_json: string;
    trigger_type: string;
    schedule_cron: string | null;
    status: string;
    steps_count: number;
  }>('/workflows/generate', { description }).then((r) => r.data);

// Smart Insights
export interface Insight {
  type: string;
  title: string;
  description: string;
  severity: string;
  data: Record<string, unknown> | null;
}

export interface InsightsResponse {
  insights: Insight[];
  summary: string;
  ai_generated: boolean;
}

export const generateInsights = (params?: { workflow_id?: string; run_id?: string }) =>
  api.post<InsightsResponse>('/insights/generate', params || {}).then((r) => r.data);

// Publish to Marketplace
export const publishTemplate = (workflowId: string, category: string) =>
  api.post<{ id: string; name: string; category: string; message: string }>(
    '/templates/publish',
    { workflow_id: workflowId, category },
  ).then((r) => r.data);

// Chat Copilot
export const sendChat = (message: string, context?: string) =>
  api.post<{ reply: string; ai_generated: boolean }>('/chat', { message, context }).then((r) => r.data);

export default api;
