import React from 'react';
import { Input, Select, Textarea } from '../../ui';
import { TestStepDto } from '../../../types/api';

interface DatabaseQueryConfigProps {
  step: TestStepDto;
  updateStep: (id: string, updates: Partial<TestStepDto>) => void;
  handleConfigChange: (key: string, value: any) => void;
  dbOptions: { value: string; label: string }[];
}

export const DatabaseQueryConfig: React.FC<DatabaseQueryConfigProps> = ({
  step,
  updateStep,
  handleConfigChange,
  dbOptions
}) => {
  return (
    <div className="space-y-4">
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
};
