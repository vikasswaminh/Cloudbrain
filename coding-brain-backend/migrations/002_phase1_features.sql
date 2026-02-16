-- Phase 1: Enhanced Core Features Database Schema
-- Migration: 002_phase1_features.sql

-- Execution Templates
CREATE TABLE IF NOT EXISTS execution_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- 'api', 'database', 'testing', 'devops', 'custom'
    icon TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    usage_count INTEGER DEFAULT 0,
    rating_avg REAL DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    tags TEXT, -- JSON array of tags
    template_config TEXT NOT NULL, -- JSON config for the template
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_templates_category ON execution_templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_public ON execution_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_templates_created_by ON execution_templates(created_by);

-- Template Ratings
CREATE TABLE IF NOT EXISTS template_ratings (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (template_id) REFERENCES execution_templates(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(template_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_template_ratings_template ON template_ratings(template_id);

-- Scheduled Executions
CREATE TABLE IF NOT EXISTS scheduled_executions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    user_id TEXT NOT NULL,
    template_id TEXT,
    cron_expression TEXT NOT NULL,
    timezone TEXT DEFAULT 'UTC',
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at TEXT,
    next_run_at TEXT NOT NULL,
    execution_count INTEGER DEFAULT 0,
    config TEXT NOT NULL, -- JSON config for execution
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (template_id) REFERENCES execution_templates(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_scheduled_user ON scheduled_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_active ON scheduled_executions(is_active);
CREATE INDEX IF NOT EXISTS idx_scheduled_next_run ON scheduled_executions(next_run_at);

-- Execution Pipelines (chaining)
CREATE TABLE IF NOT EXISTS execution_pipelines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    user_id TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS pipeline_steps (
    id TEXT PRIMARY KEY,
    pipeline_id TEXT NOT NULL,
    step_order INTEGER NOT NULL,
    name TEXT NOT NULL,
    template_id TEXT,
    config TEXT NOT NULL, -- JSON config
    condition TEXT, -- JSON condition for execution
    retry_count INTEGER DEFAULT 0,
    timeout_seconds INTEGER DEFAULT 300,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (pipeline_id) REFERENCES execution_pipelines(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES execution_templates(id) ON DELETE SET NULL,
    UNIQUE(pipeline_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_steps_pipeline ON pipeline_steps(pipeline_id);

-- Execution Snapshots (for rollback)
CREATE TABLE IF NOT EXISTS execution_snapshots (
    id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL,
    snapshot_type TEXT NOT NULL, -- 'before', 'checkpoint', 'after'
    snapshot_data TEXT NOT NULL, -- JSON snapshot data
    file_system_state TEXT, -- JSON file system state
    environment_state TEXT, -- JSON environment variables
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (execution_id) REFERENCES executions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_snapshots_execution ON execution_snapshots(execution_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_type ON execution_snapshots(snapshot_type);

-- Team Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    owner_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    settings TEXT, -- JSON workspace settings
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS workspace_members (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'member', 'viewer'
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);

-- Shared Resources (templates, executions shared within workspace)
CREATE TABLE IF NOT EXISTS workspace_resources (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    resource_type TEXT NOT NULL, -- 'template', 'execution', 'pipeline'
    resource_id TEXT NOT NULL,
    shared_by TEXT NOT NULL,
    shared_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_by) REFERENCES users(id),
    UNIQUE(workspace_id, resource_type, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_resources_workspace ON workspace_resources(workspace_id);

-- CLI Interactive Sessions
CREATE TABLE IF NOT EXISTS cli_interactive_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    persona TEXT DEFAULT 'default', -- AI persona type
    context_data TEXT, -- JSON conversation context
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_cli_sessions_user ON cli_interactive_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_cli_sessions_active ON cli_interactive_sessions(is_active);

-- Execution Context (for better AI learning from history)
CREATE TABLE IF NOT EXISTS execution_context (
    id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL,
    context_type TEXT NOT NULL, -- 'input', 'output', 'error', 'metadata'
    context_data TEXT NOT NULL, -- JSON context data
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (execution_id) REFERENCES executions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_execution_context_execution ON execution_context(execution_id);
CREATE INDEX IF NOT EXISTS idx_execution_context_type ON execution_context(context_type);

-- Execution Dependencies (for parallel execution tracking)
CREATE TABLE IF NOT EXISTS execution_dependencies (
    id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL,
    depends_on_id TEXT NOT NULL,
    dependency_type TEXT NOT NULL, -- 'blocking', 'soft', 'data'
    is_satisfied BOOLEAN DEFAULT FALSE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (execution_id) REFERENCES executions(id) ON DELETE CASCADE,
    FOREIGN KEY (depends_on_id) REFERENCES executions(id) ON DELETE CASCADE,
    UNIQUE(execution_id, depends_on_id)
);

CREATE INDEX IF NOT EXISTS idx_execution_deps_execution ON execution_dependencies(execution_id);
CREATE INDEX IF NOT EXISTS idx_execution_deps_depends_on ON execution_dependencies(depends_on_id);
