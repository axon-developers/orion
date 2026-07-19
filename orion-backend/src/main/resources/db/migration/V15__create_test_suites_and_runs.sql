-- V15: Create test_suites and suite execution tables
CREATE TABLE IF NOT EXISTS test_suites (
    id VARCHAR(36) PRIMARY KEY,
    app_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    cron_expression VARCHAR(100),
    environment_id VARCHAR(36),
    stop_on_failure BOOLEAN DEFAULT FALSE,
    parallelism INTEGER DEFAULT 1,
    enabled BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS test_suite_cases (
    suite_id VARCHAR(36) NOT NULL,
    test_case_id VARCHAR(36) NOT NULL,
    sequence_order INT NOT NULL,
    PRIMARY KEY (suite_id, test_case_id)
);

CREATE TABLE IF NOT EXISTS suite_executions (
    id VARCHAR(36) PRIMARY KEY,
    suite_id VARCHAR(36) NOT NULL,
    status VARCHAR(50) NOT NULL,
    triggered_by VARCHAR(100) NOT NULL,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms BIGINT,
    total_cases INT DEFAULT 0,
    passed_cases INT DEFAULT 0,
    failed_cases INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS suite_execution_cases (
    id VARCHAR(36) PRIMARY KEY,
    suite_execution_id VARCHAR(36) NOT NULL,
    test_case_id VARCHAR(36) NOT NULL,
    execution_id VARCHAR(36),
    status VARCHAR(50) NOT NULL,
    duration_ms BIGINT
);
