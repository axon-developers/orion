-- V16: Add is_default column to environments table
ALTER TABLE environments ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0;
