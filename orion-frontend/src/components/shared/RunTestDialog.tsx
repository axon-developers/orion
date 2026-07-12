import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { Dialog, DialogHeader, DialogTitle, DialogFooter, Button, Select } from '../ui';
import { Play, Loader2, CheckCircle2, XCircle, Terminal } from 'lucide-react';
import { EnvironmentDto } from '../../types/api';
import { toast } from 'sonner';
import { useWorkflowStore } from '../../stores/workflow-store';

interface RunTestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  appId: string;
  testCaseId: string;
  testCaseName: string;
  stepIds?: string[];
}

export const RunTestDialog: React.FC<RunTestDialogProps> = ({ 
  isOpen, 
  onClose, 
  appId, 
  testCaseId, 
  testCaseName,
  stepIds
}) => {
  const navigate = useNavigate();
  const { setRunningExecutionId } = useWorkflowStore();
  const [selectedEnvId, setSelectedEnvId] = useState('');
  
  // Execution states for single step inline verification
  const [execId, setExecId] = useState<string | null>(null);
  const [execStatus, setExecStatus] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasAutoTriggered, setHasAutoTriggered] = useState(false);

  const isPartialRun = stepIds && stepIds.length > 0;

  // Fetch environments for this app
  const { data: environments, isLoading } = useQuery<EnvironmentDto[]>({
    queryKey: ['environments', appId],
    queryFn: async () => {
      const res = await api.get(`/applications/${appId}/environments`);
      return res.data;
    },
    enabled: isOpen && !!appId,
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const preferredId = selectedEnvId || environments?.find(e => e.isDefault)?.id || environments?.find(e => e.isActive)?.id || environments?.[0]?.id;
      if (!preferredId) {
        throw new Error('No environment available');
      }
      const res = await api.post('/executions', {
        testCaseId,
        environmentId: preferredId,
        stepIds: stepIds && stepIds.length > 0 ? stepIds : undefined,
      });
      return res.data;
    },
    onSuccess: (data) => {
      if (isPartialRun) {
        setExecId(data.id);
        setExecStatus(data.status || 'QUEUED');
        toast.info('Verification run started');
      } else {
        toast.success('Test run triggered successfully');
        onClose();
        navigate(`/executions/${data.id}`);
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to trigger test run');
    },
  });

  // Poll status & logs for single-step inline verification run
  React.useEffect(() => {
    if (!execId || !execStatus || !isPartialRun) return;
    const isTerminal = ['PASSED', 'FAILED', 'ERROR', 'CANCELLED'].includes(execStatus);
    if (isTerminal) return;

    const intervalId = setInterval(async () => {
      try {
        const [detailRes, logsRes] = await Promise.all([
          api.get(`/executions/${execId}`),
          api.get(`/executions/${execId}/logs`)
        ]);

        const status = detailRes.data.status;
        setExecStatus(status);
        setLogs(logsRes.data || []);
        if (detailRes.data.errorMessage) {
          setErrorMessage(detailRes.data.errorMessage);
        }

        if (['PASSED', 'FAILED', 'ERROR', 'CANCELLED'].includes(status)) {
          clearInterval(intervalId);
          // Purge the temporary single-step verification run from DB history
          try {
            await api.delete(`/executions/${execId}`);
          } catch (e) {
            // fail-silent on cleanup delete
          }
        }
      } catch (err) {
        clearInterval(intervalId);
      }
    }, 800);

    return () => clearInterval(intervalId);
  }, [execId, execStatus, isPartialRun]);

  // Automatically select the default or active environment when loaded, and auto-trigger on partial runs
  React.useEffect(() => {
    if (environments && environments.length > 0) {
      const preferred = environments.find(e => e.isDefault) || environments.find(e => e.isActive) || environments[0];
      setSelectedEnvId(preferred.id);

      // Auto-trigger partial runs on mount if default env is available
      const defaultEnv = environments.find(e => e.isDefault);
      if (isOpen && isPartialRun && !execId && !hasAutoTriggered && defaultEnv) {
        setHasAutoTriggered(true);
        runMutation.mutate();
      }
    }
  }, [environments, isOpen, isPartialRun, execId, hasAutoTriggered]);

  const handleClose = () => {
    setExecId(null);
    setExecStatus(null);
    setLogs([]);
    setErrorMessage(null);
    setHasAutoTriggered(false);
    onClose();
  };

  const envOptions = (environments || []).map(e => ({
    value: e.id,
    label: `${e.name} ${e.isActive ? '(Active)' : '(Inactive)'}`
  }));

  const isTerminalState = execStatus && ['PASSED', 'FAILED', 'ERROR', 'CANCELLED'].includes(execStatus);

  return (
    <Dialog isOpen={isOpen} onClose={handleClose}>
      <DialogHeader>
        <DialogTitle className="flex items-center">
          {execId ? (
            <Terminal className="mr-2 h-5 w-5 text-primary" />
          ) : (
            <Play className="mr-2 h-5 w-5 text-primary fill-primary/20" />
          )}
          {execId 
            ? 'Verification Step Console'
            : stepIds && stepIds.length > 0 
              ? `Run Selected Steps (${stepIds.length})` 
              : 'Run Test Case'
          }
        </DialogTitle>
      </DialogHeader>

      {execId ? (
        /* Inline Terminal execution view */
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider pb-1 border-b border-border/20">
            <span>Status:</span>
            <span className={`inline-flex items-center gap-1.5 font-extrabold ${
              execStatus === 'PASSED' 
                ? 'text-emerald-400' 
                : ['FAILED', 'ERROR'].includes(execStatus || '') 
                  ? 'text-rose-400' 
                  : 'text-cyan-400 animate-pulse'
            }`}>
              {execStatus === 'PASSED' && <CheckCircle2 className="h-3.5 w-3.5" />}
              {['FAILED', 'ERROR'].includes(execStatus || '') && <XCircle className="h-3.5 w-3.5" />}
              {!isTerminalState && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {execStatus}
            </span>
          </div>

          <div className="bg-[#0f172a] text-[#f8fafc] p-4 rounded-xl font-mono text-xs overflow-y-auto max-h-[220px] min-h-[140px] border border-border/30 shadow-2xl space-y-2 scrollbar-thin">
            {logs.map((logItem, idx) => (
              <div key={idx} className="flex flex-col space-y-1">
                <div className="flex items-center justify-between text-[#8b949e] text-[10px] border-b border-[#21262d] pb-0.5 mb-0.5">
                  <span className="font-bold">Step Run Log</span>
                  <span className={logItem.status === 'PASSED' ? 'text-emerald-400' : 'text-rose-400'}>
                    {logItem.status}
                  </span>
                </div>
                <div className="text-[#c9d1d9] leading-relaxed break-words whitespace-pre-wrap">
                  {logItem.errorMessage ? (
                    <span className="text-rose-400 font-semibold">Error: {logItem.errorMessage}</span>
                  ) : (
                    <span>Execution completed successfully in {logItem.durationMs || 0}ms.</span>
                  )}
                </div>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-muted-foreground select-none italic text-center py-8">
                Awaiting console output stream...
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 font-semibold">
              {errorMessage}
            </div>
          )}
        </div>
      ) : (
        /* Standard target environment selection view */
        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Select target deployment environment to run {stepIds && stepIds.length > 0 ? 'selected steps from' : ''} <span className="font-semibold text-foreground">"{testCaseName}"</span>:
          </p>

          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : envOptions.length === 0 ? (
            <div className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md p-3">
              No environments found for this application. Please create an environment first.
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Environment</label>
              <Select
                options={envOptions}
                value={selectedEnvId}
                onChange={(e) => setSelectedEnvId(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      <DialogFooter>
        {execId ? (
          <Button onClick={handleClose} disabled={!isTerminalState}>
            {!isTerminalState ? 'Running...' : 'Close'}
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button 
              onClick={() => runMutation.mutate()} 
              disabled={runMutation.isPending || !selectedEnvId}
            >
              {runMutation.isPending ? 'Starting...' : 'Trigger Run'}
            </Button>
          </>
        )}
      </DialogFooter>
    </Dialog>
  );
};
export default RunTestDialog;
