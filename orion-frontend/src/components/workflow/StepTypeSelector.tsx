import React from 'react';
import { Dialog, DialogHeader, DialogTitle, Button, Badge } from '../ui';
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
  Plus,
  Split,
  FileCode,
  Table2,
  MonitorPlay
} from 'lucide-react';

interface StepTypeOption {
  type: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  colorClass: string;
}

interface StepTypeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: string, isGlobalRef?: boolean) => void;
}

export const StepTypeSelector: React.FC<StepTypeSelectorProps> = ({ 
  isOpen, 
  onClose, 
  onSelect 
}) => {
  const primaryOptions: StepTypeOption[] = [
    {
      type: 'HTTP_REQUEST',
      name: 'HTTP Request',
      description: 'Make an API call (GET, POST, PUT, DELETE, etc.)',
      icon: <Globe className="h-5 w-5 text-cyan-400" />,
      colorClass: 'bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/30'
    },
    {
      type: 'SOAP_REQUEST',
      name: 'SOAP Request',
      description: 'Make a SOAP XML call with envelope payloads',
      icon: <FileCode className="h-5 w-5 text-indigo-400" />,
      colorClass: 'bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/30'
    },
    {
      type: 'DATABASE_QUERY',
      name: 'Database Query',
      description: 'Execute queries against target JDBC connections',
      icon: <Database className="h-5 w-5 text-blue-400" />,
      colorClass: 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30'
    }
  ];

  const supportOptions: StepTypeOption[] = [
    {
      type: 'ASSERTION',
      name: 'Validation Assertion',
      description: 'Validate response fields, status codes, or parameters',
      icon: <CheckCircle className="h-5 w-5 text-emerald-400" />,
      colorClass: 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30'
    },
    {
      type: 'SET_VARIABLE',
      name: 'Extract Variable',
      description: 'Extract body/header values to save as variables',
      icon: <HelpCircle className="h-5 w-5 text-pink-400" />,
      colorClass: 'bg-pink-500/10 hover:bg-pink-500/20 border-pink-500/30'
    }
  ];

  const displayOptions: StepTypeOption[] = [
    {
      type: 'LOG',
      name: 'Log Message',
      description: 'Output a customized log message in the execution console',
      icon: <FileText className="h-5 w-5 text-gray-400" />,
      colorClass: 'bg-gray-500/10 hover:bg-gray-500/20 border-gray-500/30'
    },
    {
      type: 'DB_TABLE_VIEW',
      name: 'DB Table View',
      description: 'Run a database query and display the results as a formatted table',
      icon: <Table2 className="h-5 w-5 text-orange-400" />,
      colorClass: 'bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/30'
    }
  ];

  const technicalOptions: StepTypeOption[] = [
    {
      type: 'DELAY',
      name: 'Delay/Pause',
      description: 'Pause the execution flow for a specific duration',
      icon: <Clock className="h-5 w-5 text-yellow-400" />,
      colorClass: 'bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/30'
    },
    {
      type: 'CONDITIONAL',
      name: 'Conditional Branch',
      description: 'Execute subsequent steps based on a logical expression',
      icon: <GitBranch className="h-5 w-5 text-indigo-400" />,
      colorClass: 'bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/30'
    },
    {
      type: 'LOOP',
      name: 'Loop iteration',
      description: 'Repeat a set of steps N times or over an array list',
      icon: <Repeat className="h-5 w-5 text-purple-400" />,
      colorClass: 'bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30'
    },
    {
      type: 'SCRIPT',
      name: 'Custom Script',
      description: 'Evaluate a javascript script/expression context',
      icon: <Terminal className="h-5 w-5 text-teal-400" />,
      colorClass: 'bg-teal-500/10 hover:bg-teal-500/20 border-teal-500/30'
    },
    {
      type: 'PARALLEL',
      name: 'Parallel Group',
      description: 'Run multiple child steps concurrently in parallel threads',
      icon: <Split className="h-5 w-5 text-violet-400" />,
      colorClass: 'bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/30'
    },
    {
      type: 'GLOBAL_REF',
      name: 'Global Step Template',
      description: 'Reference an admin-managed global step configuration',
      icon: <Link className="h-5 w-5 text-amber-400" />,
      colorClass: 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30'
    }
  ];

  const renderOptions = (opts: StepTypeOption[]) => opts.map((opt) => (
    <button
      key={opt.type}
      onClick={() => onSelect(opt.type, opt.type === 'GLOBAL_REF')}
      className={`flex items-start space-x-3 p-3 rounded-lg border text-left cursor-pointer transition-all duration-200 hover:scale-[1.02] ${opt.colorClass}`}
    >
      <div className="shrink-0 p-1 bg-secondary rounded">{opt.icon}</div>
      <div className="min-w-0 flex-1">
        <h4 className="text-sm font-bold text-foreground flex items-center justify-between">
          <span>{opt.name}</span>
          {opt.type === 'GLOBAL_REF' && (
            <Badge variant="secondary" className="text-[8px] py-0 px-1 font-bold">reusable</Badge>
          )}
        </h4>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{opt.description}</p>
      </div>
    </button>
  ));

  return (
    <Dialog isOpen={isOpen} onClose={onClose} size="5xl">
      <DialogHeader>
        <DialogTitle>Add Test Step</DialogTitle>
      </DialogHeader>
      <div className="p-6 overflow-y-auto max-h-[620px]">
        <p className="text-xs text-muted-foreground mb-6">Choose step type to insert into your visual builder sequence:</p>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {/* Column 1: Primary Steps */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 border-b border-cyan-500/20 pb-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-cyan-500" />
              <h3 className="font-extrabold text-xs text-cyan-400 tracking-wider uppercase">Primary Steps</h3>
            </div>
            <div className="flex flex-col gap-3">
              {renderOptions(primaryOptions)}
            </div>
          </div>

          {/* Column 2: Support Steps */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 border-b border-emerald-500/20 pb-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <h3 className="font-extrabold text-xs text-emerald-400 tracking-wider uppercase">Support Steps</h3>
            </div>
            <div className="flex flex-col gap-3">
              {renderOptions(supportOptions)}
            </div>
          </div>

          {/* Column 3: Display Steps */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 border-b border-orange-500/20 pb-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              <h3 className="font-extrabold text-xs text-orange-400 tracking-wider uppercase">Display Steps</h3>
            </div>
            <div className="flex flex-col gap-3">
              {renderOptions(displayOptions)}
            </div>
          </div>

          {/* Column 4: Technical Steps */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 border-b border-purple-500/20 pb-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-purple-500" />
              <h3 className="font-extrabold text-xs text-purple-400 tracking-wider uppercase">Technical Steps</h3>
            </div>
            <div className="flex flex-col gap-3">
              {renderOptions(technicalOptions)}
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-border/40 p-4 bg-secondary/15 flex justify-end">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </Dialog>
  );
};
export default StepTypeSelector;
