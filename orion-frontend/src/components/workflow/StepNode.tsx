import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { 
  Globe, 
  CheckCircle, 
  Clock, 
  HelpCircle, 
  GitBranch, 
  Repeat, 
  Terminal, 
  FileText, 
  Database,
  Link,
  ChevronRight,
  Split,
  FileCode,
  ChevronUp,
  ChevronDown,
  Table2,
  MonitorPlay,
  Loader2,
  XCircle,
  AlertTriangle,
  Monitor,
  Eye
} from 'lucide-react';
import { TestStepDto } from '../../types/api';
import { cn } from '../../lib/utils';
import { useWorkflowStore } from '../../stores/workflow-store';
import { Badge } from '../ui';

interface StepNodeProps {
  data: {
    step: TestStepDto;
  };
}

export const StepNode: React.FC<StepNodeProps> = ({ data }) => {
  const { step } = data;
  const { selectedStepId, selectStep, steps, moveStepUp, moveStepDown, checkedStepIds, toggleCheckStep, stepRunStatusMap } = useWorkflowStore();
  const isSelected = selectedStepId === step.id;
  const isChecked = checkedStepIds.includes(step.id);
  const stepIndex = steps.findIndex((s) => s.id === step.id);
  const isFirst = stepIndex === 0;
  const isLast = stepIndex !== -1 && stepIndex === steps.length - 1;
  const isRealStep = stepIndex !== -1;

  const runStatusInfo = stepRunStatusMap[step.id];

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'HTTP_REQUEST':
        return <Globe className="h-5 w-5 text-cyan-400" />;
      case 'ASSERTION':
        return <CheckCircle className="h-5 w-5 text-emerald-400" />;
      case 'DELAY':
        return <Clock className="h-5 w-5 text-yellow-400" />;
      case 'SET_VARIABLE':
        return <HelpCircle className="h-5 w-5 text-pink-400" />;
      case 'CONDITIONAL':
        return <GitBranch className="h-5 w-5 text-indigo-400" />;
      case 'LOOP':
        return <Repeat className="h-5 w-5 text-purple-400" />;
      case 'SCRIPT':
        return <Terminal className="h-5 w-5 text-teal-400" />;
      case 'LOG':
        return <FileText className="h-5 w-5 text-gray-400" />;
      case 'DATABASE_QUERY':
        return <Database className="h-5 w-5 text-blue-400" />;
      case 'DB_TABLE_VIEW':
        return <Table2 className="h-5 w-5 text-orange-400" />;
      case 'GLOBAL_REF':
        return <Link className="h-5 w-5 text-amber-400" />;
      case 'PARALLEL':
        return <Split className="h-5 w-5 text-violet-400" />;
      case 'SOAP_REQUEST':
        return <FileCode className="h-5 w-5 text-indigo-400" />;
      case 'BROWSER_AUTOMATION':
        return <MonitorPlay className="h-5 w-5 text-teal-400" />;
      case 'MAINFRAME_TERMINAL':
        return <Monitor className="h-5 w-5 text-lime-400" />;
      case 'RESPONSE_PROCESSOR':
        return <Eye className="h-5 w-5 text-amber-400" />;
      default:
        return <ChevronRight className="h-5 w-5 text-foreground" />;
    }
  };

  const getStepColorClass = (type: string) => {
    switch (type) {
      case 'HTTP_REQUEST': return 'border-cyan-500/30 bg-cyan-500/5';
      case 'ASSERTION': return 'border-emerald-500/30 bg-emerald-500/5';
      case 'DELAY': return 'border-yellow-500/30 bg-yellow-500/5';
      case 'SET_VARIABLE': return 'border-pink-500/30 bg-pink-500/5';
      case 'CONDITIONAL': return 'border-indigo-500/30 bg-indigo-500/5';
      case 'LOOP': return 'border-purple-500/30 bg-purple-500/5';
      case 'SCRIPT': return 'border-teal-500/30 bg-teal-500/5';
      case 'DATABASE_QUERY': return 'border-blue-500/30 bg-blue-500/5';
      case 'DB_TABLE_VIEW': return 'border-orange-500/30 bg-orange-500/5';
      case 'GLOBAL_REF': return 'border-amber-500/30 bg-amber-500/5';
      case 'PARALLEL': return 'border-violet-500/30 bg-violet-500/5';
      case 'SOAP_REQUEST': return 'border-indigo-500/30 bg-indigo-500/5';
      case 'BROWSER_AUTOMATION': return 'border-teal-500/30 bg-teal-500/5';
      case 'MAINFRAME_TERMINAL': return 'border-lime-500/30 bg-lime-500/5';
      case 'RESPONSE_PROCESSOR': return 'border-amber-500/30 bg-amber-500/5';
      default: return 'border-border/60 bg-card';
    }
  };

  const getStepCategory = (type: string) => {
    if (type === 'HTTP_REQUEST' || type === 'SOAP_REQUEST' || type === 'DATABASE_QUERY' || type === 'BROWSER_AUTOMATION') {
      return { name: 'Primary', badgeVariant: 'default' as const };
    }
    if (type === 'ASSERTION' || type === 'SET_VARIABLE') {
      return { name: 'Support', badgeVariant: 'success' as const };
    }
    if (type === 'LOG' || type === 'DB_TABLE_VIEW') {
      return { name: 'Display', badgeVariant: 'default' as const };
    }
    return { name: 'Technical', badgeVariant: 'secondary' as const };
  };

  const category = getStepCategory(step.stepType);

  const handleMoveUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    moveStepUp(step.id);
  };

  const handleMoveDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    moveStepDown(step.id);
  };

  const getRunStatusClass = () => {
    if (!runStatusInfo) return '';
    switch (runStatusInfo.status) {
      case 'RUNNING':
        return 'border-yellow-500 ring-2 ring-yellow-500/20 bg-yellow-500/5 scale-[1.01] animate-pulse';
      case 'PASSED':
        return 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/5';
      case 'FAILED':
        return 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-500/5';
      case 'QUEUED':
        return 'border-amber-400 border-dashed animate-pulse bg-amber-400/5';
      default:
        return '';
    }
  };

  return (
    <div className="relative group/card">
      <Handle type="target" position={Position.Top} id="top" className="opacity-0 group-hover/card:opacity-100 transition-opacity !bg-primary" />
      <Handle type="target" position={Position.Left} id="left" className="opacity-0 group-hover/card:opacity-100 transition-opacity !bg-primary" />
      
      <div 
        onClick={() => selectStep(step.id)}
        className={cn(
          "w-85 rounded-lg border-2 p-4 text-card-foreground shadow-md transition-all duration-200 cursor-pointer text-left hover:scale-[1.01] relative",
          step.enabled === false 
            ? "border-muted-foreground/30 bg-secondary/40 text-muted-foreground opacity-60 border-dashed" 
            : getStepColorClass(step.stepType),
          getRunStatusClass(),
          isSelected && !runStatusInfo ? "border-primary ring-2 ring-primary/20 scale-[1.01]" : ""
        )}
      >
        <div className="flex items-start space-x-3">
          {/* Multi-select checkbox */}
          {isRealStep && (
            <input 
              type="checkbox" 
              checked={isChecked}
              onChange={() => toggleCheckStep(step.id)}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary mt-3 cursor-pointer shrink-0"
            />
          )}

          {/* Icon */}
          <div className={cn(
            "h-10 w-10 rounded-md bg-secondary flex items-center justify-center shrink-0 border border-border/20 relative",
            step.enabled === false && "grayscale opacity-50"
          )}>
            {getStepIcon(step.stepType)}
            
            {/* Status overlay badge on the step icon */}
            {runStatusInfo && (
              <div className="absolute -bottom-1 -right-1 rounded-full p-0.5 bg-background shadow-xs border border-border flex items-center justify-center">
                {runStatusInfo.status === 'RUNNING' && <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />}
                {runStatusInfo.status === 'PASSED' && <CheckCircle className="h-3 w-3 text-emerald-500 fill-emerald-500/10" />}
                {runStatusInfo.status === 'FAILED' && <XCircle className="h-3 w-3 text-rose-500 fill-rose-500/10" />}
                {runStatusInfo.status === 'QUEUED' && <Clock className="h-3 w-3 text-amber-400" />}
              </div>
            )}
          </div>
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground truncate mr-2">
                Step {step.sequenceOrder} • {step.stepType.replace('_', ' ')}
              </span>
              <div className="flex items-center space-x-1 shrink-0">
                {step.enabled === false && (
                  <Badge variant="destructive" className="text-[8px] py-0 px-1 font-bold tracking-wider uppercase scale-90 origin-right">
                    Disabled
                  </Badge>
                )}
                <Badge variant={category.badgeVariant} className="text-[8px] py-0 px-1 font-bold tracking-wider uppercase scale-90 origin-right">
                  {category.name}
                </Badge>
                {step.isGlobalRef && (
                  <Badge variant="warning" className="text-[8px] py-0 px-1 font-bold uppercase tracking-wider scale-90 origin-right">template</Badge>
                )}
              </div>
            </div>
            <h4 className={cn(
              "text-sm font-bold text-foreground truncate mt-0.5",
              step.enabled === false && "text-muted-foreground line-through font-medium"
            )}>
              {step.name}
            </h4>
            {step.stepType === 'PARALLEL' ? (
              <p className="text-xs text-muted-foreground italic mt-1">
                Concurrently running sub-steps below...
              </p>
            ) : (
              <p className={cn(
                "text-xs text-muted-foreground line-clamp-1 mt-1",
                step.enabled === false && "opacity-50"
              )}>
                {step.description || 'Configure parameters...'}
              </p>
            )}

            {/* Error Message Display inside the Node */}
            {runStatusInfo && runStatusInfo.status === 'FAILED' && runStatusInfo.errorMessage && (
              <div className="mt-2 text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded p-1.5 font-mono flex items-start space-x-1 animate-in fade-in duration-200">
                <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5 text-rose-500" />
                <span className="break-all">{runStatusInfo.errorMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Reordering action overlay */}
        {isRealStep && !runStatusInfo && (
          <div className="absolute right-2 bottom-2 flex items-center space-x-1 opacity-0 group-hover/card:opacity-100 transition-opacity bg-secondary/90 backdrop-blur-sm rounded border border-border/40 p-0.5 z-10">
            <button
              onClick={handleMoveUp}
              disabled={isFirst}
              className="p-1 hover:bg-background rounded text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              title="Move Up"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleMoveDown}
              disabled={isLast}
              className="p-1 hover:bg-background rounded text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} id="bottom" className="opacity-0 group-hover/card:opacity-100 transition-opacity !bg-primary" />
      <Handle type="source" position={Position.Right} id="right" className="opacity-0 group-hover/card:opacity-100 transition-opacity !bg-primary" />
    </div>
  );
};

export default StepNode;
