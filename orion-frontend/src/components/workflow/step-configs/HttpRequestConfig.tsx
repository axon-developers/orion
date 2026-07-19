import React from 'react';
import { Input, Select, Textarea } from '../../ui';
import { Code } from 'lucide-react';
import { toast } from 'sonner';
import { parseCurl } from '../StepConfigPanel';
import { TestStepDto } from '../../../types/api';
import { HeaderTableEditor } from './HeaderTableEditor';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../ui';
import { EmbeddedAssertions } from './EmbeddedAssertions';
import { SetVariableConfig } from './SetVariableConfig';

import { VariableAutocompleteInput } from '../VariableAutocompleteInput';

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
      <TabsList className="grid w-full grid-cols-3 mb-4">
        <TabsTrigger value="general">General</TabsTrigger>
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

        <div className="space-y-1.5 pb-2">
          <VariableAutocompleteInput
            label="Request URL *"
            placeholder="e.g. {{baseUrl}}/api/users"
            value={step.config.url || ''}
            onChange={(val) => handleConfigChange('url', val)}
          />
          <p className="text-[10px] text-muted-foreground">Type <code>{"{{"}</code> to trigger variable autocomplete.</p>
        </div>

        <div className="space-y-1.5">
          <HeaderTableEditor
            headers={step.config.headers}
            onChange={(val) => handleConfigChange('headers', val)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Request Body Type</label>
          <Select
            options={[
              { value: 'NONE', label: 'None' },
              { value: 'JSON', label: 'JSON' },
              { value: 'FORM_URLENCODED', label: 'Form URL Encoded' },
              { value: 'TEXT', label: 'Plain Text' },
              { value: 'XML', label: 'XML' },
            ]}
            value={step.config.bodyType || 'NONE'}
            onChange={(e) => handleConfigChange('bodyType', e.target.value)}
          />
        </div>

        {step.config.bodyType && step.config.bodyType !== 'NONE' && (
          <div className="space-y-1.5">
            <VariableAutocompleteInput
              label={`${step.config.bodyType} Body Payload`}
              multiline
              rows={6}
              placeholder={
                step.config.bodyType === 'JSON' ? 'e.g. { "name": "{{testName}}" }' :
                step.config.bodyType === 'FORM_URLENCODED' ? 'e.g. key1=value1&key2={{myVariable}}' :
                step.config.bodyType === 'XML' ? 'e.g. <xml><name>{{testName}}</name></xml>' : 'Request payload body...'
              }
              value={typeof step.config.body === 'object' ? JSON.stringify(step.config.body, null, 2) : step.config.body || ''}
              onChange={(val) => {
                if (step.config.bodyType === 'JSON') {
                  try {
                    const parsed = JSON.parse(val);
                    handleConfigChange('body', parsed);
                  } catch {
                    handleConfigChange('body', val);
                  }
                } else {
                  handleConfigChange('body', val);
                }
              }}
            />
          </div>
        )}

        <div className="pb-4">
          <div className="space-y-1.5 max-w-[280px]">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Timeout (ms)</label>
            <Input
              type="number"
              value={step.config.timeoutMs || 30000}
              onChange={(e) => handleConfigChange('timeoutMs', parseInt(e.target.value) || 30000)}
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
