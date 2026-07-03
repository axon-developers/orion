-- V9: Create global_test_steps table
CREATE TABLE IF NOT EXISTS global_test_steps (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    step_type TEXT NOT NULL,
    action_type TEXT NOT NULL DEFAULT 'NONE',
    config TEXT NOT NULL DEFAULT '{}',
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_global_test_steps_name ON global_test_steps(name);
CREATE INDEX IF NOT EXISTS idx_global_test_steps_step_type ON global_test_steps(step_type);
