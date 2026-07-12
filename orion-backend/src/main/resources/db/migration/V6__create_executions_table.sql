-- V6: Create executions table
CREATE TABLE IF NOT EXISTS executions (
    id TEXT PRIMARY KEY,
    test_case_id TEXT NOT NULL REFERENCES test_cases(id),
    environment_id TEXT NOT NULL REFERENCES environments(id),
    status TEXT NOT NULL DEFAULT 'QUEUED',
    triggered_by TEXT NOT NULL REFERENCES users(id),
    started_at TEXT,
    completed_at TEXT,
    duration_ms INTEGER,
    total_steps INTEGER NOT NULL DEFAULT 0,
    passed_steps INTEGER NOT NULL DEFAULT 0,
    failed_steps INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    step_ids TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_executions_test_case_id ON executions(test_case_id);
CREATE INDEX IF NOT EXISTS idx_executions_environment_id ON executions(environment_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_triggered_by ON executions(triggered_by);
CREATE INDEX IF NOT EXISTS idx_executions_created_at ON executions(created_at);
