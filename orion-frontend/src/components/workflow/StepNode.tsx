import React from 'react';
import { Handle, Position } from 'reactflow';
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
  FileCode
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
  const { selectedStepId, selectStep } = useWorkflowStore();
  const isSelected = selectedStepId === step.id;

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
      case 'GLOBAL_REF':
        return <Link className="h-5 w-5 text-amber-400" />;
      case 'PARALLEL':
        return <Split className="h-5 w-5 text-violet-400" />;
      case 'SOAP_REQUEST':
        return <FileCode className="h-5 w-5 text-indigo-400" />;
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
      case 'GLOBAL_REF': return 'border-amber-500/30 bg-amber-500/5';
      case 'PARALLEL': return 'border-violet-500/30 bg-violet-500/5';
      case 'SOAP_REQUEST': return 'border-indigo-500/30 bg-indigo-500/5';
      default: return 'border-border/60 bg-card';
    }
  };

  return (
    <div className="relative group">
      {/* Handles for React Flow connections */}
      <Handle type="target" position={Position.Top} className="opacity-0 group-hover:opacity-100 transition-opacity !bg-primary" />
      
      <div 
        onClick={() => selectStep(step.id)}
        className={cn(
          "w-80 rounded-lg border-2 p-4 text-card-foreground shadow-md transition-all duration-200 cursor-pointer text-left hover:scale-[1.01]",
          getStepColorClass(step.stepType),
          isSelected ? "border-primary ring-2 ring-primary/20 scale-[1.01]" : "border-border/60"
        )}
      >
        <div className="flex items-start space-x-3.5">
          {/* Icon */}
          <div className="h-10 w-10 rounded-md bg-secondary flex items-center justify-center shrink-0 border border-border/20">
            {getStepIcon(step.stepType)}
          </div>
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Step {step.sequenceOrder} • {step.stepType.replace('_', ' ')}
              </span>
              {step.isGlobalRef && (
                <Badge variant="secondary" className="text-[9px] py-0 px-1 font-bold">template</Badge>
              )}
            </div>
            <h4 className="text-sm font-bold text-foreground truncate mt-0.5">{step.name}</h4>
            {step.stepType === 'PARALLEL' ? (
              <p className="text-xs text-muted-foreground italic mt-1">
                Concurrently running sub-steps below...
              </p>
            ) : (
              <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                {step.description || 'Configure parameters...'}
              </p>
            )}
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="opacity-0 group-hover:opacity-100 transition-opacity !bg-primary" />
    </div>
  );
};
export default StepNode;
