import React from 'react';
import { Input, Select } from '../../ui';
import { TestStepDto } from '../../../types/api';

interface DbConnectConfigProps {
  step: TestStepDto;
  updateStep: (id: string, updates: Partial<TestStepDto>) => void;
  handleConfigChange: (key: string, value: any) => void;
  dbOptions: { value: string; label: string }[];
}

export const DbConnectConfig: React.FC<DbConnectConfigProps> = ({
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
              ...(val ? { connectionString: '', username: '', password: '' } : {})
            };
            updateStep(step.id, { config: newConfig });
          }}
        />
      </div>

      {!step.config.databaseKey && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-muted-foreground">JDBC Connection String <span className="text-destructive">*</span></label>
            <Input
              placeholder="e.g. jdbc:postgresql://localhost:5432/mydb"
              value={step.config.connectionString || ''}
              onChange={(e) => handleConfigChange('connectionString', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Username</label>
              <Input
                placeholder="db_user"
                value={step.config.username || ''}
                onChange={(e) => handleConfigChange('username', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Password</label>
              <Input
                type="password"
                placeholder="db_password"
                value={step.config.password || ''}
                onChange={(e) => handleConfigChange('password', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
