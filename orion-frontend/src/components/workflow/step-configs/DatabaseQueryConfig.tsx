import React from 'react';
import { Input, Select, Textarea, Switch } from '../../ui';
import { TestStepDto } from '../../../types/api';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../ui';
import { EmbeddedAssertions } from './EmbeddedAssertions';
import { SetVariableConfig } from './SetVariableConfig';

interface DatabaseQueryConfigProps {
  step: TestStepDto;
  updateStep: (id: string, updates: Partial<TestStepDto>) => void;
  handleConfigChange: (key: string, value: any) => void;
  dbOptions: { value: string; label: string }[];
  baseFields?: React.ReactNode;
}

export const DatabaseQueryConfig: React.FC<DatabaseQueryConfigProps> = ({
  step,
  updateStep,
  handleConfigChange,
  dbOptions,
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
        <div className="space-y-1.5 pb-4">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Database Target</label>
        <Select
          options={dbOptions}
          value={step.config.databaseKey || ''}
          onChange={(e) => {
            const val = e.target.value;
            const newConfig = { 
              ...step.config, 
              databaseKey: val,
              ...(val ? { connectionString: '' } : {})
            };
            updateStep(step.id, { config: newConfig });
          }}
        />
      </div>

      {!(step.config.databaseKey) && (
        <div className="space-y-1.5 animate-in fade-in duration-150 pb-4">
          <label className="text-xs font-semibold uppercase text-muted-foreground">JDBC Connection String</label>
          <Input
            placeholder="jdbc:sqlite:./orion.db or {{dbUrl}}"
            value={step.config.connectionString || ''}
            onChange={(e) => handleConfigChange('connectionString', e.target.value)}
          />
        </div>
      )}
      
      <div className="space-y-1.5 pb-4">
        <label className="text-xs font-semibold uppercase text-muted-foreground">SQL Query Command <span className="text-destructive">*</span></label>
        <Textarea
          placeholder="SELECT count(*) FROM users WHERE is_active = 1"
          value={step.config.query || ''}
          onChange={(e) => handleConfigChange('query', e.target.value)}
          rows={5}
          className="font-mono text-xs"
        />
        <p className="text-[10px] text-muted-foreground italic mt-1 bg-secondary/20 p-2 rounded border border-border/40">
          💡 <strong>Variable Interpolation:</strong> Use <code className="font-mono text-primary bg-primary/10 px-1 py-0.5 rounded text-[9px]">{"{{variableName}}"}</code> to inject active variables dynamically (e.g. <code className="font-mono text-[9px] bg-secondary p-0.5 rounded">SELECT * FROM users WHERE email = '{"{{userEmail}}"}';</code>).
        </p>
      </div>
    </TabsContent>

    <TabsContent value="settings" className="space-y-4 mt-0">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase text-muted-foreground">Save Result to Variable</label>
        <Input
          placeholder="e.g. activeUsersCount"
          value={step.config.resultVariable || ''}
          onChange={(e) => handleConfigChange('resultVariable', e.target.value)}
        />
      </div>

      <div className="pt-2 border-t border-border/20 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Print Result as Table</label>
            <p className="text-[10px] text-muted-foreground">Format execution console logs as a structured database grid table.</p>
          </div>
          <Switch
            checked={!!step.config.printAsTable}
            onChange={(e) => handleConfigChange('printAsTable', e.target.checked)}
          />
        </div>

        {step.config.printAsTable && (
          <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-200">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Table Title</label>
            <Input
              placeholder="e.g. Active Customer Report"
              value={step.config.tableTitle || ''}
              onChange={(e) => handleConfigChange('tableTitle', e.target.value)}
            />
          </div>
        )}
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
