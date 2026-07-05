import React from 'react';
import { Card, Button, Input, Select } from '../../ui';
import { Trash2 } from 'lucide-react';
import { TestStepDto } from '../../../types/api';

interface ParallelConfigProps {
  step: TestStepDto;
  handleConfigChange: (key: string, value: any) => void;
  activeSubIndex: number | null;
  setActiveSubIndex: (idx: number | null) => void;
}

export const ParallelConfig: React.FC<ParallelConfigProps> = ({
  step,
  handleConfigChange,
  activeSubIndex,
  setActiveSubIndex
}) => {
  const subSteps = step.config.steps || [];

  const handleAddSubStep = () => {
    const newSubStep = {
      id: `sub-${Date.now()}`,
      name: `Parallel HTTP Request`,
      stepType: 'HTTP_REQUEST',
      config: {
        method: 'GET',
        url: '',
        bodyType: 'NONE'
      }
    };
    const updatedSteps = [...subSteps, newSubStep];
    handleConfigChange('steps', updatedSteps);
    setActiveSubIndex(updatedSteps.length - 1);
  };

  const handleRemoveSubStep = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedSteps = subSteps.filter((_: any, sIdx: number) => sIdx !== idx);
    handleConfigChange('steps', updatedSteps);
    if (activeSubIndex === idx) {
      setActiveSubIndex(null);
    } else if (activeSubIndex !== null && activeSubIndex > idx) {
      setActiveSubIndex(activeSubIndex - 1);
    }
  };

  const handleSubStepChange = (idx: number, field: string, value: any) => {
    const updatedSteps = subSteps.map((s: any, sIdx: number) => {
      if (sIdx === idx) {
        return { ...s, [field]: value };
      }
      return s;
    });
    handleConfigChange('steps', updatedSteps);
  };

  const handleSubStepConfigChange = (idx: number, key: string, value: any) => {
    const updatedSteps = subSteps.map((s: any, sIdx: number) => {
      if (sIdx === idx) {
        return { ...s, config: { ...s.config, [key]: value } };
      }
      return s;
    });
    handleConfigChange('steps', updatedSteps);
  };

  const renderSubStepConfig = (subStep: any, idx: number) => {
    switch (subStep.stepType) {
      case 'HTTP_REQUEST':
        return (
          <div className="space-y-3 pt-3 border-t border-border/40 mt-3 text-xs">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Method</label>
              <Select
                className="h-7 text-xs py-0.5"
                options={[
                  { value: 'GET', label: 'GET' },
                  { value: 'POST', label: 'POST' },
                  { value: 'PUT', label: 'PUT' },
                  { value: 'DELETE', label: 'DELETE' },
                ]}
                value={subStep.config.method || 'GET'}
                onChange={(e) => handleSubStepConfigChange(idx, 'method', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">URL</label>
              <Input
                className="h-7 text-xs py-1"
                placeholder="e.g. {{baseUrl}}/api/users"
                value={subStep.config.url || ''}
                onChange={(e) => handleSubStepConfigChange(idx, 'url', e.target.value)}
              />
            </div>
          </div>
        );
      case 'DELAY':
        return (
          <div className="space-y-3 pt-3 border-t border-border/40 mt-3 text-xs">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Duration (ms)</label>
              <Input
                className="h-7 text-xs py-1"
                type="number"
                placeholder="e.g. 2000"
                value={subStep.config.durationMs || 1000}
                onChange={(e) => handleSubStepConfigChange(idx, 'durationMs', parseInt(e.target.value) || 1000)}
              />
            </div>
          </div>
        );
      case 'LOG':
        return (
          <div className="space-y-3 pt-3 border-t border-border/40 mt-3 text-xs">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Log Message</label>
              <Input
                className="h-7 text-xs py-1"
                placeholder="e.g. Hello World"
                value={subStep.config.message || ''}
                onChange={(e) => handleSubStepConfigChange(idx, 'message', e.target.value)}
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Configure steps that will run concurrently in parallel threads.
      </p>

      <div className="space-y-2">
        {subSteps.map((subStep: any, idx: number) => {
          const isExpanded = activeSubIndex === idx;
          return (
            <Card key={idx} className="border border-border/60 overflow-hidden bg-card/50">
              <div 
                onClick={() => setActiveSubIndex(isExpanded ? null : idx)}
                className="p-3 flex items-center justify-between cursor-pointer hover:bg-secondary/15 select-none"
              >
                <div className="flex items-center space-x-2 min-w-0">
                  <span className="w-4 h-4 rounded bg-primary/10 flex items-center justify-center text-[9.5px] text-primary shrink-0 font-bold">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-semibold truncate text-foreground">{subStep.name}</span>
                  <span className="text-[8px] font-bold text-muted-foreground uppercase bg-secondary px-1.5 py-0.5 rounded font-mono shrink-0">
                    {subStep.stepType}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 shrink-0">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-destructive hover:bg-destructive/10 cursor-pointer"
                    onClick={(e) => handleRemoveSubStep(idx, e)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {isExpanded && (
                <div className="p-3 border-t border-border/30 bg-secondary/5 space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Step Name</label>
                    <Input
                      className="h-7 text-xs py-1"
                      value={subStep.name}
                      onChange={(e) => handleSubStepChange(idx, 'name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Step Type</label>
                    <Select
                      className="h-7 text-xs py-0.5"
                      options={[
                        { value: 'HTTP_REQUEST', label: 'HTTP Request' },
                        { value: 'DELAY', label: 'Delay/Pause' },
                        { value: 'LOG', label: 'Log Message' },
                      ]}
                      value={subStep.stepType}
                      onChange={(e) => handleSubStepChange(idx, 'stepType', e.target.value)}
                    />
                  </div>
                  {renderSubStepConfig(subStep, idx)}
                </div>
              )}
            </Card>
          );
        })}

        {subSteps.length === 0 && (
          <div className="text-center p-4 border border-dashed border-border rounded-lg text-xs text-muted-foreground bg-secondary/5">
            No parallel steps. Click below to add one.
          </div>
        )}
      </div>

      <Button variant="outline" size="sm" className="w-full text-xs h-8 border-dashed" onClick={handleAddSubStep}>
        + Add Parallel Step
      </Button>
    </div>
  );
};
