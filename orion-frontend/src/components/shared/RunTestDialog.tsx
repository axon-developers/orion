import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { Dialog, DialogHeader, DialogTitle, DialogFooter, Button, Select } from '../ui';
import { Play, Loader2 } from 'lucide-react';
import { EnvironmentDto } from '../../types/api';
import { toast } from 'sonner';

interface RunTestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  appId: string;
  testCaseId: string;
  testCaseName: string;
}

export const RunTestDialog: React.FC<RunTestDialogProps> = ({ 
  isOpen, 
  onClose, 
  appId, 
  testCaseId, 
  testCaseName 
}) => {
  const navigate = useNavigate();
  const [selectedEnvId, setSelectedEnvId] = useState('');

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
      const res = await api.post('/executions', {
        testCaseId,
        environmentId: selectedEnvId,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success('Test run triggered successfully');
      onClose();
      // Redirect to the execution page to watch real-time updates!
      navigate(`/executions/${data.id}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to trigger test run');
    },
  });

  // Automatically select the first environment when loaded
  React.useEffect(() => {
    if (environments && environments.length > 0) {
      // Find default active one or pick first
      const active = environments.find(e => e.isActive) || environments[0];
      setSelectedEnvId(active.id);
    }
  }, [environments]);

  const envOptions = (environments || []).map(e => ({
    value: e.id,
    label: `${e.name} ${e.isActive ? '(Active)' : '(Inactive)'}`
  }));

  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <DialogHeader>
        <DialogTitle className="flex items-center">
          <Play className="mr-2 h-5 w-5 text-primary fill-primary/20" />
          Run Test Case
        </DialogTitle>
      </DialogHeader>
      <div className="p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Select target deployment environment to run <span className="font-semibold text-foreground">"{testCaseName}"</span>:
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
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button 
          onClick={() => runMutation.mutate()} 
          disabled={runMutation.isPending || !selectedEnvId}
        >
          {runMutation.isPending ? 'Starting...' : 'Trigger Run'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
};
export default RunTestDialog;
