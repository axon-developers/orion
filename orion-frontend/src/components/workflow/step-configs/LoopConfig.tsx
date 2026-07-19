import React from 'react';
import { Input, Select, Badge } from '../../ui';
import { TestStepDto } from '../../../types/api';
import { useWorkflowStore } from '../../../stores/workflow-store';
import { Repeat, CheckSquare, Square, AlertCircle, Layers } from 'lucide-react';

interface LoopConfigProps {
  step: TestStepDto;
  handleConfigChange: (key: string, value: any) => void;
}

export const LoopConfig: React.FC<LoopConfigProps> = ({
  step,
  handleConfigChange
}) => {
  const type = step.config.type || 'COUNT';
  const { steps } = useWorkflowStore();

  const selectedOrders: number[] = Array.isArray(step.config.steps) ? step.config.steps : [];

  // Filter candidate steps: must come AFTER loop step, cannot be another LOOP step
  const candidateSteps = steps.filter(
    (s) => s.id !== step.id && s.sequenceOrder > step.sequenceOrder && s.stepType !== 'LOOP'
  );

  const toggleStepOrder = (seqOrder: number) => {
    let next: number[];
    if (selectedOrders.includes(seqOrder)) {
      next = selectedOrders.filter((o) => o !== seqOrder);
    } else {
      next = [...selectedOrders, seqOrder].sort((a, b) => a - b);
    }
    handleConfigChange('steps', next);
  };

  const toggleSelectAll = () => {
    if (selectedOrders.length === candidateSteps.length) {
      handleConfigChange('steps', []);
    } else {
      const allOrders = candidateSteps.map((s) => s.sequenceOrder).sort((a, b) => a - b);
      handleConfigChange('steps', allOrders);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase text-muted-foreground">Loop Execution Mode</label>
        <Select
          options={[
            { value: 'COUNT', label: 'Fixed Count Iterations' },
            { value: 'FOR_EACH', label: 'For-Each Element in Data Source' },
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
            min={1}
            max={1000}
            value={step.config.count || 5}
            onChange={(e) => handleConfigChange('count', Math.max(1, parseInt(e.target.value) || 1))}
          />
        </div>
      ) : (
        <div className="space-y-3 animate-in fade-in duration-150">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Array Data Source (JSONPath)</label>
            <Input
              placeholder="e.g. $.users or {{usersList}}"
              value={step.config.dataSource || ''}
              onChange={(e) => handleConfigChange('dataSource', e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">Extract array from previous step response (e.g. <code>$.users</code>)</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Iterator Variable Name</label>
            <Input
              placeholder="e.g. item"
              value={step.config.iteratorVariable || 'item'}
              onChange={(e) => handleConfigChange('iteratorVariable', e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">Access current item in body steps using <code>{"{{item.id}}"}</code></p>
          </div>
        </div>
      )}

      {/* Step Selection Header */}
      <div className="space-y-2 border-t border-border/40 pt-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase text-foreground flex items-center gap-1.5">
            <Repeat className="h-3.5 w-3.5 text-purple-400" />
            <span>Steps Included in Loop Body ({selectedOrders.length})</span>
          </label>
          {candidateSteps.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-[10px] text-primary hover:underline font-bold"
            >
              {selectedOrders.length === candidateSteps.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>

        {candidateSteps.length === 0 ? (
          <div className="p-3 rounded-lg border border-dashed border-amber-500/30 bg-amber-500/5 text-amber-300 text-[11px] flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>No subsequent steps available after this loop. Add steps below this loop step to include them in iterations.</span>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {candidateSteps.map((cand) => {
              const isSelected = selectedOrders.includes(cand.sequenceOrder);
              return (
                <div
                  key={cand.id}
                  onClick={() => toggleStepOrder(cand.sequenceOrder)}
                  className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'border-purple-500/50 bg-purple-500/10 text-foreground font-semibold'
                      : 'border-border/40 bg-secondary/20 text-muted-foreground hover:bg-secondary/40'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <span className="shrink-0 text-purple-400">
                      {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                    </span>
                    <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono shrink-0">
                      Step {cand.sequenceOrder}
                    </Badge>
                    <span className="truncate">{cand.name}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono uppercase shrink-0 ml-2">
                    {cand.stepType.replace('_', ' ')}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-2.5 rounded-lg bg-secondary/30 border border-border/30 text-[10px] text-muted-foreground space-y-1">
        <div className="font-bold text-foreground flex items-center gap-1">
          <Layers className="h-3 w-3 text-purple-400" />
          <span>Loop Scope Rules</span>
        </div>
        <p>• Selected steps will execute once for each iteration of this loop.</p>
        <p>• Outer workflow will skip these steps on regular execution path.</p>
      </div>
    </div>
  );
};

export default LoopConfig;

