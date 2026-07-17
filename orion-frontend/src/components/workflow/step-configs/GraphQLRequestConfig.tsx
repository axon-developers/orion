import React from 'react';
import { Input, Select, Textarea } from '../../ui';
import { TestStepDto } from '../../../types/api';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../ui';
import { EmbeddedAssertions } from './EmbeddedAssertions';
import { SetVariableConfig } from './SetVariableConfig';

interface GraphQLRequestConfigProps {
  step: TestStepDto;
  updateStep: (id: string, updates: Partial<TestStepDto>) => void;
  handleConfigChange: (key: string, value: any) => void;
  certOptions: { value: string; label: string }[];
  baseFields?: React.ReactNode;
}

export const GraphQLRequestConfig: React.FC<GraphQLRequestConfigProps> = ({
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
        
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase text-muted-foreground">GraphQL Endpoint URL <span className="text-destructive">*</span></label>
          <Input
            placeholder="e.g. https://api.spacex.land/graphql"
            value={step.config.url || ''}
            onChange={(e) => handleConfigChange('url', e.target.value)}
          />
          <p className="text-[10px] text-muted-foreground">Supports variable interpolation e.g. <code>{"{{baseUrl}}"}</code></p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase text-muted-foreground">GraphQL Query / Mutation <span className="text-destructive">*</span></label>
          <Textarea
            placeholder={`query GetUser($id: ID!) {\n  user(id: $id) {\n    name\n    email\n  }\n}`}
            value={step.config.query || ''}
            onChange={(e) => handleConfigChange('query', e.target.value)}
            rows={10}
            className="font-mono text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Query Variables (JSON)</label>
          <Textarea
            placeholder={`{\n  "id": "123"\n}`}
            value={step.config.variables ? (typeof step.config.variables === 'object' ? JSON.stringify(step.config.variables, null, 2) : step.config.variables) : ''}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleConfigChange('variables', parsed);
              } catch {
                handleConfigChange('variables', e.target.value);
              }
            }}
            rows={4}
            className="font-mono text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase text-muted-foreground">HTTP Headers (JSON)</label>
          <Textarea
            placeholder='e.g. { "Authorization": "Bearer {{token}}" }'
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
        </div>

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
