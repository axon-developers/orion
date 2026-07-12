-- V17: Add UI Notification Position system setting
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
    's46',
    'GENERAL',
    'ui.notification_position',
    'top-right',
    'STRING',
    'Notification Position',
    'Standard 3x3 screen position matrix for rendering in-app toast notifications',
    0,
    'system',
    '2026-07-13T00:00:00Z',
    '2026-07-13T00:00:00Z'
) ON CONFLICT (id) DO NOTHING;
