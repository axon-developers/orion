import React from 'react';
import { Input } from '../../ui';
import { TestStepDto } from '../../../types/api';

interface MainframeConnectConfigProps {
  step: TestStepDto;
  handleConfigChange: (key: string, value: any) => void;
}

export const MainframeConnectConfig: React.FC<MainframeConnectConfigProps> = ({
  step,
  handleConfigChange
}) => {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase text-muted-foreground">Mainframe Host <span className="text-destructive">*</span></label>
        <Input
          placeholder="e.g. mainframe.corp.internal or {{mainframeHost}}"
          value={step.config.mainframeHost || ''}
          onChange={(e) => handleConfigChange('mainframeHost', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Mainframe Port</label>
          <Input
            type="number"
            placeholder="e.g. 23"
            value={step.config.mainframePort !== undefined ? step.config.mainframePort : 23}
            onChange={(e) => {
              const val = e.target.value;
              handleConfigChange('mainframePort', val === '' ? '' : parseInt(val) || 23);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Connection Timeout (ms)</label>
          <Input
            type="number"
            placeholder="e.g. 10000"
            value={step.config.connectTimeoutMs !== undefined ? step.config.connectTimeoutMs : 10000}
            onChange={(e) => {
              const val = e.target.value;
              handleConfigChange('connectTimeoutMs', val === '' ? '' : parseInt(val) || 10000);
            }}
          />
        </div>
      </div>
    </div>
  );
};
