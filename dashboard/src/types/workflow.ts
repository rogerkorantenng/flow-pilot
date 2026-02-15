export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  steps_json: string | null;
  variables_json: string | null;
  trigger_type: string;
  schedule_cron: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  last_run: { id: string; status: string; created_at: string } | null;
  run_count: number;
}

export interface WorkflowVariable {
  value: string;
  secret: boolean;
}

export interface WorkflowStep {
  step_number: number;
  action: string;
  target: string;
  value?: string;
  description: string;
  condition?: string;
}

export interface RunStep {
  id: string;
  step_number: number;
  action: string;
  target: string | null;
  value: string | null;
  description: string | null;
  condition: string | null;
  status: string;
  screenshot_b64: string | null;
  result_data: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  workflow_name: string;
  status: string;
  trigger: string;
  total_steps: number;
  completed_steps: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  steps: RunStep[];
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  steps_json: string;
  icon: string;
  popularity: number;
}

export interface ExtractedResult {
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
}

export interface SSEEvent {
  type: string;
  run_id: string;
  step_id?: string;
  step_number?: number;
  action?: string;
  description?: string;
  result?: Record<string, unknown>;
  error?: string;
  total_steps?: number;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}
