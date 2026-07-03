import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Input, Textarea, Select } from '../../components/ui';
import { ArrowLeft, Save, Loader2, Settings, Code, Terminal, CheckCircle2 } from 'lucide-react';
import { GlobalTestStepDto } from '../../types/api';
import { toast } from 'sonner';

export const GlobalTestStepFormPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isEdit = !!id;

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [stepType, setStepType] = useState('HTTP_REQUEST');
  const [actionType, setActionType] = useState('NONE');
  const [config, setConfig] = useState<any>({});

  // Fetch step if editing
  const { data: step, isLoading } = useQuery<GlobalTestStepDto>({
    queryKey: ['global-step', id],
    queryFn: async () => {
      const res = await api.get(`/global/test-steps/${id}`);
      return res.data;
    },
    enabled: isEdit,
  });

  // Sync form states
  useEffect(() => {
    if (step) {
      setName(step.name);
      setDescription(step.description || '');
      setStepType(step.stepType);
      setActionType(step.actionType);
      setConfig(step.config || {});
    }
  }, [step]);

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        description,
        stepType,
        actionType,
        config,
      };

      if (isEdit) {
        await api.put(`/global/test-steps/${id}`, payload);
      } else {
        await api.post('/global/test-steps', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-steps-list'] });
      toast.success(isEdit ? 'Global test step updated' : 'Global test step created');
      navigate('/global/test-steps');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to save global test step');
    },
  });

  const handleConfigChange = (key: string, val: any) => {
    setConfig({ ...config, [key]: val });
  };

  const renderConfigFields = () => {
    switch (stepType) {
      case 'HTTP_REQUEST':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">HTTP Method</label>
                <Select
                  options={[
                    { value: 'GET', label: 'GET' },
                    { value: 'POST', label: 'POST' },
                    { value: 'PUT', label: 'PUT' },
                    { value: 'DELETE', label: 'DELETE' },
                    { value: 'PATCH', label: 'PATCH' },
                  ]}
                  value={config.method || 'GET'}
                  onChange={(e) => {
                    handleConfigChange('method', e.target.value);
                    setActionType(e.target.value); // Sync actionType
                  }}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Request URL</label>
                <Input
                  placeholder="e.g. {{baseUrl}}/api/login"
                  value={config.url || ''}
                  onChange={(e) => handleConfigChange('url', e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Request Body (JSON)</label>
              <Textarea
                placeholder='e.g. { "username": "{{username}}", "password": "{{password}}" }'
                value={typeof config.body === 'object' ? JSON.stringify(config.body, null, 2) : config.body || ''}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    handleConfigChange('body', parsed);
                  } catch {
                    handleConfigChange('body', e.target.value);
                  }
                }}
                rows={6}
                className="font-mono text-xs"
              />
            </div>
          </div>
        );

      case 'ASSERTION':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Source</label>
                <Select
                  options={[
                    { value: 'RESPONSE_BODY', label: 'Response Body (JSON)' },
                    { value: 'STATUS_CODE', label: 'HTTP Status Code' },
                    { value: 'RESPONSE_HEADER', label: 'HTTP Header' },
                  ]}
                  value={config.source || 'RESPONSE_BODY'}
                  onChange={(e) => handleConfigChange('source', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Operator</label>
                <Select
                  options={[
                    { value: 'EQUALS', label: 'Equals' },
                    { value: 'NOT_EQUALS', label: 'Not Equals' },
                    { value: 'CONTAINS', label: 'Contains' },
                    { value: 'GREATER_THAN', label: 'Greater Than' },
                    { value: 'LESS_THAN', label: 'Less Than' },
                  ]}
                  value={config.operator || 'EQUALS'}
                  onChange={(e) => {
                    handleConfigChange('operator', e.target.value);
                    setActionType(e.target.value); // Sync actionType
                  }}
                />
              </div>
            </div>

            {config.source === 'RESPONSE_BODY' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">JSONPath Selector</label>
                <Input
                  placeholder="e.g. $.token"
                  value={config.jsonPath || ''}
                  onChange={(e) => handleConfigChange('jsonPath', e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Expected Value</label>
              <Input
                placeholder="Value or {{variable}} placeholder..."
                value={config.expectedValue || ''}
                onChange={(e) => handleConfigChange('expectedValue', e.target.value)}
              />
            </div>
          </div>
        );

      case 'DELAY':
        return (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Duration (ms)</label>
            <Input
              type="number"
              value={config.durationMs || 1000}
              onChange={(e) => handleConfigChange('durationMs', parseInt(e.target.value) || 1000)}
            />
          </div>
        );

      default:
        return <div className="text-xs text-muted-foreground py-4">No custom settings required for this step.</div>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-48">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in duration-200">
      <div className="space-y-1">
        <button 
          onClick={() => navigate('/global/test-steps')}
          className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-2 cursor-pointer"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Global Steps
        </button>
        <h1 className="text-3xl font-extrabold tracking-tight">
          {isEdit ? 'Edit Step Template' : 'Create Step Template'}
        </h1>
      </div>

      <Card className="border border-border/50 bg-card/20 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center">
            <Settings className="mr-2 h-5 w-5 text-primary" />
            Basic Properties
          </CardTitle>
          <CardDescription>Define standard templates reusable across multiple application workflows</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Step Name</label>
            <Input
              placeholder="e.g. Standard Authenticator Ping"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Description</label>
            <Textarea
              placeholder="Provide context explaining the reusable step usage..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Step Type</label>
            <Select
              options={[
                { value: 'HTTP_REQUEST', label: 'HTTP Request' },
                { value: 'ASSERTION', label: 'Validation Assertion' },
                { value: 'DELAY', label: 'Delay/Pause' },
              ]}
              value={stepType}
              onChange={(e) => {
                setStepType(e.target.value);
                setConfig({}); // Reset config on change
              }}
              disabled={isEdit} // Disable type edit to prevent runtime schema mismatch
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/50 bg-card/20 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center">
            <Code className="mr-2 h-5 w-5 text-primary" />
            Config Parameter Templates
          </CardTitle>
          <CardDescription>Configure variable values supporting interpolations</CardDescription>
        </CardHeader>
        <CardContent>{renderConfigFields()}</CardContent>
        <CardFooter className="border-t border-border/30 bg-secondary/5 py-4 px-6 flex justify-end space-x-2">
          <Button variant="outline" onClick={() => navigate('/global/test-steps')}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !name.trim()}>
            {saveMutation.isPending ? 'Saving...' : 'Save Step Template'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};
export default GlobalTestStepFormPage;
