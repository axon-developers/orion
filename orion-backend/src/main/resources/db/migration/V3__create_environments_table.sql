-- V3: Create environments table
CREATE TABLE IF NOT EXISTS environments (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL REFERENCES applications(id),
    name TEXT NOT NULL,
    description TEXT,
    variables TEXT NOT NULL DEFAULT '[]',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    ssl_client_cert TEXT,
    ssl_client_cert_password TEXT,
    ssl_trust_all INTEGER NOT NULL DEFAULT 0,
    UNIQUE(app_id, name)
);

CREATE INDEX IF NOT EXISTS idx_environments_app_id ON environments(app_id);
CREATE INDEX IF NOT EXISTS idx_environments_created_by ON environments(created_by);
