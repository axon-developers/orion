-- Add environment_secrets table for encrypted vault storage
CREATE TABLE IF NOT EXISTS environment_secrets (
    environment_id VARCHAR(36) NOT NULL,
    secret_key VARCHAR(255) NOT NULL,
    secret_value TEXT NOT NULL,
    description TEXT,
    PRIMARY KEY (environment_id, secret_key),
    FOREIGN KEY (environment_id) REFERENCES environments(id) ON DELETE CASCADE
);
