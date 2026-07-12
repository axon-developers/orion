-- Add step_name and step_type columns to execution_step_logs
-- These store the step metadata at log creation time so it is available
-- even if the original test step is later modified or deleted.
ALTER TABLE execution_step_logs ADD COLUMN step_name TEXT;
ALTER TABLE execution_step_logs ADD COLUMN step_type TEXT;
