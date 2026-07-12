import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { 
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Button, Input, Textarea, Badge, Switch, Select
} from '../../components/ui';
import { 
  Globe, Loader2, Save, Sliders, Shield, Activity, Mail, Trash2, 
  Download, Upload, RefreshCw, Server, Users, Layers, AlertCircle, AlertTriangle, Wrench
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
  const [activeTab, setActiveTab] = useState<'general' | 'security' | 'execution' | 'email' | 'maintenance' | 'tools'>('general');
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

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
    refetchInterval: activeTab === 'maintenance' ? 5000 : false, // Poll only on maintenance tab
  });

  // Set initial local values
  useEffect(() => {
    if (settings) {
      const vals: Record<string, string> = {};
      settings.forEach(s => {
        vals[s.settingKey] = s.settingValue;
      });
      setLocalValues(vals);
      setIsDirty(false);
    }
  }, [settings]);

  // Mutations
  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      await api.put(`/admin/settings/${key}`, { settingValue: value });
    },
  });

  const saveAllSettings = async () => {
    if (!settings) return;
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
        fetchPublicSettings(); // Update public store settings
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

  const restartMutation = useMutation({
    mutationFn: async () => {
      await api.post('/admin/maintenance/restart');
    },
    onSuccess: () => {
      toast.warning('Restart signal sent. System is restarting...', { duration: 8000 });
    },
    onError: () => {
      toast.error('Failed to trigger system restart.');
    },
  });

  const clearScreenshotsMutation = useMutation({
    mutationFn: async () => {
      await api.post('/admin/maintenance/clear-screenshots');
    },
    onSuccess: () => {
      toast.success('Screenshot storage directories purged.');
    },
  });

  const purgeExecutionsMutation = useMutation({
    mutationFn: async () => {
      await api.post('/admin/maintenance/purge-executions');
    },
    onSuccess: () => {
      toast.success('Old execution runs metadata successfully purged.');
    },
  });

  const handleInputChange = (key: string, val: string) => {
    setLocalValues(prev => {
      const next = { ...prev, [key]: val };
      setIsDirty(true);
      return next;
    });
  };

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
      toast.error('Export configuration failed.');
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

  // Group settings by active tab category
  const filteredSettings = settings?.filter(
    s => s.category.toLowerCase() === activeTab
  ) || [];

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center">
            <Sliders className="mr-2 h-7 w-7 text-primary" />
            System Administration Settings
          </h1>
          <p className="text-muted-foreground mt-1">Configure backend core system properties and default values</p>
        </div>
      </div>

      {/* Restart Alert Banner */}
      {diagnostics?.pendingRestart && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start space-x-3 text-amber-400">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="text-sm flex-1">
            <span className="font-semibold">Pending Restart:</span> Some modified configuration settings require a system restart to take effect.
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              if (window.confirm('Gracefully restart Spring Boot application context? This will interrupt active executions.')) {
                restartMutation.mutate();
              }
            }}
            className="text-amber-400 hover:bg-amber-500/20 h-7 text-xs py-0"
          >
            Restart Server
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-secondary/35 p-1 rounded-lg border border-border/50 shrink-0 w-full overflow-x-auto">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${activeTab === 'general' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Globe className="h-3.5 w-3.5" />
          <span>General</span>
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${activeTab === 'security' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Shield className="h-3.5 w-3.5" />
          <span>Security & Auth</span>
        </button>
        <button
          onClick={() => setActiveTab('execution')}
          className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${activeTab === 'execution' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Activity className="h-3.5 w-3.5" />
          <span>Execution Engine</span>
        </button>
        <button
          onClick={() => setActiveTab('email')}
          className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${activeTab === 'email' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Mail className="h-3.5 w-3.5" />
          <span>Email Server</span>
        </button>
        <button
          onClick={() => setActiveTab('tools')}
          className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${activeTab === 'tools' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Wrench className="h-3.5 w-3.5" />
          <span>Tools Management</span>
        </button>
        <button
          onClick={() => setActiveTab('maintenance')}
          className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${activeTab === 'maintenance' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Server className="h-3.5 w-3.5" />
          <span>Maintenance</span>
        </button>
      </div>

      {activeTab !== 'maintenance' ? (
        <Card className="border border-border/50 bg-card/20 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold capitalize">{activeTab} Configs</CardTitle>
              <CardDescription>Update values using save controls below</CardDescription>
            </div>
            {isDirty && (
              <Button onClick={saveAllSettings} size="sm" className="h-8">
                <Save className="h-3.5 w-3.5 mr-1" />
                Save Changes
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredSettings.map(s => {
                const currentVal = localValues[s.settingKey] || '';
                return (
                  <div key={s.id} className="space-y-2 border-b border-border/20 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-foreground">{s.displayName}</label>
                      {s.requiresRestart && (
                        <Badge variant="warning" className="text-[9px] py-0 px-1 font-bold">requires restart</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{s.description}</p>
                    
                    {s.valueType === 'BOOLEAN' ? (
                      <div className="pt-1">
                        <Switch
                          checked={currentVal === 'true'}
                          onChange={(e: any) => handleInputChange(s.settingKey, e.target.checked ? 'true' : 'false')}
                        />
                      </div>
                    ) : s.settingKey === 'ui.theme_default' ? (
                      <Select
                        value={currentVal}
                        onChange={(e) => handleInputChange(s.settingKey, e.target.value)}
                        options={[
                          { value: 'dark', label: 'Dark Mode' },
                          { value: 'light', label: 'Light Mode' }
                        ]}
                      />
                    ) : s.settingKey === 'saml.idp.verification_cert' ? (
                      <Textarea
                        value={currentVal}
                        onChange={(e) => handleInputChange(s.settingKey, e.target.value)}
                        className="text-xs font-mono min-h-[100px] bg-background border-border/30"
                        placeholder="-----BEGIN CERTIFICATE-----\n..."
                      />
                    ) : s.settingKey === 'user.default_role' ? (
                      <Select
                        value={currentVal}
                        onChange={(e) => handleInputChange(s.settingKey, e.target.value)}
                        options={[
                          { value: 'TESTER', label: 'Tester' },
                          { value: 'VIEWER', label: 'Viewer' }
                        ]}
                      />
                    ) : s.settingKey.includes('logging') ? (
                      <Select
                        value={currentVal}
                        onChange={(e) => handleInputChange(s.settingKey, e.target.value)}
                        options={[
                          { value: 'TRACE', label: 'Trace' },
                          { value: 'DEBUG', label: 'Debug' },
                          { value: 'INFO', label: 'Info' },
                          { value: 'WARN', label: 'Warn' },
                          { value: 'ERROR', label: 'Error' }
                        ]}
                      />
                    ) : (
                      <Input
                        type={s.valueType === 'INTEGER' ? 'number' : 'text'}
                        value={currentVal}
                        onChange={(e) => handleInputChange(s.settingKey, e.target.value)}
                        className="text-xs font-mono h-9"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Maintenance Tab */
        <div className="space-y-6">
          {/* Diagnostics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="glass cursor-default">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Uptime</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-foreground">
                  {diagLoading ? '...' : formatUptime(diagnostics?.uptimeSeconds || 0)}
                </div>
              </CardContent>
            </Card>

            <Card className="glass cursor-default">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Used Memory</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-foreground">
                  {diagLoading ? '...' : formatBytes(diagnostics?.usedMemoryBytes || 0)}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Total JVM allocated: {formatBytes(diagnostics?.totalMemoryBytes || 0)}
                </div>
              </CardContent>
            </Card>

            <Card className="glass cursor-default">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Platform Database Records</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-foreground flex items-center space-x-1.5">
                  <Activity className="h-5 w-5 text-primary" />
                  <span>{diagLoading ? '...' : diagnostics?.totalExecutionsCount || 0} Runs</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Users: {diagnostics?.totalUsersCount || 0} | Applications: {diagnostics?.totalApplicationsCount || 0}
                </div>
              </CardContent>
            </Card>

            <Card className="glass cursor-default">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Parallel Thread Capacity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-foreground">
                  {diagLoading ? '...' : `${diagnostics?.activeExecutionsCount} / ${diagnostics?.maxExecutionsConcurrency}`}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Queue size limit: 1,000 runs
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Config Settings JSON Operations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border border-border/50 bg-card/20">
              <CardHeader>
                <CardTitle className="text-base font-bold">Import / Export Configuration</CardTitle>
                <CardDescription>Bulk backup and transfer of all system configurations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" size="sm" onClick={handleExport}>
                    <Download className="h-4 w-4 mr-1.5" />
                    Export settings.json
                  </Button>
                  <label className="inline-flex items-center justify-center rounded-md font-medium transition-colors cursor-pointer border border-border bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3 text-xs">
                    <Upload className="h-4 w-4 mr-1.5" />
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

            {/* Maintenance Destructive Actions */}
            <Card className="border border-border/50 bg-card/20">
              <CardHeader>
                <CardTitle className="text-base font-bold text-destructive">Destructive Actions</CardTitle>
                <CardDescription>Purge logs, cache, or trigger server processes</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    if (window.confirm('Delete all recorded execution logs older than auto-cleanup limits? This cannot be undone.')) {
                      purgeExecutionsMutation.mutate();
                    }
                  }}
                  className="hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Purge Runs
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    if (window.confirm('Wipe all browser automation screenshot files from backend storage?')) {
                      clearScreenshotsMutation.mutate();
                    }
                  }}
                  className="hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Clear Screenshots
                </Button>

                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    if (window.confirm('Are you sure you want to gracefully restart the backend application?')) {
                      restartMutation.mutate();
                    }
                  }}
                  className="hover:bg-amber-500/10 hover:text-amber-500 text-muted-foreground"
                >
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Restart Server
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSettingsPage;
