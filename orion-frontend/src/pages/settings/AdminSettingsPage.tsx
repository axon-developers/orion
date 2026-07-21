import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { 
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Button, Input, Textarea, Badge, Switch, Select
} from '../../components/ui';
import { 
  Globe, Loader2, Save, Sliders, Shield, Activity, Mail, Trash2, 
  Download, Upload, RefreshCw, Server, AlertTriangle, Wrench, Info, Check, Copy, Settings, FileCode
} from 'lucide-react';
import { toast } from 'sonner';
import { useSystemSettingsStore } from '../../stores/system-settings-store';

interface SystemSettingDto {
  id: string;
  category: string;
  settingKey: string;
  settingValue: string;
  valueType: string;
  displayName: string;
  description: string;
  requiresRestart: boolean;
  updatedBy: string;
  updatedAt: string;
}

interface SystemDiagnosticsDto {
  uptimeSeconds: number;
  totalMemoryBytes: number;
  freeMemoryBytes: number;
  usedMemoryBytes: number;
  activeExecutionsCount: number;
  maxExecutionsConcurrency: number;
  queuedExecutionsCount: number;
  totalUsersCount: number;
  totalApplicationsCount: number;
  totalExecutionsCount: number;
  pendingRestart: boolean;
}

export const AdminSettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { fetchPublicSettings } = useSystemSettingsStore();
  const [activeTab, setActiveTab] = useState<'general' | 'network' | 'security' | 'execution' | 'email' | 'tools' | 'maintenance'>('general');
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showDeprecatedSsl, setShowDeprecatedSsl] = useState(false);

  // Fetch all settings
  const { data: settings, isLoading: settingsLoading } = useQuery<SystemSettingDto[]>({
    queryKey: ['admin-settings-all'],
    queryFn: async () => {
      const res = await api.get('/admin/settings');
      return res.data;
    },
  });

  // Fetch diagnostics
  const { data: diagnostics, isLoading: diagLoading } = useQuery<SystemDiagnosticsDto>({
    queryKey: ['admin-diagnostics'],
    queryFn: async () => {
      const res = await api.get('/admin/diagnostics');
      return res.data;
    },
    refetchInterval: activeTab === 'maintenance' ? 5000 : false,
  });

  // Set initial local values and clear errors
  useEffect(() => {
    if (settings) {
      const vals: Record<string, string> = {};
      settings.forEach(s => {
        vals[s.settingKey] = s.settingValue;
      });
      setLocalValues(vals);
      setValidationErrors({});
      setIsDirty(false);
    }
  }, [settings]);

  // Mutation to update system settings
  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      await api.put(`/admin/settings/${key}`, { settingValue: value });
    },
  });

  const validateSetting = (key: string, value: string): string | null => {
    if (value.trim() === '') {
      return 'Value cannot be empty.';
    }

    const isInt = (val: string) => /^-?\d+$/.test(val);
    const intVal = parseInt(value, 10);

    switch (key) {
      case 'ui.default_page_size':
        if (!isInt(value) || intVal < 5 || intVal > 100) return 'Must be an integer between 5 and 100.';
        break;
      case 'ui.dashboard_poll_interval_ms':
        if (!isInt(value) || intVal < 1000 || intVal > 600000) return 'Must be an integer between 1,000ms (1s) and 600,000ms (10m).';
        break;
      case 'ui.inactivity_timeout_minutes':
        if (!isInt(value) || intVal < 1 || intVal > 1440) return 'Must be an integer between 1 and 1,440 minutes (24h).';
        break;
      case 'security.bcrypt_rounds':
        if (!isInt(value) || intVal < 4 || intVal > 31) return 'BCrypt rounds strength must be between 4 and 31 (recommended: 10-14).';
        break;
      case 'security.password_min_length':
        if (!isInt(value) || intVal < 6 || intVal > 64) return 'Minimum password length must be between 6 and 64.';
        break;
      case 'security.max_login_attempts':
        if (!isInt(value) || intVal < 1 || intVal > 20) return 'Must be between 1 and 20 attempts.';
        break;
      case 'security.lockout_duration_minutes':
        if (!isInt(value) || intVal < 1 || intVal > 1440) return 'Must be between 1 and 1,440 minutes.';
        break;
      case 'security.jwt_access_token_expiry_ms':
        if (!isInt(value) || intVal < 60000) return 'Access token expiry must be at least 60,000 ms (1 minute).';
        break;
      case 'security.jwt_refresh_token_expiry_ms':
        if (!isInt(value) || intVal < 60000) return 'Refresh token expiry must be at least 60,000 ms (1 minute).';
        break;
      case 'execution.thread_pool_core_size':
        if (!isInt(value) || intVal < 1 || intVal > 128) return 'Core concurrency must be between 1 and 128.';
        break;
      case 'execution.thread_pool_max_size':
        if (!isInt(value) || intVal < 1 || intVal > 256) return 'Max concurrency pool must be between 1 and 256.';
        break;
      case 'execution.thread_pool_queue_capacity':
        if (!isInt(value) || intVal < 1 || intVal > 10000) return 'Queue size limit must be between 1 and 10,000.';
        break;
      case 'execution.max_parallel_browsers':
        if (!isInt(value) || intVal < 1 || intVal > 32) return 'Simultaneous browsers must be between 1 and 32.';
        break;
      case 'execution.default_step_timeout_ms':
        if (!isInt(value) || intVal < 1000 || intVal > 300000) return 'Timeout threshold must be between 1,000ms (1s) and 300,000ms (5m).';
        break;
      case 'execution.auto_cleanup_days':
        if (!isInt(value) || intVal < 0) return 'Cleanup age in days must be 0 (disable) or a positive integer.';
        break;
      case 'email.smtp_port':
        if (!isInt(value) || intVal < 1 || intVal > 65535) return 'Port number must be between 1 and 65,535.';
        break;
      case 'proxy.port':
        if (!isInt(value) || intVal < 1 || intVal > 65535) return 'Port number must be between 1 and 65,535.';
        break;
    }
    return null;
  };

  const handleInputChange = (key: string, val: string) => {
    setLocalValues(prev => ({ ...prev, [key]: val }));
    setIsDirty(true);

    const err = validateSetting(key, val);
    setValidationErrors(prev => {
      const next = { ...prev };
      if (err) {
        next[key] = err;
      } else {
        delete next[key];
      }
      return next;
    });
  };

  // Check if save is blocked due to any invalid inputs
  const hasErrors = Object.keys(validationErrors).length > 0;

  const saveAllSettings = async () => {
    if (!settings || hasErrors) return;
    const savePromise = new Promise<void>(async (resolve, reject) => {
      try {
        for (const setting of settings) {
          const localVal = localValues[setting.settingKey];
          if (localVal !== setting.settingValue) {
            await updateSettingMutation.mutateAsync({ key: setting.settingKey, value: localVal });
          }
        }
        queryClient.invalidateQueries({ queryKey: ['admin-settings-all'] });
        queryClient.invalidateQueries({ queryKey: ['admin-diagnostics'] });
        fetchPublicSettings();
        setIsDirty(false);
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    toast.promise(savePromise, {
      loading: 'Saving configuration changes...',
      success: 'System settings saved successfully!',
      error: 'Failed to update system settings.',
    });
  };

  // Maintenance Actions
  const restartMutation = useMutation({
    mutationFn: async () => {
      await api.post('/admin/maintenance/restart');
    },
    onSuccess: () => {
      toast.warning('Restart signal sent. Server container is restarting...', { duration: 8000 });
    },
    onError: () => {
      toast.error('Failed to trigger server restart.');
    },
  });

  const clearScreenshotsMutation = useMutation({
    mutationFn: async () => {
      await api.post('/admin/maintenance/clear-screenshots');
    },
    onSuccess: () => {
      toast.success('Screenshot storage directory purged successfully.');
    },
  });

  const purgeExecutionsMutation = useMutation({
    mutationFn: async () => {
      await api.post('/admin/maintenance/purge-executions');
    },
    onSuccess: () => {
      toast.success('Execution logs and metadata purged successfully.');
    },
  });

  const handleExport = async () => {
    try {
      const res = await api.get('/admin/settings/export');
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `orion-settings-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch {
      toast.error('Export configuration template failed.');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    const importPromise = api.post('/admin/settings/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings-all'] });
      fetchPublicSettings();
    });

    toast.promise(importPromise, {
      loading: 'Uploading settings template...',
      success: 'Configuration settings imported successfully!',
      error: 'Failed to parse configuration template.',
    });
  };

  // Formatting utils
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    return parts.join(' ') || `${seconds}s`;
  };

  const getMsDescription = (msStr: string) => {
    const ms = parseInt(msStr, 10);
    if (isNaN(ms)) return '';
    if (ms < 1000) return `${ms} ms`;
    const sec = ms / 1000;
    if (sec < 60) return `~${sec.toFixed(1)} seconds`;
    const min = sec / 60;
    if (min < 60) return `~${min.toFixed(1)} minutes`;
    const hr = min / 60;
    if (hr < 24) return `~${hr.toFixed(1)} hours`;
    const day = hr / 24;
    return `~${day.toFixed(1)} days`;
  };

  // Group schema definition
  const TABS_SCHEMA = useMemo(() => [
    {
      id: 'general' as const,
      label: 'General Settings',
      icon: <Globe className="h-4 w-4" />,
      groups: [
        {
          title: 'Platform Identity',
          description: 'Brand configurations shown on headers, taglines, and login forms.',
          settingKeys: ['platform.name', 'platform.tagline']
        },
        {
          title: 'User Interface Preset Defaults',
          description: 'Visual presets and default values for lists, theme, and animations.',
          settingKeys: ['ui.default_page_size', 'ui.dashboard_poll_interval_ms', 'ui.theme_default', 'ui.sidebar_default_collapsed', 'ui.notification_position']
        },
        {
          title: 'User Access & Session Management',
          description: 'Configure self-registration rules, default user role, and session inactivity limits.',
          settingKeys: ['user.default_role', 'user.self_registration_enabled', 'ui.inactivity_timeout_minutes']
        }
      ]
    },
    {
      id: 'network' as const,
      label: 'Network & Proxy',
      icon: <Server className="h-4 w-4 text-cyan-400" />,
      groups: [
        {
          title: 'Corporate Proxy Configuration',
          description: 'Route outbound requests (HTTP, SOAP, GraphQL, and Browser automation) through a corporate proxy.',
          settingKeys: ['proxy.enabled', 'proxy.type', 'proxy.host', 'proxy.port']
        },
        {
          title: 'Proxy Credentials & Bypass',
          description: 'Credentials and address targets that bypass proxy routing.',
          settingKeys: ['proxy.username', 'proxy.password', 'proxy.nonProxyHosts']
        }
      ]
    },
    {
      id: 'security' as const,
      label: 'Security & Auth',
      icon: <Shield className="h-4 w-4" />,
      groups: [
        {
          title: 'Access Token Expiration',
          description: 'Keep-alive and inactivity lifetimes for user auth tokens.',
          settingKeys: ['security.jwt_access_token_expiry_ms', 'security.jwt_refresh_token_expiry_ms']
        },
        {
          title: 'Password Strength Policy',
          description: 'BCrypt hashing rounds strength and minimum password requirements.',
          settingKeys: ['security.bcrypt_rounds', 'security.password_min_length']
        },
        {
          title: 'Brute-Force & Account Lockout',
          description: 'Suspend accounts temporarily after consecutive failures.',
          settingKeys: ['security.max_login_attempts', 'security.lockout_duration_minutes']
        },
        {
          title: 'CORS Security Settings',
          description: 'Allowed origin hostnames allowed to request resources.',
          settingKeys: ['security.cors_allowed_origins']
        },
        {
          title: 'Outbound SSL Validation Policy',
          description: 'Skip server TLS certificate validation error check for outbound requests (similar to Postman).',
          settingKeys: ['orion.ssl.skip_verification']
        }
      ]
    },
    {
      id: 'execution' as const,
      label: 'Execution Engine',
      icon: <Activity className="h-4 w-4" />,
      groups: [
        {
          title: 'Browser Automation Execution Engine',
          description: 'Choose the execution engine for Browser Automation test steps: Native Playwright Java (default) or Cucumber-JS (Node.js BDD scenario runner).',
          settingKeys: ['execution.browser_executor_engine']
        },
        {
          title: 'Concurrency Thread Pools',
          description: 'Control core and max workers processing automation steps in parallel.',
          settingKeys: ['execution.thread_pool_core_size', 'execution.thread_pool_max_size', 'execution.thread_pool_queue_capacity', 'execution.max_parallel_browsers']
        },
        {
          title: 'Timeout & Retry Rules',
          description: 'Limits and recovery triggers for failing automation steps.',
          settingKeys: ['execution.default_step_timeout_ms', 'execution.retry_on_failure']
        },
        {
          title: 'Storage & History Clean-up',
          description: 'Wipe screenshot files and older executions logs automatically.',
          settingKeys: ['execution.screenshot_storage_path', 'execution.auto_cleanup_days']
        }
      ]
    },
    {
      id: 'email' as const,
      label: 'Email Server',
      icon: <Mail className="h-4 w-4" />,
      groups: [
        {
          title: 'SMTP Connection Parameters',
          description: 'Standard parameters to connect to corporate mail relays.',
          settingKeys: ['email.smtp_host', 'email.smtp_port', 'email.smtp_starttls', 'email.smtp_auth']
        },
        {
          title: 'SMTP Credentials',
          description: 'Provide authentication credentials if SMTP Auth is enabled.',
          settingKeys: ['email.smtp_username', 'email.smtp_password']
        },
        {
          title: 'Notification Default Settings',
          description: 'Default recipient list and automatic failure alert notifications.',
          settingKeys: ['email.sender_address', 'email.notify_on_failure', 'email.notify_recipients']
        }
      ]
    },
    {
      id: 'tools' as const,
      label: 'Tools Management',
      icon: <Wrench className="h-4 w-4" />,
      groups: [
        {
          title: 'Browser Automation & Playwright Features',
          description: 'Configure availability of playwright generator tools and database query validation tools.',
          settingKeys: ['tools.playwright_generator.enabled', 'tools.db_query_validator.enabled']
        }
      ]
    }
  ], []);

  // Compute lookup maps
  const settingsByKeys = useMemo(() => {
    const map: Record<string, SystemSettingDto> = {};
    settings?.forEach(s => {
      map[s.settingKey] = s;
    });
    return map;
  }, [settings]);

  // Deprecated configuration list
  const deprecatedSslSettings = useMemo(() => {
    return settings?.filter(s => s.settingKey.startsWith('orion.ssl.') && s.settingKey !== 'orion.ssl.skip_verification') || [];
  }, [settings]);

  // Find proxy.enabled state to conditionally disable fields
  const isProxyEnabled = localValues['proxy.enabled'] === 'true';
  const isSmtpAuthRequired = localValues['email.smtp_auth'] === 'true';

  const isFieldDisabled = (key: string) => {
    // Proxy field dependency
    if (['proxy.type', 'proxy.host', 'proxy.port', 'proxy.username', 'proxy.password', 'proxy.nonProxyHosts'].includes(key)) {
      return !isProxyEnabled;
    }
    // SMTP field dependency
    if (['email.smtp_username', 'email.smtp_password'].includes(key)) {
      return !isSmtpAuthRequired;
    }
    // Deprecated fields are always disabled
    if (key.startsWith('orion.ssl.') && key !== 'orion.ssl.skip_verification') {
      return true;
    }
    return false;
  };

  // Active Schema Definition
  const currentTabSchema = TABS_SCHEMA.find(t => t.id === activeTab);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center">
            <Settings className="mr-3 h-8 w-8 text-primary animate-spin-slow" />
            System Administration Settings
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage corporate proxy rules, security parameters, SMTP channels, thread executors, and platform variables.
          </p>
        </div>
        
        {/* Sticky Actions */}
        {activeTab !== 'maintenance' && isDirty && (
          <div className="flex items-center space-x-3 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-settings-all'] })} className="text-xs">
              Discard
            </Button>
            <Button onClick={saveAllSettings} disabled={hasErrors} size="sm" className="h-9 font-semibold">
              <Save className="h-4 w-4 mr-1.5" />
              Save Configuration
            </Button>
          </div>
        )}
      </div>

      {/* Restart Alert Banner */}
      {diagnostics?.pendingRestart && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start space-x-3 text-amber-400">
          <Info className="h-5 w-5 shrink-0 mt-0.5 text-amber-500" />
          <div className="text-sm flex-1">
            <span className="font-semibold">Pending Restart:</span> One or more modified configuration settings require a server context reload.
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              if (window.confirm('Gracefully restart Spring Boot application context? Active executions will be interrupted.')) {
                restartMutation.mutate();
              }
            }}
            className="text-amber-400 hover:bg-amber-500/20 border-amber-500/30 h-8 text-xs py-0"
          >
            Restart server
          </Button>
        </div>
      )}

      {/* Main Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Navigation Sidebar */}
        <div className="lg:col-span-3 space-y-2">
          <div className="bg-card/30 border border-border/40 p-2 rounded-xl flex flex-row lg:flex-col overflow-x-auto lg:overflow-visible shrink-0 scrollbar-none gap-1">
            {TABS_SCHEMA.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-3 w-full px-4 py-3 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
            <button
              onClick={() => setActiveTab('maintenance')}
              className={`flex items-center space-x-3 w-full px-4 py-3 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'maintenance' 
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              }`}
            >
              <Server className="h-4 w-4" />
              <span>Maintenance & Log Level</span>
            </button>
          </div>
          {isDirty && hasErrors && (
            <div className="text-[11px] text-destructive font-semibold px-2 py-1.5 flex items-center bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertTriangle className="h-3 w-3 mr-1 shrink-0" />
              Correct configuration errors to save.
            </div>
          )}
        </div>

        {/* Configurations View Area */}
        <div className="lg:col-span-9 space-y-6">
          {activeTab !== 'maintenance' && currentTabSchema ? (
            <div className="space-y-6">
              {currentTabSchema.groups.map((group, groupIdx) => {
                // Ensure there are settings mapped for this group
                const groupSettings = group.settingKeys
                  .map(key => settingsByKeys[key])
                  .filter(Boolean);

                if (groupSettings.length === 0) return null;

                return (
                  <Card key={groupIdx} className="border border-border/40 bg-card/10 backdrop-blur-sm shadow-sm hover:border-border/60 transition-all duration-200">
                    <CardHeader className="border-b border-border/30 pb-4">
                      <CardTitle className="text-base font-bold tracking-tight text-foreground">{group.title}</CardTitle>
                      <CardDescription className="text-xs text-muted-foreground mt-0.5">{group.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        {groupSettings.map(s => {
                          const currentVal = localValues[s.settingKey] || '';
                          const isDisabled = isFieldDisabled(s.settingKey);
                          const err = validationErrors[s.settingKey];
                          const hasUnitHelper = s.settingKey.includes('_ms');

                          return (
                            <div key={s.id} className={`space-y-2.5 transition-opacity duration-200 ${isDisabled ? 'opacity-40 pointer-events-none' : ''}`}>
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                                  {s.displayName}
                                  {isDisabled && (
                                    <span className="text-[10px] lowercase text-muted-foreground font-normal italic">(disabled)</span>
                                  )}
                                </label>
                                {s.requiresRestart && (
                                  <Badge variant="warning" className="text-[9px] py-0 px-1 font-bold">requires restart</Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-normal min-h-[32px]">{s.description}</p>
                              
                              <div className="relative">
                                {s.valueType === 'BOOLEAN' ? (
                                  <div className="pt-1.5">
                                    <Switch
                                      checked={currentVal === 'true'}
                                      disabled={isDisabled}
                                      onChange={(e: any) => handleInputChange(s.settingKey, e.target.checked ? 'true' : 'false')}
                                    />
                                  </div>
                                ) : s.settingKey === 'ui.theme_default' ? (
                                  <Select
                                    value={currentVal}
                                    disabled={isDisabled}
                                    onChange={(e) => handleInputChange(s.settingKey, e.target.value)}
                                    options={[
                                      { value: 'dark', label: 'Dark Theme (Default)' },
                                      { value: 'light', label: 'Light Theme' }
                                    ]}
                                    className="text-xs font-medium"
                                  />
                                ) : s.settingKey === 'execution.browser_executor_engine' ? (
                                  <Select
                                    value={currentVal}
                                    disabled={isDisabled}
                                    onChange={(e) => handleInputChange(s.settingKey, e.target.value)}
                                    options={[
                                      { value: 'PLAYWRIGHT_JAVA', label: 'Native Playwright (Java Engine - Default)' },
                                      { value: 'CUCUMBER_JS', label: 'Cucumber-JS (Node.js BDD Runner)' }
                                    ]}
                                    className="text-xs font-medium"
                                  />
                                ) : s.settingKey === 'ui.notification_position' ? (
                                  <div className="pt-1 max-w-[280px]">
                                    <div className="grid grid-cols-3 gap-2 bg-background/50 border border-border/30 p-2 rounded-lg">
                                      {[
                                        'top-left', 'top-center', 'top-right',
                                        'middle-left', 'middle-center', 'middle-right',
                                        'bottom-left', 'bottom-center', 'bottom-right'
                                      ].map(pos => {
                                        const isActive = currentVal === pos;
                                        const labelParts = pos.split('-');
                                        return (
                                          <button
                                            key={pos}
                                            type="button"
                                            disabled={isDisabled}
                                            onClick={() => handleInputChange(s.settingKey, pos)}
                                            className={`h-11 rounded border flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold tracking-wider cursor-pointer transition-all hover:scale-[1.03] ${
                                              isActive
                                                ? 'bg-primary/10 border-primary text-primary shadow-inner'
                                                : 'border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                                            }`}
                                            title={`Show notifications at ${labelParts[0]} ${labelParts[1]}`}
                                          >
                                            <div className={`h-1.5 w-1.5 rounded-full ${
                                              isActive ? 'bg-primary animate-pulse' : 'bg-muted-foreground/30'
                                            }`} />
                                            <span className="capitalize">{labelParts[0]} {labelParts[1]}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : s.settingKey === 'saml.idp.verification_cert' ? (
                                  <Textarea
                                    value={currentVal}
                                    disabled={isDisabled}
                                    onChange={(e) => handleInputChange(s.settingKey, e.target.value)}
                                    className="text-xs font-mono min-h-[100px] bg-background border-border/30"
                                    placeholder="-----BEGIN CERTIFICATE-----\n..."
                                  />
                                ) : s.settingKey === 'user.default_role' ? (
                                  <Select
                                    value={currentVal}
                                    disabled={isDisabled}
                                    onChange={(e) => handleInputChange(s.settingKey, e.target.value)}
                                    options={[
                                      { value: 'TESTER', label: 'Tester (Manage/run tests)' },
                                      { value: 'VIEWER', label: 'Viewer (Read-only views)' }
                                    ]}
                                    className="text-xs font-medium"
                                  />
                                ) : s.settingKey === 'proxy.type' ? (
                                  <Select
                                    value={currentVal}
                                    disabled={isDisabled}
                                    onChange={(e) => handleInputChange(s.settingKey, e.target.value)}
                                    options={[
                                      { value: 'HTTP', label: 'HTTP / HTTPS Corporate Proxy' },
                                      { value: 'SOCKS5', label: 'SOCKS5 Protocol Proxy' }
                                    ]}
                                    className="text-xs font-medium"
                                  />
                                ) : s.settingKey.includes('password') ? (
                                  <Input
                                    type="password"
                                    value={currentVal}
                                    disabled={isDisabled}
                                    onChange={(e) => handleInputChange(s.settingKey, e.target.value)}
                                    className={`text-xs font-mono h-9 bg-background ${err ? 'border-destructive focus-visible:ring-destructive' : 'border-border/40'}`}
                                  />
                                ) : (
                                  <Input
                                    type={s.valueType === 'INTEGER' ? 'number' : 'text'}
                                    value={currentVal}
                                    disabled={isDisabled}
                                    onChange={(e) => handleInputChange(s.settingKey, e.target.value)}
                                    className={`text-xs font-mono h-9 bg-background ${err ? 'border-destructive focus-visible:ring-destructive' : 'border-border/40'}`}
                                  />
                                )}
                              </div>

                              {/* Unit / Friendly Helpers */}
                              {hasUnitHelper && !err && currentVal && (
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                                  <Info className="h-3 w-3 text-primary/70 shrink-0" />
                                  <span>Calculated interval: <strong className="text-foreground">{getMsDescription(currentVal)}</strong></span>
                                </div>
                              )}

                              {/* Error Indicators */}
                              {err && (
                                <div className="text-[10px] text-destructive font-semibold mt-1 flex items-center bg-destructive/5 py-1 px-2 rounded border border-destructive/10 animate-in slide-in-from-top-1 duration-150">
                                  <AlertTriangle className="h-3 w-3 mr-1 shrink-0" />
                                  {err}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Deprecated Configuration collapsed container in Security */}
              {activeTab === 'security' && deprecatedSslSettings.length > 0 && (
                <Card className="border border-amber-500/10 bg-amber-500/[0.02]">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4" />
                        Deprecated DB-Based SSL Configurations
                      </CardTitle>
                      <CardDescription className="text-[11px] text-muted-foreground mt-0.5">
                        SSL configurations are now driven statically by server JKS resource files.
                      </CardDescription>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setShowDeprecatedSsl(!showDeprecatedSsl)}
                      className="text-xs text-muted-foreground h-8"
                    >
                      {showDeprecatedSsl ? 'Hide details' : 'Show details'}
                    </Button>
                  </CardHeader>
                  {showDeprecatedSsl && (
                    <CardContent className="space-y-4 pt-3 border-t border-amber-500/10">
                      <div className="p-3 bg-amber-500/5 rounded-lg text-[11px] text-muted-foreground leading-relaxed">
                        ⚠️ **Notice:** These fields are locked. The platform server-side TLS and trustStore properties are now defined inside backend resources/security files (`orion-keystore.jks` / `orion-truststore.jks`) to ensure complete protection for database queries and outbound HTTP connections.
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {deprecatedSslSettings.map(s => (
                          <div key={s.id} className="space-y-1.5 opacity-60">
                            <label className="text-[10px] font-bold uppercase tracking-wide text-foreground">{s.displayName}</label>
                            <Input
                              disabled
                              value={s.settingValue ? '*** [Configured in JKS file]' : '(Empty)'}
                              className="text-xs h-8 bg-background border-border/30 cursor-not-allowed"
                            />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}
            </div>
          ) : (
            /* Maintenance & Logs Tab */
            <div className="space-y-6">
              
              {/* Server Logs configuration */}
              <Card className="border border-border/40 bg-card/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-base font-bold">Application Logging Configurations</CardTitle>
                  <CardDescription>Adjust the printing detail verbosity of backend systems (Root, Orion custom app, and SQL binding statements).</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {['logging.root_level', 'logging.orion_level', 'logging.sql_level'].map(key => {
                    const s = settingsByKeys[key];
                    if (!s) return null;
                    const currentVal = localValues[key] || 'INFO';
                    return (
                      <div key={s.id} className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-foreground">{s.displayName}</label>
                        <Select
                          value={currentVal}
                          onChange={(e) => handleInputChange(s.settingKey, e.target.value)}
                          options={[
                            { value: 'TRACE', label: 'TRACE (Verbose)' },
                            { value: 'DEBUG', label: 'DEBUG (Development)' },
                            { value: 'INFO', label: 'INFO (Normal)' },
                            { value: 'WARN', label: 'WARN (Warning only)' },
                            { value: 'ERROR', label: 'ERROR (Critical errors)' }
                          ]}
                          className="text-xs font-medium"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1 leading-normal">{s.description}</p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* System Diagnostics Dashboard */}
              <Card className="border border-border/40 bg-card/10 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold">System Diagnostics</CardTitle>
                    <CardDescription>Real-time JVM health and threads metadata statistics.</CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-diagnostics'] })}
                    className="h-8 text-xs"
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Refresh
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-background/40 border border-border/30 p-4 rounded-xl">
                      <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-1">JVM Uptime</div>
                      <div className="text-xl font-extrabold text-foreground">
                        {diagLoading ? '...' : formatUptime(diagnostics?.uptimeSeconds || 0)}
                      </div>
                    </div>

                    <div className="bg-background/40 border border-border/30 p-4 rounded-xl">
                      <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-1">JVM Allocated Memory</div>
                      <div className="text-xl font-extrabold text-foreground">
                        {diagLoading ? '...' : formatBytes(diagnostics?.usedMemoryBytes || 0)}
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-1">
                        Allocated limits: {formatBytes(diagnostics?.totalMemoryBytes || 0)}
                      </div>
                    </div>

                    <div className="bg-background/40 border border-border/30 p-4 rounded-xl">
                      <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-1">Platform Capacity</div>
                      <div className="text-xl font-extrabold text-foreground">
                        {diagLoading ? '...' : `${diagnostics?.activeExecutionsCount} / ${diagnostics?.maxExecutionsConcurrency}`}
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-1">
                        Active / Max Concurrent workers
                      </div>
                    </div>

                    <div className="bg-background/40 border border-border/30 p-4 rounded-xl">
                      <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-1">Metadata Records</div>
                      <div className="text-xl font-extrabold text-foreground flex items-center space-x-1.5">
                        <Activity className="h-5 w-5 text-primary shrink-0" />
                        <span>{diagLoading ? '...' : diagnostics?.totalExecutionsCount || 0} Runs</span>
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-1">
                        Users: {diagnostics?.totalUsersCount || 0} | Apps: {diagnostics?.totalApplicationsCount || 0}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Configuration Template bulk backups */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border border-border/40 bg-card/10 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold">Import / Export JSON Settings</CardTitle>
                    <CardDescription>Bulk backup, transfer, and recover all system configurations.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Backup system configurations in a single template file to transfer keys across development, test, and production environments.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button variant="outline" size="sm" onClick={handleExport} className="text-xs font-semibold">
                        <Download className="h-4 w-4 mr-1.5" />
                        Export settings.json
                      </Button>
                      <label className="inline-flex items-center justify-center rounded-md font-semibold transition-colors cursor-pointer border border-border bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 text-xs">
                        <Upload className="h-4 w-4 mr-1.5 text-muted-foreground" />
                        Import settings.json
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleImport}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </CardContent>
                </Card>

                {/* OpenAPI Spec Card */}
                <Card className="border border-cyan-500/30 bg-cyan-500/5 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-cyan-400 flex items-center gap-2">
                      <FileCode className="h-5 w-5 text-cyan-400" />
                      OpenAPI 3.0.3 Specification & API Docs
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Track available REST API endpoints, schemas, parameters, and download the raw openapi.yaml.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Server className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Backend Endpoint:</span>
                      <code className="text-cyan-300 font-mono bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/30">/api/openapi.yaml</code>
                    </div>
                    <Link to="/help">
                      <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs">
                        Open OpenAPI Explorer in Help
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                {/* Destructive Maintenance Controls */}
                <Card className="border border-border/40 bg-card/10 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-destructive flex items-center gap-1.5">
                      <AlertTriangle className="h-5 w-5" />
                      Destructive System Operations
                    </CardTitle>
                    <CardDescription>Purge runs, wipe screenshot folders, or reload backend Spring container processes.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-3">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          if (window.confirm('Delete all recorded execution logs older than auto-cleanup limits? This action is permanent.')) {
                            purgeExecutionsMutation.mutate();
                          }
                        }}
                        className="hover:bg-destructive/10 hover:text-destructive text-muted-foreground text-xs font-semibold border-border/40"
                      >
                        <Trash2 className="h-4 w-4 mr-1.5" />
                        Purge Runs logs
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          if (window.confirm('Wipe all browser automation screenshot files from backend storage?')) {
                            clearScreenshotsMutation.mutate();
                          }
                        }}
                        className="hover:bg-destructive/10 hover:text-destructive text-muted-foreground text-xs font-semibold border-border/40"
                      >
                        <Trash2 className="h-4 w-4 mr-1.5" />
                        Wipe Screenshots
                      </Button>

                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          if (window.confirm('Wipe all caches and gracefully reload the backend process context? Active executions will stop.')) {
                            restartMutation.mutate();
                          }
                        }}
                        className="hover:bg-amber-500/10 hover:text-amber-500 text-muted-foreground text-xs font-semibold border-border/40"
                      >
                        <RefreshCw className="h-4 w-4 mr-1.5" />
                        Restart Server Context
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsPage;
