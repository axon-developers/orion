import React from 'react';
import { Input, Select, Textarea } from '../../ui';
import { TestStepDto } from '../../../types/api';

interface DbTableViewConfigProps {
  step: TestStepDto;
  updateStep: (id: string, updates: Partial<TestStepDto>) => void;
  handleConfigChange: (key: string, value: any) => void;
  dbOptions: { value: string; label: string }[];
}

export const DbTableViewConfig: React.FC<DbTableViewConfigProps> = ({
  step,
  updateStep,
  handleConfigChange,
  dbOptions
}) => {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
        <p className="text-[11px] text-orange-300 leading-relaxed">
          <strong>DB Table View</strong> runs a SELECT query and renders the result rows as a formatted table in the execution report. Use this to visually inspect database data during test runs.
        </p>
      </div>

      <div className="space-y-1.5">
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
        <div className="space-y-1.5 animate-in fade-in duration-150">
          <label className="text-xs font-semibold uppercase text-muted-foreground">JDBC Connection String</label>
          <Input
            placeholder="jdbc:sqlite:./orion.db or {{dbUrl}}"
            value={step.config.connectionString || ''}
            onChange={(e) => handleConfigChange('connectionString', e.target.value)}
          />
        </div>
      )}
      
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase text-muted-foreground">SQL SELECT Query</label>
        <Textarea
          placeholder="SELECT id, name, email, created_at FROM users ORDER BY created_at DESC LIMIT 100"
          value={step.config.query || ''}
          onChange={(e) => handleConfigChange('query', e.target.value)}
          rows={5}
          className="font-mono text-xs"
        />
        <p className="text-[10px] text-muted-foreground">Results will be rendered as a table with all columns and rows visible in the execution report.</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase text-muted-foreground">Table Title (Optional)</label>
        <Input
          placeholder="e.g. Active Users Report"
          value={step.config.tableTitle || ''}
          onChange={(e) => handleConfigChange('tableTitle', e.target.value)}
        />
      </div>
    </div>
  );
};
