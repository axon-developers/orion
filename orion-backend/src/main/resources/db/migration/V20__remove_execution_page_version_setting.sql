-- V20: Remove ui.execution_page_version setting
DELETE FROM system_settings WHERE setting_key = 'ui.execution_page_version';
