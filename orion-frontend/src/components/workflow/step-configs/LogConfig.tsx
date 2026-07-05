import React from 'react';
import { Select, Textarea } from '../../ui';
import { TestStepDto } from '../../../types/api';

interface LogConfigProps {
  step: TestStepDto;
  handleConfigChange: (key: string, value: any) => void;
}

export const LogConfig: React.FC<LogConfigProps> = ({
  step,
  handleConfigChange
}) => {
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
};
