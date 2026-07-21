import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { useWorkflowStore } from '../../stores/workflow-store';
import { useAuthStore } from '../../stores/auth-store';
import { Input, Button, Textarea, Select, Switch, Card, CardHeader, CardTitle, CardContent, Tabs, TabsList, TabsTrigger, TabsContent } from '../ui';
import { X, Trash2, HelpCircle, Code, Settings, Split, Play, Variable, Globe, CheckCircle, Clock, GitBranch, Repeat, Terminal, FileText, Database, Link, Table2, MonitorPlay, Monitor, Eye, KeyRound, FileCode, Maximize2 } from 'lucide-react';
import { TestStepDto, EnvironmentDto, DatasetDto } from '../../types/api';
import { toast } from 'sonner';

import { HttpRequestConfig } from './step-configs/HttpRequestConfig';
import { SoapRequestConfig } from './step-configs/SoapRequestConfig';
import { AssertionConfig } from './step-configs/AssertionConfig';
import { SetVariableConfig } from './step-configs/SetVariableConfig';
import { DelayConfig } from './step-configs/DelayConfig';
import { LogConfig } from './step-configs/LogConfig';
import { ScriptConfig } from './step-configs/ScriptConfig';
import { ConditionalConfig } from './step-configs/ConditionalConfig';
import { LoopConfig } from './step-configs/LoopConfig';
import { DatabaseQueryConfig } from './step-configs/DatabaseQueryConfig';
import { DbTableViewConfig } from './step-configs/DbTableViewConfig';
import { ParallelConfig } from './step-configs/ParallelConfig';
import { BrowserAutomationConfig } from './step-configs/BrowserAutomationConfig';
import { CsvExtractConfig } from './step-configs/CsvExtractConfig';
import { MainframeTerminalConfig } from './step-configs/MainframeTerminalConfig';
import { ResponseRecorderConfig } from './step-configs/ResponseRecorderConfig';
import { GraphQLRequestConfig } from './step-configs/GraphQLRequestConfig';
import { AuthTokenConfig } from './step-configs/AuthTokenConfig';
import { DbConnectConfig } from './step-configs/DbConnectConfig';
import { MainframeConnectConfig } from './step-configs/MainframeConnectConfig';
import { InlineStepHelper } from '../shared/InlineStepHelper';

