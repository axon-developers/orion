import React, { useEffect, useState } from 'react';
import { useWorkflowStore } from '../../stores/workflow-store';
import { Input, Button, Textarea, Select, Switch, Card, CardHeader, CardTitle, CardContent } from '../ui';
import { X, Trash2, HelpCircle, Code, Settings } from 'lucide-react';
import { TestStepDto } from '../../types/api';

export const StepConfigPanel: React.FC = () => {
  const { steps, selectedStepId, selectStep, updateStep, deleteStep } = useWorkflowStore();

  const step = steps.find((s) => s.id === selectedStepId);

  if (!step) return null;

  const handleFieldChange = (field: keyof TestStepDto, value: any) => {
    updateStep(step.id, { [field]: value });
  };

  const handleConfigChange = (key: string, value: any) => {
    const newConfig = { ...step.config, [key]: value };
    updateStep(step.id, { config: newConfig });
  };

  const renderConfigForm = () => {
    switch (step.stepType) {
      case 'HTTP_REQUEST':
        return (
          <div className="space-y-4">
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
                value={step.config.method || 'GET'}
                onChange={(e) => handleConfigChange('method', e.target.value)}
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Request URL</label>
              <Input
                placeholder="e.g. {{baseUrl}}/api/users"
                value={step.config.url || ''}
                onChange={(e) => handleConfigChange('url', e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">Supports variable interpolation e.g. <code>{"{{baseUrl}}"}</code></p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Request Body Type</label>
              <Select
                options={[
                  { value: 'NONE', label: 'None' },
                  { value: 'JSON', label: 'JSON' },
                ]}
                value={step.config.bodyType || 'NONE'}
                onChange={(e) => handleConfigChange('bodyType', e.target.value)}
              />
            </div>

            {step.config.bodyType === 'JSON' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">JSON Body Payload</label>
                <Textarea
                  placeholder='e.g. { "name": "{{testName}}" }'
                  value={typeof step.config.body === 'object' ? JSON.stringify(step.config.body, null, 2) : step.config.body || ''}
                  onChange={(e) => {
                    try {
                      // Attempt to store parsed JSON if valid, else string
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
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Timeout (ms)</label>
              <Input
                type="number"
                value={step.config.timeoutMs || 30000}
                onChange={(e) => handleConfigChange('timeoutMs', parseInt(e.target.value) || 30000)}
              />
            </div>
          </div>
        );

      case 'ASSERTION':
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Target Source</label>
              <Select
                options={[
                  { value: 'RESPONSE_BODY', label: 'Response Body (JSON)' },
                  { value: 'STATUS_CODE', label: 'HTTP Status Code' },
                  { value: 'RESPONSE_HEADER', label: 'HTTP Header' },
                  { value: 'VARIABLE', label: 'Saved Variable' },
                ]}
                value={step.config.source || 'RESPONSE_BODY'}
                onChange={(e) => handleConfigChange('source', e.target.value)}
              />
            </div>

            {step.config.source === 'RESPONSE_BODY' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">JSONPath Selector</label>
                <Input
                  placeholder="e.g. $.data.id"
                  value={step.config.jsonPath || ''}
                  onChange={(e) => handleConfigChange('jsonPath', e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">Extract nested fields via JSONPath expression</p>
              </div>
            )}

            {step.config.source === 'RESPONSE_HEADER' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Header Name</label>
                <Input
                  placeholder="e.g. Content-Type"
                  value={step.config.headerName || ''}
                  onChange={(e) => handleConfigChange('headerName', e.target.value)}
                />
              </div>
            )}

            {step.config.source === 'VARIABLE' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Variable Name</label>
                <Input
                  placeholder="e.g. userId"
                  value={step.config.variableName || ''}
                  onChange={(e) => handleConfigChange('variableName', e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Operator</label>
              <Select
                options={[
                  { value: 'EQUALS', label: 'Equals' },
                  { value: 'NOT_EQUALS', label: 'Not Equals' },
                  { value: 'CONTAINS', label: 'Contains (Substring)' },
                  { value: 'GREATER_THAN', label: 'Greater Than' },
                  { value: 'LESS_THAN', label: 'Less Than' },
                  { value: 'REGEX_MATCH', label: 'Regex Match' },
                ]}
                value={step.config.operator || 'EQUALS'}
                onChange={(e) => {
                  handleConfigChange('operator', e.target.value);
                  handleFieldChange('actionType', e.target.value); // Sync actionType
                }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Expected Value</label>
              <Input
                placeholder="e.g. 200 or active"
                value={step.config.expectedValue || ''}
                onChange={(e) => handleConfigChange('expectedValue', e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Failure Message</label>
              <Input
                placeholder="Message displayed if validation fails..."
                value={step.config.message || ''}
                onChange={(e) => handleConfigChange('message', e.target.value)}
              />
            </div>
          </div>
        );

      case 'SET_VARIABLE':
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Variable Save Key</label>
              <Input
                placeholder="e.g. authToken"
                value={step.config.variableName || ''}
                onChange={(e) => handleConfigChange('variableName', e.target.value)}
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Extraction Source</label>
              <Select
                options={[
                  { value: 'RESPONSE_BODY', label: 'Response Body (JSON)' },
                  { value: 'RESPONSE_HEADER', label: 'Response Header' },
                ]}
                value={step.config.source || 'RESPONSE_BODY'}
                onChange={(e) => handleConfigChange('source', e.target.value)}
              />
            </div>

            {step.config.source === 'RESPONSE_BODY' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">JSONPath Selector</label>
                <Input
                  placeholder="e.g. $.token"
                  value={step.config.jsonPath || ''}
                  onChange={(e) => handleConfigChange('jsonPath', e.target.value)}
                />
              </div>
            )}

            {step.config.source === 'RESPONSE_HEADER' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Header Name</label>
                <Input
                  placeholder="e.g. Authorization"
                  value={step.config.headerName || ''}
                  onChange={(e) => handleConfigChange('headerName', e.target.value)}
                />
              </div>
            )}
          </div>
        );

      case 'DELAY':
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Duration (milliseconds)</label>
              <Input
                type="number"
                placeholder="e.g. 2000"
                value={step.config.durationMs || 1000}
                onChange={(e) => handleConfigChange('durationMs', parseInt(e.target.value) || 1000)}
              />
            </div>
          </div>
        );

      case 'LOG':
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Level</label>
              <Select
                options={[
                  { value: 'INFO', label: 'INFO' },
                  { value: 'WARN', label: 'WARN' },
                  { value: 'DEBUG', label: 'DEBUG' },
                ]}
                value={step.config.level || 'INFO'}
                onChange={(e) => handleConfigChange('level', e.target.value)}
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Log Message</label>
              <Textarea
                placeholder="e.g. Current authentication token: {{authToken}}"
                value={step.config.message || ''}
                onChange={(e) => handleConfigChange('message', e.target.value)}
                rows={3}
              />
            </div>
          </div>
        );

      case 'CONDITIONAL':
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Branch Condition</label>
              <Input
                placeholder="e.g. {{statusCode}} == 200"
                value={step.config.condition || ''}
                onChange={(e) => handleConfigChange('condition', e.target.value)}
              />
            </div>
          </div>
        );

      case 'LOOP':
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Loop Type</label>
              <Select
                options={[
                  { value: 'COUNT', label: 'Fixed Count Iterations' },
                  { value: 'FOR_EACH', label: 'For Each Element' },
                ]}
                value={step.config.type || 'COUNT'}
                onChange={(e) => handleConfigChange('type', e.target.value)}
              />
            </div>
            {step.config.type === 'COUNT' ? (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Iteration Count</label>
                <Input
                  type="number"
                  value={step.config.count || 5}
                  onChange={(e) => handleConfigChange('count', parseInt(e.target.value) || 5)}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Array JSONPath Source</label>
                <Input
                  placeholder="$.users"
                  value={step.config.dataSource || ''}
                  onChange={(e) => handleConfigChange('dataSource', e.target.value)}
                />
              </div>
            )}
          </div>
        );

      case 'DATABASE_QUERY':
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">JDBC Connection String</label>
              <Input
                placeholder="jdbc:sqlite:./orion.db or {{dbUrl}}"
                value={step.config.connectionString || ''}
                onChange={(e) => handleConfigChange('connectionString', e.target.value)}
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">SQL Query Command</label>
              <Textarea
                placeholder="SELECT count(*) FROM users WHERE is_active = 1"
                value={step.config.query || ''}
                onChange={(e) => handleConfigChange('query', e.target.value)}
                rows={5}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Save Result to Variable</label>
              <Input
                placeholder="e.g. activeUsersCount"
                value={step.config.resultVariable || ''}
                onChange={(e) => handleConfigChange('resultVariable', e.target.value)}
              />
            </div>
          </div>
        );

      default:
        return <div className="text-xs text-muted-foreground py-4">No custom settings required for this step.</div>;
    }
  };

  return (
    <aside className="w-80 border-l border-border bg-card text-card-foreground flex flex-col h-full shadow-lg relative z-20">
      <div className="flex items-center justify-between h-14 px-4 border-b border-border">
        <span className="flex items-center space-x-1.5 text-xs font-bold text-foreground">
          <Settings className="h-4 w-4 text-primary" />
          <span>STEP CONFIGURATION</span>
        </span>
        <button 
          onClick={() => selectStep(null)}
          className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Core meta fields */}
        <div className="space-y-3 pb-4 border-b border-border/40">
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase text-muted-foreground">Step Name</label>
            <Input
              value={step.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              className="h-8 py-1 text-sm font-semibold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase text-muted-foreground">Description</label>
            <Textarea
              value={step.description || ''}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              placeholder="Test step brief explanation..."
              rows={2}
              className="text-xs"
            />
          </div>
        </div>

        {/* Custom config sub-form */}
        <div>
          <h4 className="text-[10px] font-extrabold uppercase text-muted-foreground mb-3">Parameters</h4>
          {renderConfigForm()}
        </div>
      </div>

      {/* Footer delete */}
      <div className="p-4 border-t border-border bg-secondary/10 flex justify-end">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => deleteStep(step.id)}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive flex items-center"
        >
          <Trash2 className="mr-1.5 h-4 w-4" />
          Remove Step
        </Button>
      </div>
    </aside>
  );
};
export default StepConfigPanel;
