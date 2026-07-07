import React from 'react';
import { Input, Select, Textarea } from '../../ui';
import { TestStepDto } from '../../../types/api';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../ui';
import { EmbeddedAssertions } from './EmbeddedAssertions';
import { SetVariableConfig } from './SetVariableConfig';

interface DbTableViewConfigProps {
  step: TestStepDto;
  updateStep: (id: string, updates: Partial<TestStepDto>) => void;
  handleConfigChange: (key: string, value: any) => void;
  dbOptions: { value: string; label: string }[];
  baseFields?: React.ReactNode;
}

export const DbTableViewConfig: React.FC<DbTableViewConfigProps> = ({
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
        <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
          <p className="text-[11px] text-orange-300 leading-relaxed">
            <strong>DB Table View</strong> runs a SELECT query and renders the result rows as a formatted table in the execution report. Use this to visually inspect database data during test runs.
          </p>
        </div>

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
        <label className="text-xs font-semibold uppercase text-muted-foreground">SQL SELECT Query <span className="text-destructive">*</span></label>
        <Textarea
          placeholder="SELECT id, name, email, created_at FROM users ORDER BY created_at DESC LIMIT 100"
          value={step.config.query || ''}
          onChange={(e) => handleConfigChange('query', e.target.value)}
          rows={5}
          className="font-mono text-xs"
        />
        <p className="text-[10px] text-muted-foreground">Results will be rendered as a table with all columns and rows visible in the execution report.</p>
      </div>
    </TabsContent>

    <TabsContent value="settings" className="space-y-4 mt-0">
      <div className="space-y-1.5 pb-4">
        <label className="text-xs font-semibold uppercase text-muted-foreground">Table Title (Optional)</label>
        <Input
          placeholder="e.g. Active Users Report"
          value={step.config.tableTitle || ''}
          onChange={(e) => handleConfigChange('tableTitle', e.target.value)}
        />
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
