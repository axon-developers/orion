-- Seed Proxy and Server SSL Settings
INSERT INTO system_settings (id, category, setting_key, setting_value, value_type, display_name, description, requires_restart, updated_by, created_at, updated_at) VALUES
('s47', 'NETWORK', 'proxy.enabled', 'false', 'BOOLEAN', 'Enable System Proxy', 'Route HTTP, SOAP, GraphQL, and Browser automation requests through a corporate proxy', 0, 'system', '2026-07-15T20:00:00Z', '2026-07-15T20:00:00Z'),
('s48', 'NETWORK', 'proxy.host', '', 'STRING', 'Proxy Host', 'Host address of the corporate proxy server (e.g. proxy.company.com)', 0, 'system', '2026-07-15T20:00:00Z', '2026-07-15T20:00:00Z'),
('s49', 'NETWORK', 'proxy.port', '8080', 'INTEGER', 'Proxy Port', 'Port of the corporate proxy server', 0, 'system', '2026-07-15T20:00:00Z', '2026-07-15T20:00:00Z'),
('s50', 'NETWORK', 'proxy.username', '', 'STRING', 'Proxy Username', 'Username for corporate proxy authentication (optional)', 0, 'system', '2026-07-15T20:00:00Z', '2026-07-15T20:00:00Z'),
('s51', 'NETWORK', 'proxy.password', '', 'STRING', 'Proxy Password', 'Password for corporate proxy authentication (optional)', 0, 'system', '2026-07-15T20:00:00Z', '2026-07-15T20:00:00Z'),
('s52', 'NETWORK', 'proxy.nonProxyHosts', 'localhost,127.0.0.1', 'STRING', 'Bypass Proxy Hosts', 'Comma-separated list of hosts that bypass the proxy (e.g. localhost,*.internal.company.com)', 0, 'system', '2026-07-15T20:00:00Z', '2026-07-15T20:00:00Z'),
('s53', 'NETWORK', 'proxy.type', 'HTTP', 'STRING', 'Proxy Type', 'Type of the proxy: HTTP or SOCKS5', 0, 'system', '2026-07-15T20:00:00Z', '2026-07-15T20:00:00Z'),

-- NOTE: s54-s58 are retained for reference only. Server SSL is now driven by
-- bundled JKS keystores in src/main/resources/security/ (see application.yml server.ssl.*).
-- To use a custom certificate replace orion-keystore.jks / orion-truststore.jks and restart,
-- or set SSL_KEY_STORE / SSL_TRUST_STORE env vars in production.
('s54', 'SECURITY', 'orion.ssl.enabled', 'false', 'BOOLEAN', '[Deprecated] Enable HTTPS via DB', 'SSL is now configured via bundled JKS keystores in resources/security/. Use server.ssl.* in application-prod.yml instead.', 1, 'system', '2026-07-15T20:00:00Z', '2026-07-15T20:00:00Z'),
('s55', 'SECURITY', 'orion.ssl.keystore.base64', '', 'STRING', '[Deprecated] SSL Keystore Base64', 'No longer used. Replace orion-keystore.jks in resources/security/ to change the certificate.', 1, 'system', '2026-07-15T20:00:00Z', '2026-07-15T20:00:00Z'),
('s56', 'SECURITY', 'orion.ssl.keystore.password', '', 'STRING', '[Deprecated] SSL Keystore Password', 'No longer used. Set orion.ssl.key-store-password in application.yml or SSL_KEY_STORE_PASSWORD env var.', 1, 'system', '2026-07-15T20:00:00Z', '2026-07-15T20:00:00Z'),
('s57', 'SECURITY', 'orion.ssl.keystore.type', 'PKCS12', 'STRING', '[Deprecated] SSL Keystore Type', 'No longer used. Keystore type is JKS, configured in application.yml.', 1, 'system', '2026-07-15T20:00:00Z', '2026-07-15T20:00:00Z'),
('s58', 'SECURITY', 'orion.ssl.key.alias', '', 'STRING', '[Deprecated] SSL Key Alias', 'No longer used. Key alias is orion, configured in application.yml.', 1, 'system', '2026-07-15T20:00:00Z', '2026-07-15T20:00:00Z');