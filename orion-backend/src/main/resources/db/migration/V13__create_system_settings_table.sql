-- V18: Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    value_type TEXT NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    requires_restart INTEGER NOT NULL DEFAULT 0,
    updated_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);

-- Seed Default Settings
INSERT INTO system_settings (id, category, setting_key, setting_value, value_type, display_name, description, requires_restart, updated_by, created_at, updated_at) VALUES
('s1', 'GENERAL', 'platform.name', 'ORION', 'STRING', 'Platform Name', 'Display name of the platform inside headers and tabs', 0, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s2', 'GENERAL', 'platform.tagline', 'Visual Test Automation', 'STRING', 'Platform Tagline', 'Marketing tagline shown on login and landing screens', 0, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s3', 'GENERAL', 'ui.default_page_size', '10', 'INTEGER', 'Default Page Size', 'Default rows shown in all paginated lists and grids', 0, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s4', 'GENERAL', 'ui.dashboard_poll_interval_ms', '5000', 'INTEGER', 'Dashboard Polling Interval', 'Interval in milliseconds to refresh metrics on dashboard', 0, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s5', 'GENERAL', 'ui.inactivity_timeout_minutes', '15', 'INTEGER', 'Session Inactivity Timeout', 'Inactive session timeout duration in minutes', 0, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s6', 'GENERAL', 'ui.theme_default', 'dark', 'STRING', 'Default Theme', 'System-wide default visual theme (light/dark)', 0, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s7', 'GENERAL', 'ui.sidebar_default_collapsed', 'false', 'BOOLEAN', 'Sidebar Default Collapsed', 'Start the sidebar collapsed by default', 0, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s8', 'GENERAL', 'user.default_role', 'TESTER', 'STRING', 'Default User Role', 'Assigned role for self-registered user accounts', 0, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s9', 'GENERAL', 'user.self_registration_enabled', 'true', 'BOOLEAN', 'Allow Self-Registration', 'Enable or disable register account endpoint', 0, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),

('s10', 'SECURITY', 'security.jwt_access_token_expiry_ms', '900000', 'INTEGER', 'Access Token Expiry (ms)', 'Expiry duration of visual dashboard session token', 1, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s11', 'SECURITY', 'security.jwt_refresh_token_expiry_ms', '604800000', 'INTEGER', 'Refresh Token Expiry (ms)', 'Maximum keep-alive duration of sessions before forced log out', 1, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s12', 'SECURITY', 'security.bcrypt_rounds', '12', 'INTEGER', 'BCrypt Strength (Rounds)', 'Cost factor value for password hashing strength', 1, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s13', 'SECURITY', 'security.cors_allowed_origins', 'http://localhost:5173', 'STRING', 'CORS Allowed Origins', 'Comma-separated URLs allowed to request backend resources', 1, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s14', 'SECURITY', 'security.password_min_length', '8', 'INTEGER', 'Minimum Password Length', 'Minimum password length required for new users', 0, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s15', 'SECURITY', 'security.max_login_attempts', '5', 'INTEGER', 'Max Login Attempts', 'Conscutive login failures before account locking', 0, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s16', 'SECURITY', 'security.lockout_duration_minutes', '30', 'INTEGER', 'Account Lockout Duration', 'Locked account suspension duration in minutes', 0, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),

('s17', 'EXECUTION', 'execution.thread_pool_core_size', '1', 'INTEGER', 'Core Thread Pool Size', 'Execution thread core count (concurrency)', 1, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s18', 'EXECUTION', 'execution.thread_pool_max_size', '1', 'INTEGER', 'Max Thread Pool Size', 'Maximum concurrency pool size', 1, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s19', 'EXECUTION', 'execution.thread_pool_queue_capacity', '1000', 'INTEGER', 'Queue Capacity', 'Size threshold of thread pools queues', 1, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s20', 'EXECUTION', 'execution.default_step_timeout_ms', '30000', 'INTEGER', 'Default Step Timeout', 'Step response response waiting time threshold in milliseconds', 0, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s21', 'EXECUTION', 'execution.screenshot_storage_path', 'storage/screenshots', 'STRING', 'Screenshot Storage Path', 'Location on disk to write execution screenshots', 1, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s22', 'EXECUTION', 'execution.max_parallel_browsers', '2', 'INTEGER', 'Max Parallel Browsers', 'Simultaneous browser sessions running concurrently', 0, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s23', 'EXECUTION', 'execution.auto_cleanup_days', '90', 'INTEGER', 'Execution Auto-Cleanup (days)', 'History age in days to wipe database runs (0 to disable)', 0, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s24', 'EXECUTION', 'execution.retry_on_failure', 'false', 'BOOLEAN', 'Retry Failed Steps', 'Instruct the engine to retry failed steps', 0, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),

('s25', 'EMAIL', 'email.smtp_host', 'localhost', 'STRING', 'SMTP Host', 'Mail server host endpoint address', 1, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s26', 'EMAIL', 'email.smtp_port', '1025', 'INTEGER', 'SMTP Port', 'Mail server port value', 1, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s27', 'EMAIL', 'email.smtp_username', '', 'STRING', 'SMTP Username', 'Credentials username authentication', 1, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s28', 'EMAIL', 'email.smtp_password', '', 'STRING', 'SMTP Password', 'Credentials security authentication password', 1, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s29', 'EMAIL', 'email.smtp_auth', 'false', 'BOOLEAN', 'SMTP Auth Required', 'Require credentials verification check when relaying mail', 1, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s30', 'EMAIL', 'email.smtp_starttls', 'false', 'BOOLEAN', 'SMTP STARTTLS', 'Enable transport security protocols (TLS)', 1, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s31', 'EMAIL', 'email.sender_address', 'noreply@orion-testing.com', 'STRING', 'Sender Email Address', 'System notification from sender address', 1, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s32', 'EMAIL', 'email.notify_on_failure', 'false', 'BOOLEAN', 'Notify on Test Failure', 'Send mail to owner automatically when test case fails', 0, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s33', 'EMAIL', 'email.notify_recipients', '', 'STRING', 'Default Notification Recipients', 'Secondary notification emails list (comma separated)', 0, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),

('s34', 'MAINTENANCE', 'logging.root_level', 'INFO', 'STRING', 'Root Log Level', 'Spring framework internal logging level threshold', 1, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s35', 'MAINTENANCE', 'logging.orion_level', 'INFO', 'STRING', 'ORION App Log Level', 'ORION custom project code logging scope level', 1, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s36', 'MAINTENANCE', 'logging.sql_level', 'WARN', 'STRING', 'SQL Log Level', 'Database query output details printing verbosity', 1, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z');
