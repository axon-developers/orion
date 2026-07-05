-- V16: Refactor environment JSON columns into relational tables

CREATE TABLE IF NOT EXISTS environment_variables (
    environment_id TEXT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    variable_key TEXT NOT NULL,
    variable_value TEXT,
    is_secret INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    PRIMARY KEY (environment_id, variable_key)
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

-- Migrate existing environment variables (SQLite JSON1 extension)
INSERT OR IGNORE INTO environment_variables (environment_id, variable_key, variable_value, is_secret, description)
SELECT 
    e.id, 
    json_extract(v.value, '$.key'),
    json_extract(v.value, '$.value'),
    CASE WHEN json_extract(v.value, '$.isSecret') = 1 OR json_extract(v.value, '$.secret') = 1 OR json_extract(v.value, '$.isSecret') = 'true' THEN 1 ELSE 0 END,
    json_extract(v.value, '$.description')
FROM environments e, json_each(e.variables) v
WHERE e.variables IS NOT NULL AND e.variables NOT IN ('[]', '', '{}');

-- Migrate existing database connections
INSERT OR IGNORE INTO environment_databases (id, environment_id, name, type, host, port, database_name, username, password, certificate_key, connection_url, cert_placeholder)
SELECT 
    coalesce(json_extract(db.value, '$.id'), json_extract(db.value, '$.name')),
    e.id,
    json_extract(db.value, '$.name'),
    json_extract(db.value, '$.type'),
    json_extract(db.value, '$.host'),
    json_extract(db.value, '$.port'),
    json_extract(db.value, '$.databaseName'),
    json_extract(db.value, '$.username'),
    json_extract(db.value, '$.password'),
    json_extract(db.value, '$.certificateKey'),
    json_extract(db.value, '$.connectionUrl'),
    json_extract(db.value, '$.certPlaceholder')
FROM environments e, json_each(e.db_connections) db
WHERE e.db_connections IS NOT NULL AND e.db_connections NOT IN ('[]', '', '{}');

-- Migrate existing certificates
INSERT OR IGNORE INTO environment_certificates (id, environment_id, name, description, client_cert, client_cert_password)
SELECT 
    coalesce(json_extract(c.value, '$.id'), json_extract(c.value, '$.name')),
    e.id,
    json_extract(c.value, '$.name'),
    json_extract(c.value, '$.description'),
    json_extract(c.value, '$.clientCert'),
    json_extract(c.value, '$.clientCertPassword')
FROM environments e, json_each(e.certificates) c
WHERE e.certificates IS NOT NULL AND e.certificates NOT IN ('[]', '', '{}');
