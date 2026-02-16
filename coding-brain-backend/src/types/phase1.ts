// Phase 1 Enhanced Features - Type Definitions

export interface ExecutionTemplate {
  id: string;
  name: string;
  description?: string;
  category: 'api' | 'database' | 'testing' | 'devops' | 'custom';
  icon?: string;
  is_public: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  usage_count: number;
  rating_avg: number;
  rating_count: number;
  tags: string[];
  template_config: TemplateConfig;
}

export interface TemplateConfig {
  task_description: string;
  variables: TemplateVariable[];
  default_model?: string;
  estimated_duration_seconds?: number;
  required_permissions?: string[];
  outputs?: TemplateOutput[];
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect';
  description: string;
  required: boolean;
  default_value?: any;
  options?: string[]; // For select/multiselect
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    message?: string;
  };
}

export interface TemplateOutput {
  name: string;
  type: 'file' | 'text' | 'json' | 'url';
  description: string;
}

export interface TemplateRating {
  id: string;
  template_id: string;
  user_id: string;
  rating: number;
  review?: string;
  created_at: string;
}

export interface ScheduledExecution {
  id: string;
  name: string;
  description?: string;
  user_id: string;
  template_id?: string;
  cron_expression: string;
  timezone: string;
  is_active: boolean;
  last_run_at?: string;
  next_run_at: string;
  execution_count: number;
  config: ScheduleConfig;
  created_at: string;
  updated_at: string;
}

export interface ScheduleConfig {
  template_variables?: Record<string, any>;
  notifications?: {
    on_success?: boolean;
    on_failure?: boolean;
    channels?: ('email' | 'webhook')[];
    webhook_url?: string;
  };
  retry_policy?: {
    max_retries: number;
    retry_delay_seconds: number;
  };
}

export interface ExecutionPipeline {
  id: string;
  name: string;
  description?: string;
  user_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  steps?: PipelineStep[];
}

export interface PipelineStep {
  id: string;
  pipeline_id: string;
  step_order: number;
  name: string;
  template_id?: string;
  config: PipelineStepConfig;
  condition?: StepCondition;
  retry_count: number;
  timeout_seconds: number;
  created_at: string;
}

export interface PipelineStepConfig {
  template_variables?: Record<string, any>;
  pass_output_to_next?: boolean;
  output_mapping?: Record<string, string>;
}

export interface StepCondition {
  type: 'always' | 'on_success' | 'on_failure' | 'custom';
  expression?: string; // JavaScript expression
}

export interface ExecutionSnapshot {
  id: string;
  execution_id: string;
  snapshot_type: 'before' | 'checkpoint' | 'after';
  snapshot_data: SnapshotData;
  file_system_state?: FileSystemState;
  environment_state?: Record<string, string>;
  created_at: string;
}

export interface SnapshotData {
  execution_state: string;
  current_step?: number;
  variables?: Record<string, any>;
  logs?: string[];
  metrics?: Record<string, number>;
}

export interface FileSystemState {
  files_created: string[];
  files_modified: string[];
  files_deleted: string[];
  checksums: Record<string, string>;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  settings: WorkspaceSettings;
  members?: WorkspaceMember[];
}

export interface WorkspaceSettings {
  default_model?: string;
  max_concurrent_executions?: number;
  allowed_templates?: string[];
  resource_limits?: {
    max_executions_per_day?: number;
    max_storage_mb?: number;
  };
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joined_at: string;
  user?: {
    email: string;
    id: string;
  };
}

export interface WorkspaceResource {
  id: string;
  workspace_id: string;
  resource_type: 'template' | 'execution' | 'pipeline';
  resource_id: string;
  shared_by: string;
  shared_at: string;
}

export interface CLIInteractiveSession {
  id: string;
  user_id: string;
  persona: string;
  context_data?: ConversationContext;
  started_at: string;
  last_activity_at: string;
  ended_at?: string;
  is_active: boolean;
}

export interface ConversationContext {
  messages: ConversationMessage[];
  current_task?: string;
  workspace_path?: string;
  remembered_preferences?: Record<string, any>;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface ExecutionContext {
  id: string;
  execution_id: string;
  context_type: 'input' | 'output' | 'error' | 'metadata';
  context_data: any;
  created_at: string;
}

export interface ExecutionDependency {
  id: string;
  execution_id: string;
  depends_on_id: string;
  dependency_type: 'blocking' | 'soft' | 'data';
  is_satisfied: boolean;
  created_at: string;
}

// API Request/Response Types

export interface CreateTemplateRequest {
  name: string;
  description?: string;
  category: string;
  icon?: string;
  is_public: boolean;
  tags: string[];
  template_config: TemplateConfig;
}

export interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  category?: string;
  icon?: string;
  is_public?: boolean;
  tags?: string[];
  template_config?: TemplateConfig;
}

export interface CreateScheduleRequest {
  name: string;
  description?: string;
  template_id?: string;
  cron_expression: string;
  timezone?: string;
  config: ScheduleConfig;
}

export interface CreatePipelineRequest {
  name: string;
  description?: string;
  steps: Omit<PipelineStep, 'id' | 'pipeline_id' | 'created_at'>[];
}

export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
  settings?: WorkspaceSettings;
}

export interface InviteMemberRequest {
  email: string;
  role: 'admin' | 'member' | 'viewer';
}

export interface ExecuteTemplateRequest {
  template_id: string;
  variables: Record<string, any>;
  workspace_id?: string;
}

export interface ExecutePipelineRequest {
  pipeline_id: string;
  initial_variables?: Record<string, any>;
}

export interface RollbackExecutionRequest {
  execution_id: string;
  snapshot_id?: string; // If not provided, rollback to 'before' snapshot
}
