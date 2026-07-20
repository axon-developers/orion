-- V12: Create environment datasets table
CREATE TABLE IF NOT EXISTS environment_datasets (
    id TEXT PRIMARY KEY,
    environment_id TEXT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    filename TEXT NOT NULL,
    csv_content TEXT NOT NULL
);
