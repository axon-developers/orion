import React, { useEffect, useState } from 'react';
import { Input, Select, Button, Textarea } from '../../ui';
import { TestStepDto } from '../../../types/api';
import { Plus, Trash2 } from 'lucide-react';
import JsonTreeViewer from './JsonTreeViewer';
import { toast } from 'sonner';

interface SetVariableConfigProps {
  step: TestStepDto;
  handleConfigChange: (key: string, value: any) => void;
}

export const SetVariableConfig: React.FC<SetVariableConfigProps> = ({
  step,
  handleConfigChange
}) => {
  const [activeHelperIndex, setActiveHelperIndex] = useState<number | null>(null);
  const [mockJson, setMockJson] = useState('{\n  "status": "success",\n  "data": {\n    "id": 12345,\n    "user": "John Doe",\n    "roles": ["Admin", "Tester"]\n  }\n}');
  const [parsedJson, setParsedJson] = useState<any>({
    status: "success",
    data: {
      id: 12345,
      user: "John Doe",
      roles: ["Admin", "Tester"]
    }
  });

  const handleMockJsonChange = (val: string) => {
    setMockJson(val);
    try {
      setParsedJson(JSON.parse(val));
    } catch (err) {
      setParsedJson(null);
    }
  };

  // Initialize with legacy or empty
  const variables = Array.isArray(step.config.variables) ? step.config.variables : [];

  useEffect(() => {
    // Migration from old schema
    if (!step.config.variables && step.config.variableName) {
      handleConfigChange('variables', [{
        variableName: step.config.variableName,
        source: step.config.source || 'RESPONSE_BODY',
        payloadFormat: step.config.payloadFormat || (step.config.xPath ? 'XML' : 'JSON'),
        jsonPath: step.config.jsonPath || '',
        xPath: step.config.xPath || '',
        headerName: step.config.headerName || ''
      }]);
    } else if (!step.config.variables) {
      handleConfigChange('variables', [{
        variableName: '',
        source: 'RESPONSE_BODY',
        payloadFormat: 'JSON',
        jsonPath: '',
        xPath: '',
        headerName: ''
      }]);
    }
  }, [step.config.variables, step.config.variableName, handleConfigChange]);

  const updateVariable = (index: number, key: string, value: any) => {
    const newVars = [...variables];
    newVars[index] = { ...newVars[index], [key]: value };
    
    // Auto-clear conflicting fields
    if (key === 'payloadFormat') {
      if (value === 'JSON') newVars[index].xPath = '';
      else newVars[index].jsonPath = '';
    }
    
    handleConfigChange('variables', newVars);
  };

  const addVariable = () => {
    handleConfigChange('variables', [...variables, {
      variableName: '',
      source: 'RESPONSE_BODY',
      payloadFormat: 'JSON',
      jsonPath: '',
      xPath: '',
      headerName: ''
    }]);
  };

  const removeVariable = (index: number) => {
    const newVars = [...variables];
    newVars.splice(index, 1);
    handleConfigChange('variables', newVars);
    if (activeHelperIndex === index) {
      setActiveHelperIndex(null);
    }
  };

  return (
    <div className="space-y-3">
      {variables.map((v: any, index: number) => {
        const source = v.source || 'RESPONSE_BODY';
        const payloadFormat = v.payloadFormat || (v.xPath ? 'XML' : 'JSON');

        return (
          <div key={index} className="flex flex-col p-2.5 border border-border/50 rounded-md bg-card/30 space-y-2">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-[100px] space-y-1">
                <label className="text-[9px] font-bold uppercase text-muted-foreground">Save Key</label>
                <Input
                  placeholder="e.g. token"
                  value={v.variableName || ''}
                  onChange={(e) => updateVariable(index, 'variableName', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              
              <div className="w-[100px] space-y-1">
                <label className="text-[9px] font-bold uppercase text-muted-foreground">Source</label>
                <Select
                  options={[
                    { value: 'RESPONSE_BODY', label: 'Body' },
                    { value: 'RESPONSE_HEADER', label: 'Header' },
                  ]}
                  value={source}
                  onChange={(e) => updateVariable(index, 'source', e.target.value)}
                  className="h-8 text-xs py-1 px-2"
                />
              </div>

              {source === 'RESPONSE_BODY' && (
                <div className="w-[80px] space-y-1">
                  <label className="text-[9px] font-bold uppercase text-muted-foreground">Format</label>
                  <Select
                    options={[
                      { value: 'JSON', label: 'JSON' },
                      { value: 'XML', label: 'XML' },
                    ]}
                    value={payloadFormat}
                    onChange={(e) => updateVariable(index, 'payloadFormat', e.target.value)}
                    className="h-8 text-xs py-1 px-2"
                  />
                </div>
              )}

              <div className="flex-[2] min-w-[120px] space-y-1">
                {source === 'RESPONSE_BODY' ? (
                  <>
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-bold uppercase text-muted-foreground">
                        {payloadFormat === 'XML' ? 'XPath' : 'JSONPath'}
                      </label>
                      {payloadFormat === 'JSON' && (
                        <button
                          onClick={() => setActiveHelperIndex(activeHelperIndex === index ? null : index)}
                          className="text-[9px] text-primary hover:underline font-semibold cursor-pointer"
                        >
                          {activeHelperIndex === index ? 'Hide' : 'Helper'}
                        </button>
                      )}
                    </div>
                    <Input
                      placeholder={payloadFormat === 'XML' ? "//node" : "$.value"}
                      value={payloadFormat === 'XML' ? (v.xPath || '') : (v.jsonPath || '')}
                      onChange={(e) => updateVariable(index, payloadFormat === 'XML' ? 'xPath' : 'jsonPath', e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </>
                ) : (
                  <>
                    <label className="text-[9px] font-bold uppercase text-muted-foreground">Header Name</label>
                    <Input
                      placeholder="e.g. Authorization"
                      value={v.headerName || ''}
                      onChange={(e) => updateVariable(index, 'headerName', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </>
                )}
              </div>

              {variables.length > 1 && (
                <div className="pt-5">
                  <button 
                    onClick={() => removeVariable(index)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Helper Expand Panel */}
            {activeHelperIndex === index && payloadFormat === 'JSON' && source === 'RESPONSE_BODY' && (
              <div className="p-3 bg-secondary/25 border border-border/40 rounded-md space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-foreground">Interactive JSONPath Selector</span>
                  <span className={`text-[8px] font-semibold uppercase px-1.5 py-0.5 rounded ${parsedJson ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                    {parsedJson ? 'Valid JSON' : 'Invalid JSON'}
                  </span>
                </div>
                <Textarea
                  placeholder='Paste JSON response payload here to build paths...'
                  value={mockJson}
                  onChange={(e) => handleMockJsonChange(e.target.value)}
                  className="h-16 text-[10px] font-mono p-1 bg-background/50 border-border/30"
                />
                {parsedJson && (
                  <div className="p-2 border border-border/30 rounded bg-background/30 max-h-40 overflow-y-auto scrollbar-thin">
                    <JsonTreeViewer 
                      data={parsedJson} 
                      onSelectPath={(path) => {
                        updateVariable(index, 'jsonPath', path);
                        toast.success(`Selected JSONPath: ${path}`);
                      }} 
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <Button 
        variant="outline" 
        size="sm" 
        onClick={addVariable}
        className="w-full border-dashed border-border text-muted-foreground hover:text-foreground h-8"
      >
        <Plus className="mr-2 h-4 w-4" /> Add Variable
      </Button>
    </div>
  );
};
export default SetVariableConfig;
