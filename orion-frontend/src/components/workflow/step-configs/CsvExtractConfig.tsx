import React from 'react';
import { Input, Select, Textarea } from '../../ui';
import { TestStepDto } from '../../../types/api';

interface CsvExtractConfigProps {
  step: TestStepDto;
  handleConfigChange: (key: string, value: any) => void;
  datasetOptions: { value: string; label: string }[];
}

export const CsvExtractConfig: React.FC<CsvExtractConfigProps> = ({
  step,
  handleConfigChange,
  datasetOptions
}) => {
  const source = step.config.datasetSource || 'DESIGNER';
  const mode = step.config.extractMode || 'FIRST_ROW';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        handleConfigChange('rawCsv', result);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase text-muted-foreground">Dataset Source</label>
        <Select
          options={[
            { value: 'DESIGNER', label: 'Direct Input (Pasted/Uploaded in Designer)' },
            { value: 'ENVIRONMENT', label: 'Environment Dataset (Loaded from settings)' }
          ]}
          value={source}
          onChange={(e) => handleConfigChange('datasetSource', e.target.value)}
        />
      </div>

      {source === 'ENVIRONMENT' ? (
        <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-150">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Select Dataset</label>
          <Select
            options={datasetOptions}
            value={step.config.datasetName || ''}
            onChange={(e) => handleConfigChange('datasetName', e.target.value)}
          />
          <p className="text-[10px] text-muted-foreground">Matches a dataset CSV uploaded in your active execution Environment.</p>
        </div>
      ) : (
        <div className="space-y-3 animate-in slide-in-from-top-1 duration-150">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Upload CSV File</label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="block w-full text-xs text-muted-foreground border border-border rounded-lg cursor-pointer bg-background p-1.5 focus:outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Raw CSV Data</label>
            <Textarea
              placeholder="id,username,email&#10;1,john_doe,john@example.com&#10;2,jane_doe,jane@example.com"
              value={step.config.rawCsv || ''}
              onChange={(e) => handleConfigChange('rawCsv', e.target.value)}
              rows={8}
              className="font-mono text-xs font-normal"
            />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase text-muted-foreground">Extract Mode</label>
        <Select
          options={[
            { value: 'FIRST_ROW', label: 'First Data Row' },
            { value: 'RANDOM_ROW', label: 'Random Data Row' },
            { value: 'ITERATION_ROW', label: 'Loop Iteration Row Index' }
          ]}
          value={mode}
          onChange={(e) => handleConfigChange('extractMode', e.target.value)}
        />
        <p className="text-[10px] text-muted-foreground">
          {mode === 'ITERATION_ROW' 
            ? 'Pulls the row dynamically based on the current loop iteration index (or defaults to first row).' 
            : mode === 'RANDOM_ROW'
            ? 'Pulls a random data row from the CSV each time this step executes.'
            : 'Always pulls the first data row below the header line.'}
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase text-muted-foreground">Variable Key Prefix</label>
        <Input
          placeholder="e.g. user (yields {{user.id}}, {{user.username}})"
          value={step.config.variablePrefix || ''}
          onChange={(e) => handleConfigChange('variablePrefix', e.target.value)}
        />
        <p className="text-[10px] text-muted-foreground">Variables will be extracted as key prefix + column name from the selected row.</p>
      </div>
    </div>
  );
};
