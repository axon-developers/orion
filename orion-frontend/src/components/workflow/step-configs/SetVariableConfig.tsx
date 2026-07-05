import React from 'react';
import { Input, Select } from '../../ui';
import { TestStepDto } from '../../../types/api';

interface SetVariableConfigProps {
  step: TestStepDto;
  handleConfigChange: (key: string, value: any) => void;
}

export const SetVariableConfig: React.FC<SetVariableConfigProps> = ({
  step,
  handleConfigChange
}) => {
  const source = step.config.source || 'RESPONSE_BODY';
  const payloadFormat = step.config.payloadFormat || (step.config.xPath ? 'XML' : 'JSON');

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase text-muted-foreground">Variable Save Key</label>
        <Input
          placeholder="e.g. authToken"
          value={step.config.variableName || ''}
          onChange={(e) => handleConfigChange('variableName', e.target.value)}
        />
      </div>
      
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase text-muted-foreground">Extraction Source</label>
        <Select
          options={[
            { value: 'RESPONSE_BODY', label: 'Response Body (JSON)' },
            { value: 'RESPONSE_HEADER', label: 'Response Header' },
          ]}
          value={source}
          onChange={(e) => handleConfigChange('source', e.target.value)}
        />
      </div>

      {source === 'RESPONSE_BODY' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Payload Format</label>
            <Select
              options={[
                { value: 'JSON', label: 'JSON (JSONPath)' },
                { value: 'XML', label: 'XML/SOAP (XPath)' },
              ]}
              value={payloadFormat}
              onChange={(e) => {
                const format = e.target.value;
                handleConfigChange('payloadFormat', format);
                if (format === 'JSON') {
                  handleConfigChange('xPath', '');
                } else {
                  handleConfigChange('jsonPath', '');
                }
              }}
            />
          </div>

          {payloadFormat === 'XML' || step.config.xPath ? (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">XPath Expression</label>
              <Input
                placeholder="e.g. //AddResult/text()"
                value={step.config.xPath || ''}
                onChange={(e) => handleConfigChange('xPath', e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">JSONPath Selector</label>
              <Input
                placeholder="e.g. $.token"
                value={step.config.jsonPath || ''}
                onChange={(e) => handleConfigChange('jsonPath', e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {source === 'RESPONSE_HEADER' && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Header Name</label>
          <Input
            placeholder="e.g. Authorization"
            value={step.config.headerName || ''}
            onChange={(e) => handleConfigChange('headerName', e.target.value)}
          />
        </div>
      )}
    </div>
  );
};
