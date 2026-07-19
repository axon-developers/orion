import React, { useState } from 'react';
import { Dialog, DialogHeader, DialogTitle, Button, Badge, Input } from '../ui';
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
  Split,
  FileCode,
  Table2,
  MonitorPlay,
  FileJson,
  Monitor,
  Eye,
  KeyRound,
  Search,
  Shield,
  Layers,
  Sparkles,
  ArrowRightLeft
} from 'lucide-react';

export interface StepTypeOption {
  type: string;
  name: string;
  description: string;
  category: 'PROTOCOL' | 'DATA_SOURCES' | 'UI_TERMINAL' | 'SECURITY' | 'FLOW_CONTROL';
  isSatellite?: boolean;
  icon: React.ReactNode;
  colorClass: string;
}

interface StepTypeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: string, isGlobalRef?: boolean) => void;
}

export const STEP_OPTIONS: StepTypeOption[] = [
  // 1. PROTOCOL
  {
    type: 'HTTP_REQUEST',
    name: 'HTTP / REST Request',
    description: 'Make REST API calls (GET, POST, PUT, DELETE, PATCH)',
    category: 'PROTOCOL',
    icon: <Globe className="h-5 w-5 text-cyan-400" />,
    colorClass: 'bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/30'
  },
  {
    type: 'GRAPHQL_REQUEST',
    name: 'GraphQL Request',
    description: 'Run GraphQL queries and mutations over HTTP endpoint',
    category: 'PROTOCOL',
    icon: <Globe className="h-5 w-5 text-purple-400" />,
    colorClass: 'bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30'
  },
  {
    type: 'SOAP_REQUEST',
    name: 'SOAP / XML Request',
    description: 'Call SOAP services with custom XML envelope payloads',
    category: 'PROTOCOL',
    icon: <FileCode className="h-5 w-5 text-indigo-400" />,
    colorClass: 'bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/30'
  },

  // 2. DATA SOURCES
  {
    type: 'DB_CONNECT',
    name: 'Database Session',
    description: 'Open and cache a reusable JDBC connection session',
    category: 'DATA_SOURCES',
    icon: <Database className="h-5 w-5 text-cyan-400" />,
    colorClass: 'bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/30'
  },
  {
    type: 'DATABASE_QUERY',
    name: 'Database Query',
    description: 'Execute SQL queries against cached or active DB sessions',
    category: 'DATA_SOURCES',
    icon: <Database className="h-5 w-5 text-blue-400" />,
    colorClass: 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30'
  },
  {
    type: 'CSV_EXTRACT',
    name: 'CSV Data Feed',
    description: 'Load test data rows from inline CSV or environment dataset',
    category: 'DATA_SOURCES',
    icon: <FileJson className="h-5 w-5 text-amber-400" />,
    colorClass: 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30'
  },
  {
    type: 'DB_TABLE_VIEW',
    name: 'Table Result View',
    description: 'Format & snapshot database query output as a table in reports',
    category: 'DATA_SOURCES',
    isSatellite: true,
    icon: <Table2 className="h-5 w-5 text-teal-400" />,
    colorClass: 'bg-teal-500/10 hover:bg-teal-500/20 border-teal-500/30'
  },

  // 3. UI & TERMINAL
  {
    type: 'BROWSER_AUTOMATION',
    name: 'Web Browser Automation',
    description: 'Drive Playwright browser (navigate, click, fill forms, screenshot)',
    category: 'UI_TERMINAL',
    icon: <MonitorPlay className="h-5 w-5 text-teal-400" />,
    colorClass: 'bg-teal-500/10 hover:bg-teal-500/20 border-teal-500/30'
  },
  {
    type: 'MAINFRAME_CONNECT',
    name: 'Mainframe Session',
    description: 'Establish and cache a TN3270 terminal connection session',
    category: 'UI_TERMINAL',
    icon: <Monitor className="h-5 w-5 text-emerald-400" />,
    colorClass: 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30'
  },
  {
    type: 'MAINFRAME_TERMINAL',
    name: 'Mainframe Screen Action',
    description: 'Navigate 3270 mainframe screens, send keys, and scrape output',
    category: 'UI_TERMINAL',
    icon: <Monitor className="h-5 w-5 text-lime-400" />,
    colorClass: 'bg-lime-500/10 hover:bg-lime-500/20 border-lime-500/30'
  },

  // 4. SECURITY & AUTH
  {
    type: 'AUTH_TOKEN',
    name: 'Generate Auth Token',
    description: 'Generate OAuth2/Basic tokens dynamically with auto-refresh',
    category: 'SECURITY',
    icon: <KeyRound className="h-5 w-5 text-cyan-400" />,
    colorClass: 'bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/30'
  },

  // 5. FLOW CONTROL & LOGIC
  {
    type: 'ASSERTION',
    name: 'Validate / Assert',
    description: 'Check status codes, body JSONPath, or header values',
    category: 'FLOW_CONTROL',
    isSatellite: true,
    icon: <CheckCircle className="h-5 w-5 text-emerald-400" />,
    colorClass: 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30'
  },
  {
    type: 'SET_VARIABLE',
    name: 'Extract & Store Variable',
    description: 'Extract body/header values into runtime context variables',
    category: 'FLOW_CONTROL',
    isSatellite: true,
    icon: <HelpCircle className="h-5 w-5 text-pink-400" />,
    colorClass: 'bg-pink-500/10 hover:bg-pink-500/20 border-pink-500/30'
  },
  {
    type: 'RESPONSE_PROCESSOR',
    name: 'Response Recorder',
    description: 'Record, search, truncate, and inspect response body segments',
    category: 'FLOW_CONTROL',
    isSatellite: true,
    icon: <Eye className="h-5 w-5 text-amber-400" />,
    colorClass: 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30'
  },
  {
    type: 'CONDITIONAL',
    name: 'If / Conditional Branch',
    description: 'Execute subsequent steps based on logical expression condition',
    category: 'FLOW_CONTROL',
    icon: <GitBranch className="h-5 w-5 text-indigo-400" />,
    colorClass: 'bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/30'
  },
  {
    type: 'LOOP',
    name: 'Loop / Repeat',
    description: 'Repeat child steps N times or iterate over a data array',
    category: 'FLOW_CONTROL',
    icon: <Repeat className="h-5 w-5 text-purple-400" />,
    colorClass: 'bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30'
  },
  {
    type: 'PARALLEL',
    name: 'Parallel Group',
    description: 'Run multiple child steps concurrently in parallel threads',
    category: 'FLOW_CONTROL',
    icon: <Split className="h-5 w-5 text-violet-400" />,
    colorClass: 'bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/30'
  },
  {
    type: 'SCRIPT',
    name: 'Custom Script (JS)',
    description: 'Evaluate custom JavaScript expression and mutate context',
    category: 'FLOW_CONTROL',
    icon: <Terminal className="h-5 w-5 text-teal-400" />,
    colorClass: 'bg-teal-500/10 hover:bg-teal-500/20 border-teal-500/30'
  },
  {
    type: 'DELAY',
    name: 'Wait / Delay',
    description: 'Pause execution flow for a specific duration in milliseconds',
    category: 'FLOW_CONTROL',
    icon: <Clock className="h-5 w-5 text-yellow-400" />,
    colorClass: 'bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/30'
  },
  {
    type: 'LOG',
    name: 'Log Message',
    description: 'Print a customized debug log message in execution console',
    category: 'FLOW_CONTROL',
    icon: <FileText className="h-5 w-5 text-gray-400" />,
    colorClass: 'bg-gray-500/10 hover:bg-gray-500/20 border-gray-500/30'
  },
  {
    type: 'GLOBAL_REF',
    name: 'Reusable Step Template',
    description: 'Reference an admin-managed global step configuration',
    category: 'FLOW_CONTROL',
    icon: <Link className="h-5 w-5 text-amber-400" />,
    colorClass: 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30'
  }
];

