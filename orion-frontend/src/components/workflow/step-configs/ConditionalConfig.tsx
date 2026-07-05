import React from 'react';
import { Input } from '../../ui';
import { TestStepDto } from '../../../types/api';

interface ConditionalConfigProps {
  step: TestStepDto;
  handleConfigChange: (key: string, value: any) => void;
}

export const ConditionalConfig: React.FC<ConditionalConfigProps> = ({
  step,
  handleConfigChange
}) => {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase text-muted-foreground">Branch Condition</label>
        <Input
          placeholder="e.g. {{statusCode}} == 200"
          value={step.config.condition || ''}
          onChange={(e) => handleConfigChange('condition', e.target.value)}
        />
        <p className="text-[10px] text-muted-foreground">Supports variable substitution and operators e.g. <code>==</code>, <code>!=</code></p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase text-muted-foreground">On True Step Index</label>
          <Input
            type="number"
            placeholder="e.g. 5"
            value={step.config.onTrueStepIndex || ''}
            onChange={(e) => handleConfigChange('onTrueStepIndex', parseInt(e.target.value) || '')}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase text-muted-foreground">On False Step Index</label>
          <Input
            type="number"
            placeholder="e.g. 7"
            value={step.config.onFalseStepIndex || ''}
            onChange={(e) => handleConfigChange('onFalseStepIndex', parseInt(e.target.value) || '')}
          />
        </div>
      </div>
    </div>
  );
};
