import React from 'react';
import { Input, Select, Textarea } from '../../ui';
import { Code } from 'lucide-react';
import { toast } from 'sonner';
import { parseCurl } from '../StepConfigPanel';
import { TestStepDto } from '../../../types/api';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../ui';
import { EmbeddedAssertions } from './EmbeddedAssertions';
import { SetVariableConfig } from './SetVariableConfig';

interface HttpRequestConfigProps {
  step: TestStepDto;
  updateStep: (id: string, updates: Partial<TestStepDto>) => void;
  handleConfigChange: (key: string, value: any) => void;
  certOptions: { value: string; label: string }[];
  baseFields?: React.ReactNode;
}

export const HttpRequestConfig: React.FC<HttpRequestConfigProps> = ({
  step,
  updateStep,
  handleConfigChange,
  certOptions,
  baseFields
}) => {
  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="grid w-full grid-cols-4 mb-4">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
        <TabsTrigger value="assertions">Assertions</TabsTrigger>
        <TabsTrigger value="variables">Variables</TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="space-y-4 mt-0">
        {baseFields}
        <div className="p-3 bg-secondary/25 rounded-lg border border-border/50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center space-x-1">
              <Code className="h-3.5 w-3.5 text-primary" />
              <span>Import from cURL</span>
            </span>
          </div>
          <Textarea
            placeholder="Paste curl command here... e.g. curl -X POST https://example.com -d '...'"
            rows={2}
            className="font-mono text-[11px] bg-background/50"
            onChange={(e) => {
              const curl = e.target.value;
              if (curl.trim().startsWith('curl')) {
                try {
                  const parsed = parseCurl(curl);
                  const newConfig = {
                    ...step.config,
                    method: parsed.method,
                    url: parsed.url,
                    headers: parsed.headers,
                    bodyType: parsed.bodyType,
                    body: parsed.body
                  };
                  updateStep(step.id, { config: newConfig });
                  e.target.value = '';
                  toast.success('Successfully imported cURL!');
                } catch (err: any) {
                  toast.error('Failed to parse cURL: ' + err.message);
                }
              }
            }}
          />
          <p className="text-[9px] text-muted-foreground leading-normal">
            Paste any valid <code>curl</code> command to automatically pre-populate request properties.
          </p>
        </div>

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

      <div className="space-y-1.5 pb-4">
        <label className="text-xs font-semibold uppercase text-muted-foreground">Request URL <span className="text-destructive">*</span></label>
        <Input
          placeholder="e.g. {{baseUrl}}/api/users"
          value={step.config.url || ''}
          onChange={(e) => handleConfigChange('url', e.target.value)}
        />
        <p className="text-[10px] text-muted-foreground">Supports variable interpolation e.g. <code>{"{{baseUrl}}"}</code></p>
      </div>
    </TabsContent>

    <TabsContent value="settings" className="space-y-4 mt-0">

      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase text-muted-foreground">HTTP Headers (JSON)</label>
        <Textarea
          placeholder='e.g. { "Accept": "application/json", "Authorization": "Bearer {{token}}" }'
          value={step.config.headers ? (typeof step.config.headers === 'object' ? JSON.stringify(step.config.headers, null, 2) : step.config.headers) : ''}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              handleConfigChange('headers', parsed);
            } catch {
              handleConfigChange('headers', e.target.value);
            }
          }}
          rows={4}
          className="font-mono text-xs"
        />
        <p className="text-[10px] text-muted-foreground">Specify request headers as a JSON object. Supports variable interpolation.</p>
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

      <div className="grid grid-cols-2 gap-3 pb-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Timeout (ms)</label>
          <Input
            type="number"
            value={step.config.timeoutMs || 30000}
            onChange={(e) => handleConfigChange('timeoutMs', parseInt(e.target.value) || 30000)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Client Cert Override</label>
          <Select
            options={certOptions}
            value={step.config.clientCertKey || ''}
            onChange={(e) => handleConfigChange('clientCertKey', e.target.value)}
          />
        </div>
      </div>
    </TabsContent>

    <TabsContent value="assertions" className="mt-0">
      <EmbeddedAssertions step={step} handleConfigChange={handleConfigChange} />
    </TabsContent>

    <TabsContent value="variables" className="mt-0">
      <SetVariableConfig step={step} handleConfigChange={handleConfigChange} />
    </TabsContent>
  </Tabs>
  );
};
