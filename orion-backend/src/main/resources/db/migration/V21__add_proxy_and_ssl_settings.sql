-- Seed Proxy and Server SSL Settings
INSERT INTO system_settings (id, category, setting_key, setting_value, value_type, display_name, description, requires_restart, updated_by, created_at, updated_at) VALUES
('s47', 'NETWORK', 'proxy.enabled', 'false', 'BOOLEAN', 'Enable System Proxy', 'Route HTTP, SOAP, GraphQL, and Browser automation requests through a corporate proxy', 0, 'system', '2026-07-15T20:00:00Z', '2026-07-15T20:00:00Z'),
('s48', 'NETWORK', 'proxy.host', '', 'STRING', 'Proxy Host', 'Host address of the corporate proxy server', 0, 'system', '2026-07-15T20:00:00Z', '2026-07-15T20:00:00Z'),
('s49', 'NETWORK', 'proxy.port', '8080', 'INTEGER', 'Proxy Port', 'Port of the corporate proxy server', 0, 'system', '2026-07-15T20:00:00Z', '2026-07-15T20:00:00Z'),
('s50', 'NETWORK', 'proxy.username', '', 'STRING', 'Proxy Username', 'Username for corporate proxy authentication (optional)', 0, 'system', '2026-07-15T20:00:00Z', '2026-07-15T20:00:00Z'),
('s51', 'NETWORK', 'proxy.password', '', 'STRING', 'Proxy Password', 'Password for corporate proxy authentication (optional)', 0, 'system', '2026-07-15T20:00:00Z', '2026-07-15T20:00:00Z'),
('s52', 'NETWORK', 'proxy.nonProxyHosts', 'localhost,127.0.0.1', 'STRING', 'Bypass Proxy Hosts', 'Comma-separated list of hosts that bypass the proxy', 0, 'system', '2026-07-15T20:00:00Z', '2026-07-15T20:00:00Z'),
('s53', 'NETWORK', 'proxy.type', 'HTTP', 'STRING', 'Proxy Type', 'Type of the proxy (HTTP or SOCKS5)', 0, 'system', '2026-07-15T20:00:00Z', '2026-07-15T20:00:00Z'),

('s54', 'SECURITY', 'orion.ssl.enabled', 'false', 'BOOLEAN', 'Enable HTTPS for Orion', 'Configure Orion server to run securely under HTTPS', 1, 'system', '2026-07-15T20:00:00Z', '2026-07-15T20:00:00Z'),
('s55', 'SECURITY', 'orion.ssl.keystore.base64', '', 'STRING', 'Orion SSL Keystore Base64', 'Base64 encoded keystore file (PKCS12 / JKS)', 1, 'system', '2026-07-15T20:00:00Z', '2026-07-15T20:00:00Z'),
('s56', 'SECURITY', 'orion.ssl.keystore.password', '', 'STRING', 'Orion SSL Keystore Password', 'Password for the server SSL keystore', 1, 'system', '2026-07-15T20:00:00Z', '2026-07-15T20:00:00Z'),
('s57', 'SECURITY', 'orion.ssl.keystore.type', 'PKCS12', 'STRING', 'Orion SSL Keystore Type', 'Type of the server SSL keystore (PKCS12 or JKS)', 1, 'system', '2026-07-15T20:00:00Z', '2026-07-15T20:00:00Z'),
('s58', 'SECURITY', 'orion.ssl.key.alias', '', 'STRING', 'Orion SSL Key Alias', 'Alias of the key within the server keystore', 1, 'system', '2026-07-15T20:00:00Z', '2026-07-15T20:00:00Z');
