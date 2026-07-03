-- V5: Create test_steps table
CREATE TABLE IF NOT EXISTS test_steps (
    id TEXT PRIMARY KEY,
    test_case_id TEXT NOT NULL REFERENCES test_cases(id),
    sequence_order INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    step_type TEXT NOT NULL,
    action_type TEXT NOT NULL DEFAULT 'NONE',
    config TEXT NOT NULL DEFAULT '{}',
    expected_result TEXT,
    is_global_ref INTEGER NOT NULL DEFAULT 0,
    global_step_id TEXT, -- FK -> global_test_steps(id), enforced at app level
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_test_steps_test_case_id ON test_steps(test_case_id);
CREATE INDEX IF NOT EXISTS idx_test_steps_sequence_order ON test_steps(test_case_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_test_steps_global_step_id ON test_steps(global_step_id);
