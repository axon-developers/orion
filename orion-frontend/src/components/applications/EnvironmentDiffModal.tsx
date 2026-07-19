import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Dialog, DialogHeader, DialogTitle, DialogFooter, Button, Badge, Select } from '../ui';
import { ArrowRightLeft, CheckCircle2, Copy, AlertTriangle, RefreshCw } from 'lucide-react';
import { EnvironmentDto, EnvironmentDiffDto } from '../../types/api';
import { toast } from 'sonner';

interface EnvironmentDiffModalProps {
  appId: string;
  environments: EnvironmentDto[];
  isOpen: boolean;
  onClose: () => void;
}

export const EnvironmentDiffModal: React.FC<EnvironmentDiffModalProps> = ({
  appId,
  environments,
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const [sourceId, setSourceId] = useState<string>(environments[0]?.id || '');
  const [targetId, setTargetId] = useState<string>(environments[1]?.id || environments[0]?.id || '');

  const { data: diff, isLoading, refetch } = useQuery<EnvironmentDiffDto>({
    queryKey: ['env-diff', appId, sourceId, targetId],
    queryFn: async () => {
      if (!sourceId || !targetId || sourceId === targetId) return null as any;
      const res = await api.get(`/applications/${appId}/environments/diff?sourceId=${sourceId}&targetId=${targetId}`);
      return res.data;
    },
    enabled: isOpen && !!sourceId && !!targetId && sourceId !== targetId,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/applications/${appId}/environments/sync-missing?sourceId=${sourceId}&targetId=${targetId}`);
    },
    onSuccess: () => {
      toast.success('Missing variables copied to target environment!');
      queryClient.invalidateQueries({ queryKey: ['environments', appId] });
      refetch();
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message || 'Failed to sync variables');
    },
  });

  const envOptions = environments.map((e) => ({
    value: e.id,
    label: e.name + (e.isDefault ? ' (Default)' : ''),
  }));

  return (
    <Dialog isOpen={isOpen} onClose={onClose} size="3xl">
      <DialogHeader>
        <DialogTitle className="flex items-center space-x-2">
          <ArrowRightLeft className="h-5 w-5 text-primary" />
          <span>Compare & Sync Environments</span>
        </DialogTitle>
      </DialogHeader>

      <div className="p-6 space-y-6">
        {/* Environment Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-secondary/10 p-4 rounded-lg border border-border/30">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Source Environment
            </label>
            <Select options={envOptions} value={sourceId} onChange={(e) => setSourceId(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Target Environment
            </label>
            <Select options={envOptions} value={targetId} onChange={(e) => setTargetId(e.target.value)} />
          </div>
        </div>

        {sourceId === targetId ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            Select two different environments to see diffs and missing keys.
          </div>
        ) : isLoading ? (
          <div className="text-center py-12 text-sm text-muted-foreground flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
            <span>Comparing environment variables...</span>
          </div>
        ) : diff ? (
          <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-1">
            {/* Summary badges */}
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="text-xs py-1 px-3">
                Missing in Target: <strong className="ml-1 text-amber-400">{diff.missingKeysInTarget.length}</strong>
              </Badge>
              <Badge variant="outline" className="text-xs py-1 px-3">
                Missing in Source: <strong className="ml-1 text-cyan-400">{diff.missingKeysInSource.length}</strong>
              </Badge>
              <Badge variant="outline" className="text-xs py-1 px-3">
                Value Mismatches: <strong className="ml-1 text-rose-400">{diff.mismatchedValueKeys.length}</strong>
              </Badge>
            </div>

            {/* Missing in target list */}
            {diff.missingKeysInTarget.length > 0 && (
              <div className="border border-amber-500/20 rounded-lg p-4 bg-amber-500/5 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Keys Present in {diff.sourceEnvName} but Missing in {diff.targetEnvName}</span>
                  </h4>
                  <Button
                    size="sm"
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-7 px-3 space-x-1.5"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy All to {diff.targetEnvName}</span>
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {diff.missingKeysInTarget.map((v) => (
                    <div
                      key={v.key}
                      className="text-xs bg-background/60 border border-border/40 rounded px-3 py-1.5 flex justify-between items-center"
                    >
                      <span className="font-mono font-bold text-foreground">{v.key}</span>
                      <span className="text-muted-foreground truncate max-w-[200px]">{v.isSecret ? '••••••••' : v.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mismatched values */}
            {diff.mismatchedValueKeys.length > 0 && (
              <div className="border border-rose-500/20 rounded-lg p-4 bg-rose-500/5 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center space-x-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Value Mismatches (Same Key, Different Values)</span>
                </h4>
                <div className="space-y-1.5">
                  {diff.mismatchedValueKeys.map((key) => (
                    <div
                      key={key}
                      className="text-xs bg-background/60 border border-border/40 rounded px-3 py-1.5 flex justify-between items-center"
                    >
                      <span className="font-mono font-bold text-foreground">{key}</span>
                      <Badge variant="secondary" className="text-[10px]">Values Differ</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {diff.missingKeysInTarget.length === 0 && diff.mismatchedValueKeys.length === 0 && (
              <div className="text-center py-12 text-sm text-emerald-400 font-bold flex flex-col items-center justify-center space-y-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                <span>Environments are perfectly synchronized!</span>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </Dialog>
  );
};
