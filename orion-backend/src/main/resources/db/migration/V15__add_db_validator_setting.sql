-- V15: Add Tools system settings
INSERT INTO system_settings (
    id,
    category,
    setting_key,
    setting_value,
    value_type,
    display_name,
    description,
    requires_restart,
    updated_by,
    created_at,
    updated_at
) VALUES (
    's44',
    'TOOLS',
    'tools.db_query_validator.enabled',
    'true',
    'BOOLEAN',
    'Enable Database Query Validator',
    'Allow users to validate read-only SQL queries against configured environment databases',
    0,
    'system',
    '2026-07-12T10:00:00Z',
    '2026-07-12T10:00:00Z'
),
(
    's45',
    'TOOLS',
    'tools.playwright_generator.enabled',
    'true',
    'BOOLEAN',
    'Enable Playwright Generator',
    'Allow users to record/generate Playwright step definitions within the browser automation tools',
    0,
    'system',
    '2026-07-12T10:00:00Z',
    '2026-07-12T10:00:00Z'
) ON CONFLICT (id) DO NOTHING;
