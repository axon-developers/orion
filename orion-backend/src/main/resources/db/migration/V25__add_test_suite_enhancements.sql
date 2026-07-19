-- Add stop_on_failure and parallelism columns to test_suites table
ALTER TABLE test_suites ADD COLUMN stop_on_failure BOOLEAN DEFAULT FALSE;
ALTER TABLE test_suites ADD COLUMN parallelism INTEGER DEFAULT 1;
