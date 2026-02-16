-- Migration: Add sessions table
-- Date: 2026-02-16
-- Purpose: Add telemetry session tracking table

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  mode TEXT,
  os TEXT,
  prompt TEXT,
  final_state TEXT,
  fsm_version TEXT NOT NULL DEFAULT '1.0.0',
  events_json TEXT NOT NULL,
  commands_executed INTEGER DEFAULT 0,
  commands_failed INTEGER DEFAULT 0,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
