-- V11: Reorder migration to create global_test_steps BEFORE test_steps
-- Note: V5 references global_test_steps; this migration is a no-op since
-- SQLite defers FK checks. Both tables exist after V5 and V9.
-- This migration seeds the default admin user.

-- BCrypt hash of 'Admin@123' with strength 12
INSERT OR IGNORE INTO users (
    id,
    username,
    email,
    password_hash,
    full_name,
    role,
    is_active,
    created_at,
    updated_at
) VALUES (
    'usr_admin_default_001',
    'admin',
    'admin@orion.local',
    '$2a$12$LqmvM3wK5V8P9Y2XqNXFnONB8yFB2aCjqB0.LfA4F7PjQf0f7T7de',
    'System Administrator',
    'ADMIN',
    1,
    datetime('now'),
    datetime('now')
);