export const parseCurl = (curlCommand: string) => {
  const cleanCmd = curlCommand.replace(/\\\r?\n/g, ' ').trim();
  
  let url = '';
  let method = 'GET';
  const headers: Record<string, string> = {};
  let body = '';
  let bodyType = 'NONE';

  const tokens: string[] = [];
  let currentToken = '';
  let insideQuote = false;
  let quoteChar = '';

  for (let i = 0; i < cleanCmd.length; i++) {
    const char = cleanCmd[i];
    if ((char === '"' || char === "'") && cleanCmd[i - 1] !== '\\') {
      if (insideQuote && quoteChar === char) {
        insideQuote = false;
      } else if (!insideQuote) {
        insideQuote = true;
        quoteChar = char;
      } else {
        currentToken += char;
      }
    } else if (char === ' ' && !insideQuote) {
      if (currentToken) {
        tokens.push(currentToken);
        currentToken = '';
      }
    } else {
      currentToken += char;
    }
  }
  if (currentToken) {
    tokens.push(currentToken);
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].trim();
    if (!token) continue;

    if (token === '-X' || token === '--request') {
      method = tokens[i + 1]?.replace(/^['"]|['"]$/g, '').toUpperCase() || 'GET';
      i++;
    } else if (token === '-H' || token === '--header') {
      const headerVal = tokens[i + 1]?.replace(/^['"]|['"]$/g, '');
      if (headerVal) {
        const colonIdx = headerVal.indexOf(':');
        if (colonIdx !== -1) {
          const key = headerVal.substring(0, colonIdx).trim();
          const val = headerVal.substring(colonIdx + 1).trim();
          headers[key] = val;
        }
      }
      i++;
    } else if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary') {
      body = tokens[i + 1]?.replace(/^['"]|['"]$/g, '') || '';
      bodyType = 'JSON';
      if (method === 'GET') {
        method = 'POST';
      }
      i++;
    } else if (token.startsWith('http://') || token.startsWith('https://')) {
      url = token.replace(/^['"]|['"]$/g, '');
    } else if (token.startsWith('"http://') || token.startsWith('"https://') || token.startsWith("'http://") || token.startsWith("'https://")) {
      url = token.replace(/^['"]|['"]$/g, '');
    } else if (!token.startsWith('-') && !url && i > 0) {
      const prevToken = tokens[i - 1];
      const isFlagValue = ['-X', '--request', '-H', '--header', '-d', '--data', '--data-raw', '--data-binary'].includes(prevToken);
      if (!isFlagValue) {
        const cleanToken = token.replace(/^['"]|['"]$/g, '');
        if (cleanToken.includes('.') || cleanToken.includes('localhost') || cleanToken.includes(':')) {
          url = cleanToken;
        }
      }
    }
  }

  if (body && method === 'GET') {
    method = 'POST';
  }

  return {
    url,
    method,
    headers,
    body,
    bodyType
  };
};

interface StepConfigPanelProps {
  onRunSingleStep?: (stepId: string) => void;
  readOnly?: boolean;
}

export const StepConfigPanel: React.FC<StepConfigPanelProps> = ({ onRunSingleStep, readOnly = false }) => {
  const { appId } = useParams<{ appId: string }>();
  const { steps, selectedStepId, selectStep, updateStep, deleteStep, stepRunStatusMap } = useWorkflowStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const runStatus = stepRunStatusMap[selectedStepId || ''];

  // Fetch environments to get configured databases
  const { data: environments } = useQuery<EnvironmentDto[]>({
    queryKey: ['environments', appId],
    queryFn: async () => {
      const res = await api.get(`/applications/${appId}/environments`);
      return res.data;
    },
    enabled: !!appId,
  });

  // Extract unique db keys configured across environments
  const dbOptions = React.useMemo(() => {
    const dbNames = new Set<string>();
    (environments || []).forEach(env => {
      (env.databases || []).forEach(db => {
        if (db.name) dbNames.add(db.name);
      });
    });
    return [
      { value: '', label: 'Custom JDBC Connection String' },
      ...Array.from(dbNames).map(name => ({ value: name, label: `Environment DB: ${name}` }))
    ];
  }, [environments]);

  // Extract unique certificate keys configured across environments
  const certOptions = React.useMemo(() => {
    const certNames = new Set<string>();
    (environments || []).forEach(env => {
      (env.certificates || []).forEach(cert => {
        if (cert.name) certNames.add(cert.name);
      });
    });
    return [
      { value: '', label: 'None (Use Env Default Certificate)' },
      ...Array.from(certNames).map(name => ({ value: name, label: `Environment Cert: ${name}` }))
    ];
  }, [environments]);

  const datasetOptions = React.useMemo(() => {
    const dsNames = new Set<string>();
    (environments || []).forEach(env => {
      (env.datasets || []).forEach(ds => {
        if (ds.name) dsNames.add(ds.name);
      });
    });
    return [
      { value: '', label: 'Select Environment Dataset' },
      ...Array.from(dsNames).map(name => ({ value: name, label: `Dataset: ${name}` }))
    ];
  }, [environments]);

  const [width, setWidth] = useState(() => Math.round(window.innerWidth * 0.4));
  const [activeSubIndex, setActiveSubIndex] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isCheatsheetOpen, setIsCheatsheetOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const availableVars = React.useMemo(() => {
    const keys = new Set<string>();
    (environments || []).forEach(env => {
      (env.variables || []).forEach(v => {
        if (v.key) keys.add(v.key);
      });
    });
    steps.forEach(s => {
      if (s.stepType === 'SET_VARIABLE' && s.config?.variables) {
        s.config.variables.forEach((v: any) => {
          if (v.variableName) keys.add(v.variableName);
        });
      }
    });
    return Array.from(keys);
  }, [environments, steps]);

  useEffect(() => {
    setShowAdvanced(false);
  }, [selectedStepId]);

  const isSubStep = selectedStepId?.includes('-sub-');
  const parentStepId = isSubStep ? selectedStepId.split('-sub-')[0] : selectedStepId;
  const subStepIdx = isSubStep ? parseInt(selectedStepId.split('-sub-')[1]) : null;

  const step = steps.find((s) => s.id === parentStepId);

  useEffect(() => {
    if (subStepIdx !== null) {
      setActiveSubIndex(subStepIdx);
    }
  }, [subStepIdx]);

  const startResizing = (mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    const startWidth = width;
    const startX = mouseDownEvent.clientX;

    const doDrag = (mouseMoveEvent: MouseEvent) => {
      const newWidth = startWidth + (startX - mouseMoveEvent.clientX);
      if (newWidth >= 300 && newWidth <= Math.round(window.innerWidth * 0.8)) {
        setWidth(newWidth);
      }
    };

    const stopDrag = () => {
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
    };

    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
  };

  if (!step) return null;

  const handleFieldChange = (field: keyof TestStepDto, value: any) => {
    updateStep(step.id, { [field]: value });
  };

  const handleConfigChange = (key: string, value: any) => {
    const newConfig = { ...step.config, [key]: value };
    updateStep(step.id, { config: newConfig });
  };

  const validateStep = (s: TestStepDto) => {
    if (!s.name || s.name.trim() === '') {
      toast.error('Step Name is required.');
      return false;
    }
    if (s.stepType === 'HTTP_REQUEST' && !s.config?.url) {
      toast.error('HTTP Request URL is required.');
      return false;
    }
    if (s.stepType === 'SOAP_REQUEST' && (!s.config?.url || !s.config?.envelope)) {
      toast.error('SOAP Request URL and Envelope are required.');
      return false;
    }
    if ((s.stepType === 'DATABASE_QUERY' || s.stepType === 'DB_TABLE_VIEW') && !s.config?.query) {
      toast.error('Database Query is required.');
      return false;
    }
    if (s.stepType === 'SET_VARIABLE') {
      const vars = Array.isArray(s.config?.variables) ? s.config.variables : [];
      if (vars.some(v => !v.variableName)) {
        toast.error('All Set Variable items must have a Save Key.');
        return false;
      }
    }
    if (s.stepType === 'DB_CONNECT' && !s.config?.databaseKey && !s.config?.connectionString) {
      toast.error('Database Target or JDBC Connection String is required.');
      return false;
    }
    if (s.stepType === 'MAINFRAME_CONNECT' && !s.config?.mainframeHost) {
      toast.error('Mainframe Host is required.');
      return false;
    }
    return true;
  };

  const handleClose = () => {
    if (validateStep(step)) {
      selectStep(null);
    }
  };

  const baseFields = (
    <div className="space-y-4 mb-4 pb-4 border-b border-border/40">
      <div className="space-y-1">
        <label className="text-[10px] font-extrabold uppercase text-muted-foreground">Step Name <span className="text-destructive">*</span></label>
        <Input
          value={step.name}
          onChange={(e) => handleFieldChange('name', e.target.value)}
          className="h-8 py-1 text-sm font-semibold"
        />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-extrabold uppercase text-muted-foreground">Description</label>
        <Textarea
          value={step.description || ''}
          onChange={(e) => handleFieldChange('description', e.target.value)}
          placeholder="Test step brief explanation..."
          rows={2}
          className="text-xs"
        />
      </div>
      <div className="flex items-center justify-between pt-1">
        <div className="space-y-0.5">
          <label className="text-[10px] font-extrabold uppercase text-muted-foreground">Enable Step</label>
          <p className="text-[10px] text-muted-foreground leading-none">Toggle to enable or skip this step.</p>
        </div>
        <Switch
          checked={step.enabled !== false}
          onChange={() => handleFieldChange('enabled', step.enabled === false)}
        />
      </div>
      
      <div className="pt-2 border-t border-border/20">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-[10px] font-extrabold uppercase text-primary hover:underline flex items-center gap-1 cursor-pointer"
        >
          {showAdvanced ? 'Hide' : 'Show'} Advanced Settings (Retry & Timeout)
        </button>
        {showAdvanced && (
          <div className="mt-3 grid grid-cols-3 gap-2 bg-secondary/10 p-2.5 rounded-lg border border-border/30">
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase text-muted-foreground">Timeout (ms)</label>
              <Input
                type="number"
                value={step.config?.timeoutMs ?? 30000}
                onChange={(e) => handleConfigChange('timeoutMs', parseInt(e.target.value) || 30000)}
                className="h-7 text-xs px-1.5"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase text-muted-foreground">Retries</label>
              <Input
                type="number"
                value={step.config?.retries ?? 0}
                onChange={(e) => handleConfigChange('retries', parseInt(e.target.value) || 0)}
                className="h-7 text-xs px-1.5"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase text-muted-foreground">Delay (ms)</label>
              <Input
                type="number"
                value={step.config?.retryIntervalMs ?? 1000}
                onChange={(e) => handleConfigChange('retryIntervalMs', parseInt(e.target.value) || 1000)}
                className="h-7 text-xs px-1.5"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const configRegistry: Record<string, React.ReactNode> = {
    HTTP_REQUEST: (
      <HttpRequestConfig
        step={step}
        updateStep={updateStep}
        handleConfigChange={handleConfigChange}
        certOptions={certOptions}
        baseFields={baseFields}
      />
    ),
    SOAP_REQUEST: (
      <SoapRequestConfig
        step={step}
        updateStep={updateStep}
        handleConfigChange={handleConfigChange}
        certOptions={certOptions}
        baseFields={baseFields}
      />
    ),
    ASSERTION: (
      <AssertionConfig
        step={step}
        handleConfigChange={handleConfigChange}
        handleFieldChange={handleFieldChange}
      />
    ),
    SET_VARIABLE: (
      <SetVariableConfig
        step={step}
        handleConfigChange={handleConfigChange}
      />
    ),
    DELAY: (
      <DelayConfig
        step={step}
        handleConfigChange={handleConfigChange}
      />
    ),
    LOG: (
      <LogConfig
        step={step}
        handleConfigChange={handleConfigChange}
      />
    ),
    SCRIPT: (
      <ScriptConfig
        step={step}
        handleConfigChange={handleConfigChange}
      />
    ),
    CONDITIONAL: (
      <ConditionalConfig
        step={step}
        handleConfigChange={handleConfigChange}
      />
    ),
    LOOP: (
      <LoopConfig
        step={step}
        handleConfigChange={handleConfigChange}
      />
    ),
    DATABASE_QUERY: (
      <DatabaseQueryConfig
        step={step}
        updateStep={updateStep}
        handleConfigChange={handleConfigChange}
        dbOptions={dbOptions}
        baseFields={baseFields}
      />
    ),
    DB_TABLE_VIEW: (
      <DbTableViewConfig
        step={step}
        updateStep={updateStep}
        handleConfigChange={handleConfigChange}
        dbOptions={dbOptions}
        baseFields={baseFields}
      />
    ),
    PARALLEL: (
      <ParallelConfig
        step={step}
        handleConfigChange={handleConfigChange}
        activeSubIndex={activeSubIndex}
        setActiveSubIndex={setActiveSubIndex}
      />
    ),
    BROWSER_AUTOMATION: (
      <BrowserAutomationConfig
        step={step}
        handleConfigChange={handleConfigChange}
      />
    ),
    MAINFRAME_TERMINAL: (
      <MainframeTerminalConfig
        step={step}
        handleConfigChange={handleConfigChange}
      />
    ),
    CSV_EXTRACT: (
      <CsvExtractConfig
        step={step}
        handleConfigChange={handleConfigChange}
        datasetOptions={datasetOptions}
      />
    ),
    RESPONSE_PROCESSOR: (
      <ResponseRecorderConfig
        step={step}
        handleConfigChange={handleConfigChange}
      />
    ),
    GRAPHQL_REQUEST: (
      <GraphQLRequestConfig
        step={step}
        updateStep={updateStep}
        handleConfigChange={handleConfigChange}
        certOptions={certOptions}
        baseFields={baseFields}
      />
    ),
    AUTH_TOKEN: (
      <AuthTokenConfig
        step={step}
        handleConfigChange={handleConfigChange}
      />
    ),
    DB_CONNECT: (
      <DbConnectConfig
        step={step}
        updateStep={updateStep}
        handleConfigChange={handleConfigChange}
        dbOptions={dbOptions}
      />
    ),
    MAINFRAME_CONNECT: (
      <MainframeConnectConfig
        step={step}
        handleConfigChange={handleConfigChange}
      />
    ),
  };

  const renderConfigForm = () => {
    return configRegistry[step.stepType] || (
      <div className="text-xs text-muted-foreground py-4">No custom settings required for this step.</div>
    );
  };

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'HTTP_REQUEST':
        return <Globe className="h-5 w-5 text-cyan-400 animate-in spin-in-12 duration-500" />;
      case 'ASSERTION':
        return <CheckCircle className="h-5 w-5 text-emerald-400 animate-in zoom-in-50 duration-300" />;
      case 'DELAY':
        return <Clock className="h-5 w-5 text-yellow-400 animate-in spin-in-12 duration-500" />;
      case 'SET_VARIABLE':
        return <HelpCircle className="h-5 w-5 text-pink-400 animate-in zoom-in-50 duration-300" />;
      case 'CONDITIONAL':
        return <GitBranch className="h-5 w-5 text-indigo-400" />;
      case 'LOOP':
        return <Repeat className="h-5 w-5 text-purple-400" />;
      case 'SCRIPT':
        return <Terminal className="h-5 w-5 text-teal-400" />;
      case 'LOG':
        return <FileText className="h-5 w-5 text-gray-400" />;
      case 'DATABASE_QUERY':
        return <Database className="h-5 w-5 text-blue-400 animate-in slide-in-from-bottom-1 duration-300" />;
      case 'DB_TABLE_VIEW':
        return <Table2 className="h-5 w-5 text-orange-400" />;
      case 'GLOBAL_REF':
        return <Link className="h-5 w-5 text-amber-400" />;
      case 'PARALLEL':
        return <Split className="h-5 w-5 text-violet-400" />;
      case 'SOAP_REQUEST':
        return <FileCode className="h-5 w-5 text-indigo-400" />;
      case 'BROWSER_AUTOMATION':
        return <MonitorPlay className="h-5 w-5 text-teal-400 animate-in slide-in-from-bottom-1 duration-300" />;
      case 'MAINFRAME_TERMINAL':
        return <Monitor className="h-5 w-5 text-lime-400 animate-in slide-in-from-bottom-1 duration-300" />;
      case 'RESPONSE_PROCESSOR':
        return <Eye className="h-5 w-5 text-amber-400" />;
      case 'GRAPHQL_REQUEST':
        return <Globe className="h-5 w-5 text-purple-400" />;
      case 'AUTH_TOKEN':
        return <KeyRound className="h-5 w-5 text-cyan-400" />;
      case 'DB_CONNECT':
        return <Database className="h-5 w-5 text-cyan-400" />;
      case 'MAINFRAME_CONNECT':
        return <Monitor className="h-5 w-5 text-emerald-400" />;
      default:
        return <Settings className="h-5 w-5 text-primary" />;
    }
  };

  const getStepCategoryLabel = (type: string) => {
    switch (type) {
      case 'HTTP_REQUEST':
      case 'SOAP_REQUEST':
      case 'GRAPHQL_REQUEST':
        return 'Protocol Request (API)';
      case 'DATABASE_QUERY':
      case 'DB_CONNECT':
      case 'DB_TABLE_VIEW':
        return 'Data Source Connection';
      case 'BROWSER_AUTOMATION':
      case 'MAINFRAME_TERMINAL':
      case 'MAINFRAME_CONNECT':
        return 'UI & Terminal Automation';
      case 'AUTH_TOKEN':
        return 'Security & Authorization';
      default:
        return 'Flow Control & Logic';
    }
  };

  if (!step) {
    return null;
  }

  const asideDrawer = (
    <aside 
      style={{ width: `${width}px` }}
      className="step-config-panel border-l border-border bg-card text-card-foreground flex flex-col h-full shadow-lg relative z-20"
    >
      {/* Resize Handle */}
      <div 
        onMouseDown={startResizing}
        className="absolute top-0 left-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-primary/50 transition-colors z-30"
      />
      <div className="flex items-center justify-between min-h-16 px-4 border-b border-border bg-secondary/15 backdrop-blur-md">
        <div className="flex items-center space-x-3 py-1 min-w-0">
          <div className="p-2 rounded-xl bg-background border border-border/30 shadow-sm flex items-center justify-center shrink-0">
            {getStepIcon(step.stepType)}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-extrabold text-foreground tracking-wide truncate uppercase">
              {step.name}
            </span>
            <span className="text-[10px] text-muted-foreground/80 font-medium truncate mt-0.5">
              {getStepCategoryLabel(step.stepType)}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-1 shrink-0">
          {onRunSingleStep && (
            <button
              onClick={() => onRunSingleStep(step.id)}
              className="h-8 px-2.5 rounded-lg border border-primary/20 hover:border-primary/50 text-xs font-bold text-primary bg-primary/5 hover:bg-primary/10 transition-all flex items-center gap-1.5 cursor-pointer mr-1"
              title="Test run this single step"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Test Step</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="h-8 w-8 rounded-lg hover:bg-secondary flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground border border-transparent hover:border-border/30 transition-all mr-1"
            title="Expand to Fullscreen Dialog"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button 
            onClick={handleClose}
            className="h-8 w-8 rounded-lg hover:bg-secondary flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground border border-transparent hover:border-border/30 transition-all"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Optional Inline Step Documentation Helper */}
        {step && <InlineStepHelper stepType={step.stepType} />}

        {/* Variables Cheatsheet Accordion */}
        {availableVars.length > 0 && (
          <div className="border border-border/40 rounded-lg overflow-hidden bg-secondary/5 animate-in fade-in duration-200">
            <button
              type="button"
              onClick={() => setIsCheatsheetOpen(!isCheatsheetOpen)}
              className="w-full flex items-center justify-between p-2.5 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider hover:bg-secondary/20 transition-all cursor-pointer"
            >
              <span className="flex items-center gap-1.5 text-foreground font-extrabold">
                <Variable className="h-3.5 w-3.5 text-primary" />
                Variables Cheatsheet ({availableVars.length})
              </span>
              <span>{isCheatsheetOpen ? '▲' : '▼'}</span>
            </button>
            
            {isCheatsheetOpen && (
              <div className="p-3 pt-1 border-t border-border/20 space-y-2 max-h-40 overflow-y-auto scrollbar-thin">
                <p className="text-[9px] text-muted-foreground leading-relaxed">Click any variable below to copy its interpolation placeholder to your clipboard:</p>
                <div className="flex flex-wrap gap-1.5">
                  {availableVars.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`{{${v}}}`);
                        toast.success(`Copied placeholder: {{${v}}}`);
                      }}
                      className="text-[10px] font-mono font-bold text-slate-300 bg-background hover:text-primary hover:border-primary/50 transition-all px-1.5 py-0.5 rounded border border-border/30 cursor-pointer flex items-center gap-1"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <fieldset disabled={readOnly} className="contents">
          {/* If the component doesn't expect baseFields as a prop, we render it directly here */}
          {['HTTP_REQUEST', 'SOAP_REQUEST', 'DATABASE_QUERY', 'DB_TABLE_VIEW'].includes(step.stepType) ? (
            renderConfigForm()
          ) : (
            <>
              {baseFields}
              {renderConfigForm()}
            </>
          )}
        </fieldset>

        {/* Step Playground & Live Execution Inspector */}
        {runStatus && (
          <div className="mt-4 p-3 rounded-lg border border-border/50 bg-secondary/20 space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                <Play className="h-3.5 w-3.5 text-cyan-400" />
                <span>Last Execution Status</span>
              </span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                runStatus.status === 'PASSED' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                runStatus.status === 'FAILED' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                runStatus.status === 'RUNNING' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                'bg-slate-500/20 text-slate-300'
              }`}>
                {runStatus.status}
              </span>
            </div>
            {runStatus.errorMessage && (
              <p className="text-[11px] font-mono text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20 leading-normal break-all">
                {runStatus.errorMessage}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer actions */}
      {!readOnly && (
        <div className="p-4 border-t border-border bg-secondary/10 flex justify-between items-center space-x-2">
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => deleteStep(step.id)}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive flex items-center h-8"
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Remove Step
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await api.post(`/global/test-steps/promote/${step.id}`);
                    toast.success('Step saved as Global Step Template!');
                  } catch (err: any) {
                    toast.error(err.response?.data?.message || 'Failed to promote step to Global Library.');
                  }
                }}
                className="flex items-center text-xs h-8 border-primary/30 text-primary hover:bg-primary/10"
              >
                <Globe className="mr-1.5 h-3.5 w-3.5" />
                Save as Global Step
              </Button>
            )}
          </div>
          {onRunSingleStep && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRunSingleStep(step.id)}
              className="flex items-center text-xs h-8 border-cyan-500/30 text-cyan-500 bg-cyan-500/5 hover:bg-cyan-500/10"
            >
              <Play className="mr-1.5 h-3.5 w-3.5 fill-cyan-500 text-cyan-500" />
              Run Step
            </Button>
          )}
        </div>
      )}
    </aside>
  );

  return (
    <>
      {asideDrawer}
      
      {/* Expanded Full Editor Popup Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-6xl h-[88vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between min-h-16 px-6 border-b border-border bg-secondary/15 backdrop-blur-md">
              <div className="flex items-center space-x-3 py-1">
                <div className="p-2 rounded-xl bg-background border border-border/30 shadow-sm flex items-center justify-center">
                  {getStepIcon(step.stepType)}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-extrabold text-foreground tracking-wide uppercase">
                    {step.name}
                  </span>
                  <span className="text-xs text-muted-foreground/80 font-medium mt-0.5">
                    {getStepCategoryLabel(step.stepType)} &mdash; Full Editor Mode
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] text-muted-foreground/75 font-semibold mr-1.5 flex items-center gap-1 bg-secondary/35 px-2.5 py-1 rounded-md border border-border/30 animate-in fade-in duration-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Changes saved automatically
                </span>
                {onRunSingleStep && (
                  <button
                    onClick={() => onRunSingleStep(step.id)}
                    className="h-9 px-3 rounded-lg border border-primary/20 hover:border-primary/50 text-xs font-bold text-primary bg-primary/5 hover:bg-primary/10 transition-all flex items-center gap-1.5 cursor-pointer mr-1"
                    title="Test run this single step"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Test Step</span>
                  </button>
                )}
                <button 
                  onClick={() => {
                    setIsModalOpen(false);
                    toast.success('Configuration changes updated!');
                  }}
                  className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-md hover:shadow-emerald-950/20 flex items-center gap-1 cursor-pointer transition-all border border-emerald-500/20"
                >
                  <span>Save & Close</span>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 grid grid-cols-12 min-h-0 divide-x divide-border">
              {/* Left Column (Metadata, Advanced, Instructions) */}
              <div className="col-span-4 p-6 overflow-y-auto space-y-5 h-full scrollbar-thin">
                <fieldset disabled={readOnly} className="space-y-5">
                  {baseFields}
                  <InlineStepHelper stepType={step.stepType} />
                  
                  {availableVars.length > 0 && (
                    <div className="border border-border/40 rounded-lg overflow-hidden bg-secondary/5">
                      <div className="p-2.5 px-3 text-[10px] font-bold text-foreground border-b border-border/20 uppercase tracking-wider bg-secondary/10 flex items-center gap-1.5">
                        <Variable className="h-3.5 w-3.5 text-primary" />
                        Available Context Variables
                      </div>
                      <div className="p-3 space-y-2 max-h-52 overflow-y-auto scrollbar-thin">
                        <p className="text-[9px] text-muted-foreground leading-relaxed">Click to copy placeholder to clipboard:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {availableVars.map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(`{{${v}}}`);
                                toast.success(`Copied placeholder: {{${v}}}`);
                              }}
                              className="text-[10px] font-mono font-bold text-slate-300 bg-background hover:text-primary hover:border-primary/50 transition-all px-1.5 py-0.5 rounded border border-border/30 cursor-pointer"
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </fieldset>
              </div>

              {/* Right Column (Step-specific configs, big screen) */}
              <div className="col-span-8 p-6 overflow-y-auto h-full bg-secondary/5 scrollbar-thin">
                <fieldset disabled={readOnly} className="space-y-4">
                  {renderConfigForm()}
                </fieldset>
              </div>
            </div>

            {/* Modal Footer */}
            {!readOnly && (
              <div className="p-4 px-6 border-t border-border bg-card flex justify-between items-center space-x-2">
                <div className="flex items-center space-x-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setIsModalOpen(false);
                      deleteStep(step.id);
                    }}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive flex items-center h-8"
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Remove Step
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await api.post(`/global/test-steps/promote/${step.id}`);
                          toast.success('Step saved as Global Step Template!');
                        } catch (err: any) {
                          toast.error(err.response?.data?.message || 'Failed to promote step to Global Library.');
                        }
                      }}
                      className="flex items-center text-xs h-8 border-primary/30 text-primary hover:bg-primary/10"
                    >
                      <Globe className="mr-1.5 h-3.5 w-3.5" />
                      Save as Global Step
                    </Button>
                  )}
                </div>
                {onRunSingleStep && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRunSingleStep(step.id)}
                    className="flex items-center text-xs h-8 border-cyan-500/30 text-cyan-500 bg-cyan-500/5 hover:bg-cyan-500/10"
                  >
                    <Play className="mr-1.5 h-3.5 w-3.5 fill-cyan-500 text-cyan-500" />
                    Run Step
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
export default StepConfigPanel;
