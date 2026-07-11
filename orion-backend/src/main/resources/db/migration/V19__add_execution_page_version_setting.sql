-- V19: Add ui.execution_page_version setting
INSERT INTO system_settings (id, category, setting_key, setting_value, value_type, display_name, description, requires_restart, updated_by, created_at, updated_at) VALUES
('s37', 'GENERAL', 'ui.execution_page_version', 'v2', 'STRING', 'Execution Page Version', 'Toggle between the classic detailed list (v1) and the modern split-screen logs layout (v2)', 0, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z');