type CategoryKey = 'ALL' | 'PROTOCOL' | 'DATA_SOURCES' | 'UI_TERMINAL' | 'SECURITY' | 'FLOW_CONTROL';

interface CategoryMeta {
  key: CategoryKey;
  label: string;
  icon: React.ReactNode;
  badgeColor: string;
}

const CATEGORIES: CategoryMeta[] = [
  { key: 'ALL', label: 'All Step Types', icon: <Layers className="h-4 w-4" />, badgeColor: 'bg-slate-500/20 text-slate-300' },
  { key: 'PROTOCOL', label: 'Protocol (API)', icon: <Globe className="h-4 w-4 text-cyan-400" />, badgeColor: 'bg-cyan-500/20 text-cyan-300' },
  { key: 'DATA_SOURCES', label: 'Data Sources', icon: <Database className="h-4 w-4 text-blue-400" />, badgeColor: 'bg-blue-500/20 text-blue-300' },
  { key: 'UI_TERMINAL', label: 'UI & Terminal', icon: <MonitorPlay className="h-4 w-4 text-teal-400" />, badgeColor: 'bg-teal-500/20 text-teal-300' },
  { key: 'SECURITY', label: 'Security & Auth', icon: <Shield className="h-4 w-4 text-cyan-400" />, badgeColor: 'bg-cyan-500/20 text-cyan-300' },
  { key: 'FLOW_CONTROL', label: 'Flow & Logic', icon: <GitBranch className="h-4 w-4 text-purple-400" />, badgeColor: 'bg-purple-500/20 text-purple-300' },
];

