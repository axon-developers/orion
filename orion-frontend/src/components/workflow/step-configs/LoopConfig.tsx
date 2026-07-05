import React from 'react';
import { Input, Select } from '../../ui';
import { TestStepDto } from '../../../types/api';

interface LoopConfigProps {
  step: TestStepDto;
  handleConfigChange: (key: string, value: any) => void;
}

export const LoopConfig: React.FC<LoopConfigProps> = ({
  step,
  handleConfigChange
}) => {
  const type = step.config.type || 'COUNT';

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase text-muted-foreground">Loop Type</label>
        <Select
          options={[
            { value: 'COUNT', label: 'Fixed Count Iterations' },
            { value: 'FOR_EACH', label: 'For Each Element' },
          ]}
          value={type}
          onChange={(e) => handleConfigChange('type', e.target.value)}
        />
      </div>

      {type === 'COUNT' ? (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Iteration Count</label>
          <Input
            type="number"
            value={step.config.count || 5}
            onChange={(e) => handleConfigChange('count', parseInt(e.target.value) || 5)}
          />
        </div>
      ) : (
        <div className="space-y-3 animate-in fade-in duration-150">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Array JSONPath Source</label>
            <Input
              placeholder="e.g. $.users"
              value={step.config.dataSource || ''}
              onChange={(e) => handleConfigChange('dataSource', e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">Extract array from the last response payload (e.g. <code>$.users</code>)</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Iterator Variable Name</label>
            <Input
              placeholder="e.g. item"
              value={step.config.iteratorVariable || 'item'}
              onChange={(e) => handleConfigChange('iteratorVariable', e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">Variable name inside loop iterations (e.g. <code>{"{{item.id}}"}</code>)</p>
          </div>
        </div>
      )}

      <div className="space-y-1.5 border-t border-border/40 pt-3">
        <label className="text-xs font-semibold uppercase text-muted-foreground">Step Sequence Orders to Repeat</label>
        <Input
          placeholder="e.g. 3, 4, 5"
          value={step.config.steps ? step.config.steps.join(', ') : ''}
          onChange={(e) => {
            const val = e.target.value;
            const stepOrders = val.split(',')
              .map(s => parseInt(s.trim()))
              .filter(n => !isNaN(n));
            handleConfigChange('steps', stepOrders);
          }}
        />
        <p className="text-[10px] text-muted-foreground">Comma-separated sequence order numbers of the steps to execute in each loop iteration.</p>
      </div>
    </div>
  );
};
