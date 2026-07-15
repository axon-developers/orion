import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { useWorkflowStore } from '../../stores/workflow-store';
import { Input, Button, Textarea, Select, Switch, Card, CardHeader, CardTitle, CardContent, Tabs, TabsList, TabsTrigger, TabsContent } from '../ui';
import { X, Trash2, HelpCircle, Code, Settings, Split, Play } from 'lucide-react';
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
  const { steps, selectedStepId, selectStep, updateStep, deleteStep } = useWorkflowStore();

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
  };

  const renderConfigForm = () => {
    return configRegistry[step.stepType] || (
      <div className="text-xs text-muted-foreground py-4">No custom settings required for this step.</div>
    );
  };

  return (
    <aside 
      style={{ width: `${width}px` }}
      className="border-l border-border bg-card text-card-foreground flex flex-col h-full shadow-lg relative z-20"
    >
      {/* Resize Handle */}
      <div 
        onMouseDown={startResizing}
        className="absolute top-0 left-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-primary/50 transition-colors z-30"
      />
      <div className="flex items-center justify-between h-14 px-4 border-b border-border">
        <span className="flex items-center space-x-1.5 text-xs font-bold text-foreground">
          <Settings className="h-4 w-4 text-primary" />
          <span>STEP CONFIGURATION</span>
        </span>
        <button 
          onClick={handleClose}
          className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
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
      </div>

      {/* Footer actions */}
      {!readOnly && (
        <div className="p-4 border-t border-border bg-secondary/10 flex justify-between items-center">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => deleteStep(step.id)}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive flex items-center h-8"
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Remove Step
          </Button>
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
};
export default StepConfigPanel;
