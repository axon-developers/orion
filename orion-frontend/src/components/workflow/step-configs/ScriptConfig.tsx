import React from 'react';
import { Textarea } from '../../ui';
import { TestStepDto } from '../../../types/api';

interface ScriptConfigProps {
  step: TestStepDto;
  handleConfigChange: (key: string, value: any) => void;
}

export const ScriptConfig: React.FC<ScriptConfigProps> = ({
  step,
  handleConfigChange
}) => {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase text-muted-foreground">JavaScript Code</label>
        <Textarea
          placeholder="// e.g. context.put('customVar', 'hello'); or myVar = 'world';"
          value={step.config.script || ''}
          onChange={(e) => handleConfigChange('script', e.target.value)}
          rows={10}
          className="font-mono text-xs"
        />
        <p className="text-[10px] text-muted-foreground">
          Executes in a safe sandbox. You can read and write context variables (e.g. <code>{"context.put('myVar', 'val')"}</code> or direct global assignments).
        </p>
      </div>
    </div>
  );
};