export const StepTypeSelector: React.FC<StepTypeSelectorProps> = ({ 
  isOpen, 
  onClose, 
  onSelect 
}) => {
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOptions = STEP_OPTIONS.filter((opt) => {
    const matchesCategory = activeCategory === 'ALL' || opt.category === activeCategory;
    const matchesSearch = !searchQuery.trim() || 
      opt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opt.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opt.type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getCategoryCount = (catKey: CategoryKey) => {
    if (catKey === 'ALL') return STEP_OPTIONS.length;
    return STEP_OPTIONS.filter(o => o.category === catKey).length;
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} size="5xl">
      <DialogHeader>
        <div className="flex items-center justify-between w-full pr-6">
          <DialogTitle className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-cyan-400" />
            <span>Add Test Step</span>
          </DialogTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search steps..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs bg-background/50 border-border/60"
            />
          </div>
        </div>
      </DialogHeader>

      <div className="flex h-[560px] overflow-hidden">
        {/* Left Sidebar: Categories */}
        <div className="w-56 border-r border-border/40 bg-secondary/10 p-3 space-y-1 shrink-0 overflow-y-auto">
          <p className="text-[10px] font-bold text-muted-foreground uppercase px-2 py-1 tracking-wider">
            Categories
          </p>
          {CATEGORIES.map((cat) => {
            const count = getCategoryCount(cat.key);
            const isActive = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-semibold transition-all duration-150 text-left ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <span className={isActive ? 'text-primary-foreground' : ''}>{cat.icon}</span>
                  <span className="truncate">{cat.label}</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                  isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-secondary text-muted-foreground'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}

          <div className="pt-4 border-t border-border/30 mt-4 px-2 space-y-2">
            <div className="p-2.5 rounded-lg bg-cyan-950/20 border border-cyan-500/20 text-[11px]">
              <div className="flex items-center space-x-1 text-cyan-400 font-bold mb-1">
                <ArrowRightLeft className="h-3.5 w-3.5" />
                <span>Layout Rules</span>
              </div>
              <p className="text-muted-foreground text-[10px] leading-relaxed">
                <strong className="text-foreground">Vertical steps</strong> form the main sequence trunk.
              </p>
              <p className="text-muted-foreground text-[10px] leading-relaxed mt-1">
                <strong className="text-teal-400">Satellite steps</strong> (Validate, Extract, Table View) branch horizontally to the right.
              </p>
            </div>
          </div>
        </div>

        {/* Right Panel: Step Cards */}
        <div className="flex-1 p-5 overflow-y-auto bg-background/40">
          {filteredOptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-6">
              <Search className="h-10 w-10 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-semibold">No steps found matching "{searchQuery}"</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Try searching for a different keyword or switch categories.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredOptions.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => onSelect(opt.type, opt.type === 'GLOBAL_REF')}
                  className={`flex items-start space-x-3.5 p-3.5 rounded-xl border text-left cursor-pointer transition-all duration-200 hover:scale-[1.01] hover:shadow-md ${opt.colorClass}`}
                >
                  <div className="shrink-0 p-2 bg-background/80 rounded-lg border border-border/40 shadow-xs">
                    {opt.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between space-x-2">
                      <h4 className="text-xs font-bold text-foreground truncate">
                        {opt.name}
                      </h4>
                      {opt.isSatellite && (
                        <Badge variant="outline" className="text-[9px] py-0 px-1.5 font-semibold border-teal-500/40 text-teal-400 shrink-0">
                          → Satellite
                        </Badge>
                      )}
                      {opt.type === 'GLOBAL_REF' && (
                        <Badge variant="secondary" className="text-[9px] py-0 px-1.5 font-bold shrink-0">
                          reusable
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                      {opt.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border/40 p-3.5 bg-secondary/15 flex justify-between items-center px-6">
        <span className="text-[11px] text-muted-foreground">
          Showing {filteredOptions.length} of {STEP_OPTIONS.length} available step types
        </span>
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
      </div>
    </Dialog>
  );
};

export default StepTypeSelector;

