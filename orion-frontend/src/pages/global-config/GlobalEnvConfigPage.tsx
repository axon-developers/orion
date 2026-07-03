import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { 
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Button, Input, Textarea, Dialog, DialogHeader, DialogTitle, DialogFooter, Switch, Badge
} from '../../components/ui';
import { Plus, Globe, Loader2, Edit2, Trash2, ShieldAlert, Eye, EyeOff, Lock } from 'lucide-react';
import { GlobalEnvConfigDto, PagedResponse } from '../../types/api';
import { toast } from 'sonner';

export const GlobalEnvConfigPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  
  const [isOpen, setIsOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<GlobalEnvConfigDto | null>(null);

  // Form states
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [isSecret, setIsSecret] = useState(false);

  // Fetch configs
  const { data: configData, isLoading } = useQuery<PagedResponse<GlobalEnvConfigDto>>({
    queryKey: ['global-configs', search],
    queryFn: async () => {
      const res = await api.get(`/global/env-configs?page=0&size=100&search=${search}`);
      return res.data;
    },
  });

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (selectedConfig) {
        await api.put(`/global/env-configs/${selectedConfig.id}`, {
          configValue: value,
          description,
          isSecret,
        });
      } else {
        await api.post('/global/env-configs', {
          configKey: key,
          configValue: value,
          description,
          isSecret,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-configs'] });
      setIsOpen(false);
      resetForm();
      toast.success(selectedConfig ? 'Global configuration updated' : 'Global configuration created');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to save configuration');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/global/env-configs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-configs'] });
      toast.success('Global configuration deleted');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete configuration');
    },
  });

  const resetForm = () => {
    setKey('');
    setValue('');
    setDescription('');
    setIsSecret(false);
    setSelectedConfig(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsOpen(true);
  };

  const handleOpenEdit = (cfg: GlobalEnvConfigDto) => {
    setSelectedConfig(cfg);
    setKey(cfg.configKey);
    setValue(cfg.configValue);
    setDescription(cfg.description || '');
    setIsSecret(cfg.secret);
    setIsOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center">
            <Globe className="mr-2 h-7 w-7 text-primary" />
            Global Environment Variables
          </h1>
          <p className="text-muted-foreground mt-1">Shared configurations available across all applications</p>
        </div>
        <Button onClick={handleOpenCreate} className="shrink-0">
          <Plus className="mr-2 h-5 w-5" />
          Add Global Config
        </Button>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start space-x-3 text-amber-400">
        <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="text-sm">
          <span className="font-semibold">Security Note:</span> Global configurations are merged with app-level environment variables at execution time. App-level keys automatically override global variables in the event of name collisions.
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Input
            placeholder="Search global keys..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !configData?.content || configData.content.length === 0 ? (
        <Card className="text-center py-16 border-dashed">
          <Globe className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-bold">No global variables defined</h3>
          <p className="text-muted-foreground max-w-xs mx-auto mt-1">Create organization-wide values like gateway URLs or central auth tokens.</p>
          <Button onClick={handleOpenCreate} className="mt-4">Create Global Config</Button>
        </Card>
      ) : (
        <Card className="border border-border/50 bg-card/20 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/35 text-muted-foreground">
                    <th className="p-4 font-semibold">Key</th>
                    <th className="p-4 font-semibold">Value</th>
                    <th className="p-4 font-semibold">Description</th>
                    <th className="p-4 font-semibold">Created By</th>
                    <th className="p-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {configData.content.map((cfg) => (
                    <tr key={cfg.id} className="hover:bg-secondary/10 transition-colors">
                      <td className="p-4 font-bold text-foreground font-mono">{cfg.configKey}</td>
                      <td className="p-4 font-mono text-xs">
                        {cfg.secret ? (
                          <span className="flex items-center space-x-1.5 text-muted-foreground/80">
                            <Lock className="h-3 w-3" />
                            <span>••••••••</span>
                            <Badge variant="secondary" className="text-[10px] py-0 px-1">secret</Badge>
                          </span>
                        ) : (
                          cfg.configValue
                        )}
                      </td>
                      <td className="p-4 text-muted-foreground truncate max-w-xs">{cfg.description || '--'}</td>
                      <td className="p-4 text-xs text-muted-foreground">{cfg.createdBy}</td>
                      <td className="p-4 text-right space-x-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(cfg)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(cfg.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CREATE & EDIT MODAL */}
      <Dialog isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader>
          <DialogTitle>{selectedConfig ? 'Edit Global Config' : 'Add Global Config'}</DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Key (Variable Name)</label>
            <Input
              placeholder="e.g. AUTH_GATEWAY_URL"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={!!selectedConfig} // Disable key edit on update to avoid conflicts
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Value</label>
            <Input
              type={isSecret ? "password" : "text"}
              placeholder="Enter variable value..."
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              placeholder="Provide a brief explanation of the value usage..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="flex items-center space-x-2 pt-2">
            <Switch
              label="Mask Secret Value (Hides value in API responses)"
              checked={isSecret}
              onChange={(e: any) => setIsSecret(e.target.checked)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !key.trim() || !value.trim()}>
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
};
export default GlobalEnvConfigPage;
