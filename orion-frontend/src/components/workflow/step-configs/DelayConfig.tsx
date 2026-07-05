import React from 'react';
import { Input } from '../../ui';
import { TestStepDto } from '../../../types/api';

interface DelayConfigProps {
  step: TestStepDto;
  handleConfigChange: (key: string, value: any) => void;
}

export const DelayConfig: React.FC<DelayConfigProps> = ({
  step,
  handleConfigChange
}) => {
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
};
