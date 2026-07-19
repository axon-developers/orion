-- V7: Create execution_step_logs table
CREATE TABLE IF NOT EXISTS execution_step_logs (
    id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL REFERENCES executions(id),
    test_step_id TEXT NOT NULL REFERENCES test_steps(id),
    sequence_order INTEGER NOT NULL,
    step_name TEXT,
    step_type TEXT,
    iteration_label TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    input_payload TEXT DEFAULT '{}',
    output_payload TEXT DEFAULT '{}',
    error_message TEXT,
    started_at TEXT,
    completed_at TEXT,
    duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_exec_step_logs_execution_id ON execution_step_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_exec_step_logs_test_step_id ON execution_step_logs(test_step_id);
CREATE INDEX IF NOT EXISTS idx_exec_step_logs_sequence ON execution_step_logs(execution_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_esl_exec_seq ON execution_step_logs(execution_id, sequence_order);
