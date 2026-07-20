-- V16: Create test_case_snapshots table
CREATE TABLE IF NOT EXISTS test_case_snapshots (
    id TEXT PRIMARY KEY,
    test_case_id TEXT NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    steps_snapshot TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snapshots_test_case_id ON test_case_snapshots(test_case_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_tc_version ON test_case_snapshots(test_case_id, version);
