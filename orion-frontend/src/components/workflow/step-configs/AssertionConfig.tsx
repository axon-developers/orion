import React from 'react';
import { Input, Select } from '../../ui';
import { TestStepDto } from '../../../types/api';

interface AssertionConfigProps {
  step: TestStepDto;
  handleConfigChange: (key: string, value: any) => void;
  handleFieldChange: (field: keyof TestStepDto, value: any) => void;
}

export const AssertionConfig: React.FC<AssertionConfigProps> = ({
  step,
  handleConfigChange,
  handleFieldChange
}) => {
  const source = step.config.source || 'RESPONSE_BODY';
  const payloadFormat = step.config.payloadFormat || (step.config.xPath ? 'XML' : 'JSON');

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase text-muted-foreground">Target Source</label>
        <Select
          options={[
            { value: 'RESPONSE_BODY', label: 'Response Body (JSON)' },
            { value: 'STATUS_CODE', label: 'HTTP Status Code' },
            { value: 'RESPONSE_HEADER', label: 'HTTP Header' },
            { value: 'RESPONSE_TIME', label: 'Response Time (ms)' },
            { value: 'VARIABLE', label: 'Saved Variable' },
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
                placeholder="e.g. $.data.id"
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
            placeholder="e.g. Content-Type"
            value={step.config.headerName || ''}
            onChange={(e) => handleConfigChange('headerName', e.target.value)}
          />
        </div>
      )}

      {source === 'VARIABLE' && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Variable Name</label>
          <Input
            placeholder="e.g. userId"
            value={step.config.variableName || ''}
            onChange={(e) => handleConfigChange('variableName', e.target.value)}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase text-muted-foreground">Operator</label>
        <Select
          options={[
            { value: 'EQUALS', label: 'Equals' },
            { value: 'NOT_EQUALS', label: 'Not Equals' },
            { value: 'CONTAINS', label: 'Contains (Substring)' },
            { value: 'GREATER_THAN', label: 'Greater Than' },
            { value: 'LESS_THAN', label: 'Less Than' },
            { value: 'REGEX_MATCH', label: 'Regex Match' },
            { value: 'JSON_SCHEMA_VALIDATION', label: 'JSON Schema Validation' },
            { value: 'ARRAY_CONTAINS', label: 'Array Contains' },
            { value: 'FIELD_COUNT', label: 'Field Count (equals)' },
          ]}
          value={step.config.operator || 'EQUALS'}
          onChange={(e) => {
            handleConfigChange('operator', e.target.value);
            handleFieldChange('actionType', e.target.value); // Sync actionType
          }}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase text-muted-foreground">Expected Value</label>
        <Input
          placeholder="e.g. 200 or active"
          value={step.config.expectedValue || ''}
          onChange={(e) => handleConfigChange('expectedValue', e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase text-muted-foreground">Failure Message</label>
        <Input
          placeholder="Message displayed if validation fails..."
          value={step.config.message || ''}
          onChange={(e) => handleConfigChange('message', e.target.value)}
        />
      </div>

      <div className="flex items-center space-x-2 pt-2">
        <input
          type="checkbox"
          id="softAssertion"
          className="rounded border-input text-primary focus:ring-ring h-4 w-4 bg-slate-900 border-slate-700 checked:bg-indigo-600 checked:border-indigo-600"
          checked={!!step.config.softAssertion}
          onChange={(e) => handleConfigChange('softAssertion', e.target.checked)}
        />
        <label htmlFor="softAssertion" className="text-xs font-semibold uppercase text-muted-foreground cursor-pointer select-none">
          Soft Assertion (Do not abort execution on failure)
        </label>
      </div>
    </div>
  );
};
