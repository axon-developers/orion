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
  onBack: () => void;
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
  onBack
}) => {
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
            {isDirty ? (
              <Badge variant="warning" className="text-[9px] py-0 px-1 font-bold">unsaved changes</Badge>
            ) : (
              <Badge variant="success" className="text-[9px] py-0.5 px-1.5 font-bold flex items-center space-x-1">
                <Check className="h-2.5 w-2.5" />
                <span>saved</span>
              </Badge>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{appName}</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center space-x-2">
        <Button size="sm" variant="secondary" onClick={onAddStep}>
          <Plus className="mr-1.5 h-4 w-4" /> Add Step
        </Button>
        <Button size="sm" variant="secondary" onClick={onValidate}>
          Validate
        </Button>
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
        <div className="h-6 w-[1px] bg-border" />
        <Button size="sm" variant="accent" onClick={onRun}>
          <Play className="mr-1.5 h-4 w-4 fill-black" />
          Run Workflow
        </Button>
      </div>
    </div>
  );
};
export default StepToolbar;
