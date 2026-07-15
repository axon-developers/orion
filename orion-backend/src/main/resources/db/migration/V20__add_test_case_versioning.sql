ALTER TABLE test_cases ADD COLUMN version INT DEFAULT 1;

CREATE TABLE test_case_snapshots (
    id VARCHAR(36) PRIMARY KEY,
    test_case_id VARCHAR(36) NOT NULL,
    version INT NOT NULL,
    steps_snapshot TEXT NOT NULL,
    created_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL
);
