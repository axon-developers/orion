-- V3: Create environments table and relational collection tables
CREATE TABLE IF NOT EXISTS environments (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL REFERENCES applications(id),
    name TEXT NOT NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_default INTEGER NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS environment_variables (
    environment_id TEXT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    variable_key TEXT NOT NULL,
    variable_value TEXT,
    is_secret INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    PRIMARY KEY (environment_id, variable_key)
);

CREATE TABLE IF NOT EXISTS environment_secrets (
    environment_id TEXT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    secret_key TEXT NOT NULL,
    secret_value TEXT NOT NULL,
    description TEXT,
    PRIMARY KEY (environment_id, secret_key)
);

CREATE TABLE IF NOT EXISTS environment_databases (
    id TEXT PRIMARY KEY,
    environment_id TEXT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT,
    host TEXT,
    port INTEGER,
    database_name TEXT,
    username TEXT,
    password TEXT,
    certificate_key TEXT,
    connection_url TEXT,
    cert_placeholder TEXT
);

CREATE TABLE IF NOT EXISTS environment_certificates (
    id TEXT PRIMARY KEY,
    environment_id TEXT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    client_cert TEXT,
    client_cert_password TEXT
);
