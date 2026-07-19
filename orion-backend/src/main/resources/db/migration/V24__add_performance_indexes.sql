-- Add database performance indexes for execution step logs, executions, and test cases
CREATE INDEX IF NOT EXISTS idx_esl_exec_seq ON execution_step_logs(execution_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_exec_tc_status ON executions(test_case_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_tc_app_status ON test_cases(app_id, status, updated_at DESC);
