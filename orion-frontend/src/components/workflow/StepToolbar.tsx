import React from 'react';
import { Button, Badge } from '../ui';
import { 
  Play, 
  Save, 
  ArrowLeft, 
  Plus, 
  AlertCircle, 
  Check, 
  Loader2 
} from 'lucide-react';
import { useWorkflowStore } from '../../stores/workflow-store';
import { cn } from '../../lib/utils';

interface StepToolbarProps {
  appName: string;
  testCaseName: string;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onAddStep: () => void;
  onValidate: () => void;
  onRun: () => void;
  onRunChecked?: () => void;
  onBack: () => void;
  viewMode?: 'visual' | 'yaml';
  onViewModeChange?: (mode: 'visual' | 'yaml') => void;
  readOnly?: boolean;
  defaultEnvName?: string;
}

export const StepToolbar: React.FC<StepToolbarProps> = ({
  appName,
  testCaseName,
  isDirty,
  isSaving,
  onSave,
  onAddStep,
  onValidate,
  onRun,
  onRunChecked,
  onBack,
  viewMode,
  onViewModeChange,
  readOnly = false,
  defaultEnvName
}) => {
  const { checkedStepIds, bulkSetEnabled, clearCheckedSteps } = useWorkflowStore();

  return (
    <div className="h-16 border-b border-border bg-card text-card-foreground flex items-center justify-between px-6 z-40">
      {/* Back and metadata info */}
      <div className="flex items-center space-x-4 min-w-0">
        <Button variant="ghost" size="sm" onClick={onBack} className="shrink-0">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Detail
        </Button>
        <div className="h-6 w-[1px] bg-border shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <h1 className="font-extrabold text-sm text-foreground truncate">{testCaseName}</h1>
            {isDirty && !readOnly ? (
              <Badge variant="warning" className="text-[9px] py-0 px-1 font-bold">unsaved changes</Badge>
            ) : (
              <Badge variant="success" className="text-[9px] py-0.5 px-1.5 font-bold flex items-center space-x-1">
                <Check className="h-2.5 w-2.5" />
                <span>saved</span>
              </Badge>
            )}
            {defaultEnvName && (
              <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] py-0.5 px-1.5 font-bold flex items-center space-x-1 shrink-0 select-none animate-in fade-in duration-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>Env: {defaultEnvName}</span>
              </Badge>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{appName}</p>
        </div>
      </div>

      {/* View Mode Toggle */}
      {viewMode && onViewModeChange && (
        <div className="flex bg-secondary/35 p-1 rounded-lg border border-border/55 shrink-0 animate-in fade-in duration-200">
          <button
            onClick={() => onViewModeChange('visual')}
            className={cn(
              "px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
              viewMode === 'visual' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Visual Canvas
          </button>
          <button
            onClick={() => onViewModeChange('yaml')}
            className={cn(
              "px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
              viewMode === 'yaml' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            YAML Editor
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center space-x-2">
        {viewMode !== 'yaml' && (
          checkedStepIds.length > 0 ? (
            <div className="flex items-center space-x-1.5 bg-secondary/35 px-2.5 py-1 rounded-md border border-border/40 text-xs shrink-0 animate-in fade-in duration-200">
              <span className="font-bold text-muted-foreground mr-1">
                {checkedStepIds.length} Selected:
              </span>
              {!readOnly && (
                <>
                  <Button size="sm" variant="outline" className="h-6 py-0 px-2 font-bold text-[9px] uppercase tracking-wider" onClick={() => bulkSetEnabled(true)}>
                    Enable
                  </Button>
                  <Button size="sm" variant="outline" className="h-6 py-0 px-2 font-bold text-[9px] uppercase tracking-wider text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => bulkSetEnabled(false)}>
                    Disable
                  </Button>
                  <Button size="sm" variant="outline" className="h-6 py-0 px-2 font-bold text-[9px] uppercase tracking-wider text-cyan-500 border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10" onClick={onRunChecked}>
                    <Play className="mr-1 h-3 w-3 fill-cyan-500 text-cyan-500" /> Run Selected
                  </Button>
                </>
              )}
              <Button size="sm" variant="ghost" className="h-6 py-0 px-2 font-medium text-[9px] uppercase tracking-wider text-muted-foreground hover:text-foreground" onClick={clearCheckedSteps}>
                Clear
              </Button>
            </div>
          ) : (
            !readOnly && (
              <Button size="sm" variant="secondary" onClick={onAddStep}>
                <Plus className="mr-1.5 h-4 w-4" /> Add Step
              </Button>
            )
          )
        )}
        <Button size="sm" variant="secondary" onClick={onValidate}>
          Validate
        </Button>
        {!readOnly && (
          <Button 
            size="sm" 
            onClick={onSave}
            disabled={isSaving}
            className={cn(isDirty ? "bg-primary" : "bg-secondary text-secondary-foreground hover:bg-secondary/80")}
          >
            {isSaving ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        )}
        {!readOnly && (
          <>
            <div className="h-6 w-[1px] bg-border" />
            <Button size="sm" variant="accent" onClick={onRun}>
              <Play className="mr-1.5 h-4 w-4 fill-black" />
              Run Workflow
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
export default StepToolbar;
