import React, { useEffect, useState } from 'react';
import { useWorkflowStore } from '../../stores/workflow-store';
import { Input, Button, Textarea, Select, Switch, Card, CardHeader, CardTitle, CardContent } from '../ui';
import { X, Trash2, HelpCircle, Code, Settings, Split } from 'lucide-react';
import { TestStepDto } from '../../types/api';
import { toast } from 'sonner';

const parseCurl = (curlCommand: string) => {
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

export const StepConfigPanel: React.FC = () => {
  const { steps, selectedStepId, selectStep, updateStep, deleteStep } = useWorkflowStore();

  const [width, setWidth] = useState(380);
  const [activeSubIndex, setActiveSubIndex] = useState<number | null>(null);

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
      if (newWidth >= 320 && newWidth <= 800) {
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

  const renderConfigForm = () => {
    switch (step.stepType) {
      case 'HTTP_REQUEST':
        return (
          <div className="space-y-4">
            <div className="p-3 bg-secondary/25 rounded-lg border border-border/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center space-x-1">
                  <Code className="h-3.5 w-3.5 text-primary" />
                  <span>Import from cURL</span>
                </span>
              </div>
              <Textarea
                placeholder="Paste curl command here... e.g. curl -X POST https://example.com -d '...'"
                rows={2}
                className="font-mono text-[11px] bg-background/50"
                onChange={(e) => {
                  const curl = e.target.value;
                  if (curl.trim().startsWith('curl')) {
                    try {
                      const parsed = parseCurl(curl);
                      const newConfig = {
                        ...step.config,
                        method: parsed.method,
                        url: parsed.url,
                        headers: parsed.headers,
                        bodyType: parsed.bodyType,
                        body: parsed.body
                      };
                      updateStep(step.id, { config: newConfig });
                      e.target.value = '';
                      toast.success('Successfully imported and parsed cURL request!');
                    } catch (err: any) {
                      toast.error('Failed to parse cURL: ' + err.message);
                    }
                  }
                }}
              />
              <p className="text-[9px] text-muted-foreground leading-normal">
                Paste any valid <code>curl</code> command to automatically pre-populate request properties.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">HTTP Method</label>
              <Select
                options={[
                  { value: 'GET', label: 'GET' },
                  { value: 'POST', label: 'POST' },
                  { value: 'PUT', label: 'PUT' },
                  { value: 'DELETE', label: 'DELETE' },
                  { value: 'PATCH', label: 'PATCH' },
                ]}
                value={step.config.method || 'GET'}
                onChange={(e) => handleConfigChange('method', e.target.value)}
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Request URL</label>
              <Input
                placeholder="e.g. {{baseUrl}}/api/users"
                value={step.config.url || ''}
                onChange={(e) => handleConfigChange('url', e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">Supports variable interpolation e.g. <code>{"{{baseUrl}}"}</code></p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">HTTP Headers (JSON)</label>
              <Textarea
                placeholder='e.g. { "Accept": "application/json", "Authorization": "Bearer {{token}}" }'
                value={step.config.headers ? (typeof step.config.headers === 'object' ? JSON.stringify(step.config.headers, null, 2) : step.config.headers) : ''}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    handleConfigChange('headers', parsed);
                  } catch {
                    handleConfigChange('headers', e.target.value);
                  }
                }}
                rows={4}
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Specify request headers as a JSON object. Supports variable interpolation.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Request Body Type</label>
              <Select
                options={[
                  { value: 'NONE', label: 'None' },
                  { value: 'JSON', label: 'JSON' },
                ]}
                value={step.config.bodyType || 'NONE'}
                onChange={(e) => handleConfigChange('bodyType', e.target.value)}
              />
            </div>

            {step.config.bodyType === 'JSON' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">JSON Body Payload</label>
                <Textarea
                  placeholder='e.g. { "name": "{{testName}}" }'
                  value={typeof step.config.body === 'object' ? JSON.stringify(step.config.body, null, 2) : step.config.body || ''}
                  onChange={(e) => {
                    try {
                      // Attempt to store parsed JSON if valid, else string
                      const parsed = JSON.parse(e.target.value);
                      handleConfigChange('body', parsed);
                    } catch {
                      handleConfigChange('body', e.target.value);
                    }
                  }}
                  rows={6}
                  className="font-mono text-xs"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Timeout (ms)</label>
              <Input
                type="number"
                value={step.config.timeoutMs || 30000}
                onChange={(e) => handleConfigChange('timeoutMs', parseInt(e.target.value) || 30000)}
              />
            </div>
          </div>
        );

      case 'SOAP_REQUEST':
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">SOAP Endpoint URL</label>
              <Input
                placeholder="e.g. http://www.dneonline.com/calculator.asmx"
                value={step.config.url || ''}
                onChange={(e) => handleConfigChange('url', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">SOAP Version</label>
                <Select
                  options={[
                    { value: 'SOAP_1_1', label: 'SOAP 1.1' },
                    { value: 'SOAP_1_2', label: 'SOAP 1.2' },
                  ]}
                  value={step.config.soapVersion || 'SOAP_1_1'}
                  onChange={(e) => handleConfigChange('soapVersion', e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Timeout (ms)</label>
                <Input
                  type="number"
                  value={step.config.timeoutMs || 30000}
                  onChange={(e) => handleConfigChange('timeoutMs', parseInt(e.target.value) || 30000)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">SOAP Action</label>
              <Input
                placeholder="e.g. http://tempuri.org/Add"
                value={step.config.soapAction || ''}
                disabled={step.config.soapVersion === 'SOAP_1_2'}
                onChange={(e) => handleConfigChange('soapAction', e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">SOAPAction is typically ignored in SOAP 1.2.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Request Envelope (XML)</label>
              <Textarea
                rows={10}
                className="font-mono text-xs"
                placeholder={`<?xml version="1.0" encoding="utf-8"?>\n<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\n  <soap:Body>\n    <Add xmlns="http://tempuri.org/">\n      <intA>2</intA>\n      <intB>3</intB>\n    </Add>\n  </soap:Body>\n</soap:Envelope>`}
                value={step.config.envelope || ''}
                onChange={(e) => handleConfigChange('envelope', e.target.value)}
              />
            </div>
          </div>
        );

      case 'ASSERTION': {
        const source = step.config.source || 'RESPONSE_BODY';
        const payloadFormat = step.config.payloadFormat || (step.config.xPath ? 'XML' : 'JSON');
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Target Source</label>
              <Select
                options={[
                  { value: 'RESPONSE_BODY', label: 'Response Body (JSON)' },
                  { value: 'STATUS_CODE', label: 'HTTP Status Code' },
                  { value: 'RESPONSE_HEADER', label: 'HTTP Header' },
                  { value: 'VARIABLE', label: 'Saved Variable' },
                ]}
                value={source}
                onChange={(e) => handleConfigChange('source', e.target.value)}
              />
            </div>

            {source === 'RESPONSE_BODY' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Payload Format</label>
                  <Select
                    options={[
                      { value: 'JSON', label: 'JSON (JSONPath)' },
                      { value: 'XML', label: 'XML/SOAP (XPath)' },
                    ]}
                    value={payloadFormat}
                    onChange={(e) => {
                      const format = e.target.value;
                      handleConfigChange('payloadFormat', format);
                      if (format === 'JSON') {
                        handleConfigChange('xPath', '');
                      } else {
                        handleConfigChange('jsonPath', '');
                      }
                    }}
                  />
                </div>

                {payloadFormat === 'XML' || step.config.xPath ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase text-muted-foreground">XPath Expression</label>
                    <Input
                      placeholder="e.g. //AddResult/text()"
                      value={step.config.xPath || ''}
                      onChange={(e) => handleConfigChange('xPath', e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase text-muted-foreground">JSONPath Selector</label>
                    <Input
                      placeholder="e.g. $.data.id"
                      value={step.config.jsonPath || ''}
                      onChange={(e) => handleConfigChange('jsonPath', e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            {source === 'RESPONSE_HEADER' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Header Name</label>
                <Input
                  placeholder="e.g. Content-Type"
                  value={step.config.headerName || ''}
                  onChange={(e) => handleConfigChange('headerName', e.target.value)}
                />
              </div>
            )}

            {source === 'VARIABLE' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Variable Name</label>
                <Input
                  placeholder="e.g. userId"
                  value={step.config.variableName || ''}
                  onChange={(e) => handleConfigChange('variableName', e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Operator</label>
              <Select
                options={[
                  { value: 'EQUALS', label: 'Equals' },
                  { value: 'NOT_EQUALS', label: 'Not Equals' },
                  { value: 'CONTAINS', label: 'Contains (Substring)' },
                  { value: 'GREATER_THAN', label: 'Greater Than' },
                  { value: 'LESS_THAN', label: 'Less Than' },
                  { value: 'REGEX_MATCH', label: 'Regex Match' },
                ]}
                value={step.config.operator || 'EQUALS'}
                onChange={(e) => {
                  handleConfigChange('operator', e.target.value);
                  handleFieldChange('actionType', e.target.value); // Sync actionType
                }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Expected Value</label>
              <Input
                placeholder="e.g. 200 or active"
                value={step.config.expectedValue || ''}
                onChange={(e) => handleConfigChange('expectedValue', e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Failure Message</label>
              <Input
                placeholder="Message displayed if validation fails..."
                value={step.config.message || ''}
                onChange={(e) => handleConfigChange('message', e.target.value)}
              />
            </div>
          </div>
        );
      }

      case 'SET_VARIABLE': {
        const source = step.config.source || 'RESPONSE_BODY';
        const payloadFormat = step.config.payloadFormat || (step.config.xPath ? 'XML' : 'JSON');
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Variable Save Key</label>
              <Input
                placeholder="e.g. authToken"
                value={step.config.variableName || ''}
                onChange={(e) => handleConfigChange('variableName', e.target.value)}
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Extraction Source</label>
              <Select
                options={[
                  { value: 'RESPONSE_BODY', label: 'Response Body (JSON)' },
                  { value: 'RESPONSE_HEADER', label: 'Response Header' },
                ]}
                value={source}
                onChange={(e) => handleConfigChange('source', e.target.value)}
              />
            </div>

            {source === 'RESPONSE_BODY' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Payload Format</label>
                  <Select
                    options={[
                      { value: 'JSON', label: 'JSON (JSONPath)' },
                      { value: 'XML', label: 'XML/SOAP (XPath)' },
                    ]}
                    value={payloadFormat}
                    onChange={(e) => {
                      const format = e.target.value;
                      handleConfigChange('payloadFormat', format);
                      if (format === 'JSON') {
                        handleConfigChange('xPath', '');
                      } else {
                        handleConfigChange('jsonPath', '');
                      }
                    }}
                  />
                </div>

                {payloadFormat === 'XML' || step.config.xPath ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase text-muted-foreground">XPath Expression</label>
                    <Input
                      placeholder="e.g. //AddResult/text()"
                      value={step.config.xPath || ''}
                      onChange={(e) => handleConfigChange('xPath', e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase text-muted-foreground">JSONPath Selector</label>
                    <Input
                      placeholder="e.g. $.token"
                      value={step.config.jsonPath || ''}
                      onChange={(e) => handleConfigChange('jsonPath', e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            {source === 'RESPONSE_HEADER' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Header Name</label>
                <Input
                  placeholder="e.g. Authorization"
                  value={step.config.headerName || ''}
                  onChange={(e) => handleConfigChange('headerName', e.target.value)}
                />
              </div>
            )}
          </div>
        );
      }

      case 'DELAY':
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Duration (milliseconds)</label>
              <Input
                type="number"
                placeholder="e.g. 2000"
                value={step.config.durationMs || 1000}
                onChange={(e) => handleConfigChange('durationMs', parseInt(e.target.value) || 1000)}
              />
            </div>
          </div>
        );

      case 'LOG':
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Level</label>
              <Select
                options={[
                  { value: 'INFO', label: 'INFO' },
                  { value: 'WARN', label: 'WARN' },
                  { value: 'DEBUG', label: 'DEBUG' },
                ]}
                value={step.config.level || 'INFO'}
                onChange={(e) => handleConfigChange('level', e.target.value)}
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Log Message</label>
              <Textarea
                placeholder="e.g. Current authentication token: {{authToken}}"
                value={step.config.message || ''}
                onChange={(e) => handleConfigChange('message', e.target.value)}
                rows={3}
              />
            </div>
          </div>
        );

      case 'CONDITIONAL':
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Branch Condition</label>
              <Input
                placeholder="e.g. {{statusCode}} == 200"
                value={step.config.condition || ''}
                onChange={(e) => handleConfigChange('condition', e.target.value)}
              />
            </div>
          </div>
        );

      case 'LOOP': {
        const type = step.config.type || 'COUNT';
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Loop Type</label>
              <Select
                options={[
                  { value: 'COUNT', label: 'Fixed Count Iterations' },
                  { value: 'FOR_EACH', label: 'For Each Element' },
                ]}
                value={type}
                onChange={(e) => handleConfigChange('type', e.target.value)}
              />
            </div>
            {type === 'COUNT' ? (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Iteration Count</label>
                <Input
                  type="number"
                  value={step.config.count || 5}
                  onChange={(e) => handleConfigChange('count', parseInt(e.target.value) || 5)}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Array JSONPath Source</label>
                <Input
                  placeholder="$.users"
                  value={step.config.dataSource || ''}
                  onChange={(e) => handleConfigChange('dataSource', e.target.value)}
                />
              </div>
            )}
          </div>
        );
      }

      case 'DATABASE_QUERY':
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">JDBC Connection String</label>
              <Input
                placeholder="jdbc:sqlite:./orion.db or {{dbUrl}}"
                value={step.config.connectionString || ''}
                onChange={(e) => handleConfigChange('connectionString', e.target.value)}
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">SQL Query Command</label>
              <Textarea
                placeholder="SELECT count(*) FROM users WHERE is_active = 1"
                value={step.config.query || ''}
                onChange={(e) => handleConfigChange('query', e.target.value)}
                rows={5}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Save Result to Variable</label>
              <Input
                placeholder="e.g. activeUsersCount"
                value={step.config.resultVariable || ''}
                onChange={(e) => handleConfigChange('resultVariable', e.target.value)}
              />
            </div>
          </div>
        );

      case 'PARALLEL': {
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
      }

      default:
        return <div className="text-xs text-muted-foreground py-4">No custom settings required for this step.</div>;
    }
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
          onClick={() => selectStep(null)}
          className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Core meta fields */}
        <div className="space-y-3 pb-4 border-b border-border/40">
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase text-muted-foreground">Step Name</label>
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
        </div>

        {/* Custom config sub-form */}
        <div>
          <h4 className="text-[10px] font-extrabold uppercase text-muted-foreground mb-3">Parameters</h4>
          {renderConfigForm()}
        </div>
      </div>

      {/* Footer delete */}
      <div className="p-4 border-t border-border bg-secondary/10 flex justify-end">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => deleteStep(step.id)}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive flex items-center"
        >
          <Trash2 className="mr-1.5 h-4 w-4" />
          Remove Step
        </Button>
      </div>
    </aside>
  );
};
export default StepConfigPanel;
