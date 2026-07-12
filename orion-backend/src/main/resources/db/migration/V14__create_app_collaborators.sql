-- V21: Create application_collaborators table and seed SAML settings
CREATE TABLE IF NOT EXISTS application_collaborators (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    username TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(application_id, username)
);

CREATE INDEX IF NOT EXISTS idx_app_collaborators_app ON application_collaborators(application_id);

INSERT INTO system_settings (id, category, setting_key, setting_value, value_type, display_name, description, requires_restart, updated_by, created_at, updated_at) VALUES
('s38', 'SECURITY', 'saml.enabled', 'false', 'BOOLEAN', 'Enable SAML Authentication', 'Enable single sign-on via SAML Identity Provider', 1, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s39', 'SECURITY', 'saml.idp.entity_id', '', 'STRING', 'IdP Entity ID', 'Entity ID of the Identity Provider', 1, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s40', 'SECURITY', 'saml.idp.sso_url', '', 'STRING', 'IdP Single Sign-On URL', 'HTTP-Redirect or HTTP-POST endpoint of IdP SSO', 1, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s41', 'SECURITY', 'saml.idp.verification_cert', '', 'STRING', 'IdP Verification Certificate', 'PEM-encoded X.509 signature verification certificate', 1, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s42', 'SECURITY', 'saml.sp.entity_id', 'http://localhost:8080/saml2/service-provider-metadata/orion', 'STRING', 'SP Entity ID', 'Entity ID / Audience URL of Orion Service Provider', 1, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z'),
('s43', 'SECURITY', 'saml.sp.acs_url', 'http://localhost:8080/login/saml2/sso/orion', 'STRING', 'SP ACS URL', 'Assertion Consumer Service response endpoint', 1, 'system', '2026-07-11T12:00:00Z', '2026-07-11T12:00:00Z');
