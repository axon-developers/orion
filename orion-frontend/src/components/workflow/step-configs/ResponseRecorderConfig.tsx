import React from 'react';
import { Input, Select, Textarea } from '../../ui';
import { TestStepDto } from '../../../types/api';
import { AlertCircle, Eye, Hash, Scissors, Search, Variable, CheckCircle } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface ResponseRecorderConfigProps {
  step: TestStepDto;
  handleConfigChange: (key: string, value: any) => void;
}

const SectionHeader: React.FC<{ icon: React.ReactNode; label: string; description?: string }> = ({
  icon, label, description
}) => (
  <div className="flex items-start gap-2 pb-2 border-b border-border/40 mb-3">
    <div className="mt-0.5 text-amber-400 shrink-0">{icon}</div>
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-foreground">{label}</p>
      {description && <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>}
    </div>
  </div>
);

export const ResponseRecorderConfig: React.FC<ResponseRecorderConfigProps> = ({
  step,
  handleConfigChange,
}) => {
  const c = step.config || {};

  const sourceType    = c.sourceType    || 'RESPONSE_BODY';
  const payloadFormat = c.payloadFormat || 'JSON';
  const assertMode    = c.assertMode    || 'NONE';

  return (
    <div className="space-y-5">

      {/* ── Section 1: Source ─────────────────────────────────────────────── */}
      <div>
        <SectionHeader
          icon={<Eye className="h-3.5 w-3.5" />}
          label="Source"
          description="What to read the response body from"
        />
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase text-muted-foreground">Read From</label>
            <Select
              options={[
                { value: 'RESPONSE_BODY', label: 'Last Response Body (HTTP / SOAP)' },
                { value: 'VARIABLE',      label: 'Named Variable' },
              ]}
              value={sourceType}
              onChange={(e) => handleConfigChange('sourceType', e.target.value)}
            />
          </div>

          {sourceType === 'VARIABLE' && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase text-muted-foreground">Variable Name</label>
              <Input
                placeholder="e.g. orderResponse"
                value={c.sourceVariable || ''}
                onChange={(e) => handleConfigChange('sourceVariable', e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase text-muted-foreground">Payload Format</label>
            <Select
              options={[
                { value: 'JSON', label: 'JSON  —  extract via JSONPath' },
                { value: 'XML',  label: 'XML / SOAP  —  extract via XPath' },
                { value: 'TEXT', label: 'Plain Text  —  no path extraction' },
              ]}
              value={payloadFormat}
              onChange={(e) => {
                handleConfigChange('payloadFormat', e.target.value);
                // Clear opposite path field
                if (e.target.value === 'JSON') handleConfigChange('xPath', '');
                if (e.target.value === 'XML')  handleConfigChange('jsonPath', '');
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Section 2: Extraction ─────────────────────────────────────────── */}
      {payloadFormat !== 'TEXT' && (
        <div>
          <SectionHeader
            icon={<Search className="h-3.5 w-3.5" />}
            label="Extract"
            description="Drill into the body to retrieve a specific value or node"
          />
          <div className="space-y-3">
            {payloadFormat === 'JSON' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase text-muted-foreground">JSONPath Expression</label>
                <Input
                  placeholder="e.g. $.data.items  or  $.results[0].id"
                  value={c.jsonPath || ''}
                  onChange={(e) => handleConfigChange('jsonPath', e.target.value)}
                  className="font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Leave blank to use the full response body.
                </p>
              </div>
            )}
            {payloadFormat === 'XML' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase text-muted-foreground">XPath Expression</label>
                <Input
                  placeholder="e.g. //AddResult/text()  or  //Order/@id"
                  value={c.xPath || ''}
                  onChange={(e) => handleConfigChange('xPath', e.target.value)}
                  className="font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Leave blank to record the full XML body.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Section 3: Slicing & Filtering ───────────────────────────────── */}
      <div>
        <SectionHeader
          icon={<Scissors className="h-3.5 w-3.5" />}
          label="Slice & Filter"
          description="Narrow down the output to only the relevant portion"
        />
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase text-muted-foreground">Start From Text</label>
              <Input
                placeholder='e.g. "items":'
                value={c.startFindText || ''}
                onChange={(e) => handleConfigChange('startFindText', e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase text-muted-foreground">End At Text</label>
              <Input
                placeholder='e.g. "meta":'
                value={c.endFindText || ''}
                onChange={(e) => handleConfigChange('endFindText', e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center gap-1">
                <Hash className="h-3 w-3" /> Max Lines
              </label>
              <Input
                type="number"
                min={0}
                placeholder="0 = unlimited"
                value={c.maxLines ?? ''}
                onChange={(e) => handleConfigChange('maxLines', e.target.value ? parseInt(e.target.value) : 0)}
              />
            </div>
            {payloadFormat === 'JSON' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center gap-1">
                  <Hash className="h-3 w-3" /> Max Array Items
                </label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0 = unlimited"
                  value={c.maxObjects ?? ''}
                  onChange={(e) => handleConfigChange('maxObjects', e.target.value ? parseInt(e.target.value) : 0)}
                />
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            All filters are applied in order: extract → slice → limit lines/objects.
          </p>
        </div>
      </div>

      {/* ── Section 4: Verification ───────────────────────────────────────── */}
      <div>
        <SectionHeader
          icon={<CheckCircle className="h-3.5 w-3.5" />}
          label="Verify"
          description="Assert the extracted output meets expectations — fails the step if not"
        />
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase text-muted-foreground">Assertion Mode</label>
            <Select
              options={[
                { value: 'NONE',         label: 'None — record only, no check' },
                { value: 'CONTAINS',     label: 'Contains — extracted output includes text' },
                { value: 'NOT_CONTAINS', label: 'Not Contains — extracted output excludes text' },
                { value: 'EQUALS',       label: 'Equals — extracted output matches exactly' },
                { value: 'REGEX',        label: 'Regex Match — pattern found in output' },
              ]}
              value={assertMode}
              onChange={(e) => handleConfigChange('assertMode', e.target.value)}
            />
          </div>

          {assertMode !== 'NONE' && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase text-muted-foreground">Expected Value</label>
              <Input
                placeholder={
                  assertMode === 'REGEX'
                    ? 'e.g. ^[A-Z]{3}-\\d+'
                    : 'e.g. SUCCESS  or  order_id'
                }
                value={c.expectedValue || ''}
                onChange={(e) => handleConfigChange('expectedValue', e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          )}

          {assertMode !== 'NONE' && (
            <div className="flex items-start gap-2 text-[10px] rounded-md px-2.5 py-2 border bg-amber-500/5 border-amber-500/20 text-amber-500">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>A failed assertion will mark this step as <strong>FAILED</strong> and stop the workflow execution.</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 5: Save Result ────────────────────────────────────────── */}
      <div>
        <SectionHeader
          icon={<Variable className="h-3.5 w-3.5" />}
          label="Save Result"
          description="Store the extracted output as a named variable for use in downstream steps"
        />
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase text-muted-foreground">Variable Name</label>
          <Input
            placeholder="e.g. orderStatus"
            value={c.targetVariable || ''}
            onChange={(e) => handleConfigChange('targetVariable', e.target.value)}
          />
          {c.targetVariable && (
            <p className="text-[10px] text-muted-foreground">
              Use <code className="bg-muted px-1 py-0.5 rounded text-amber-400">{`\${${c.targetVariable}}`}</code> in subsequent steps.
            </p>
          )}
        </div>
      </div>

    </div>
  );
};

export default ResponseRecorderConfig;
