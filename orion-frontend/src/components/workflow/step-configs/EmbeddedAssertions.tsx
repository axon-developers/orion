import React from 'react';
import { Input, Select, Button } from '../../ui';
import { TestStepDto } from '../../../types/api';
import { Plus, Trash2 } from 'lucide-react';

interface EmbeddedAssertionsProps {
  step: TestStepDto;
  handleConfigChange: (key: string, value: any) => void;
}

export const EmbeddedAssertions: React.FC<EmbeddedAssertionsProps> = ({
  step,
  handleConfigChange
}) => {
  const assertions = Array.isArray(step.config.assertions) ? step.config.assertions : [];

  const updateAssertion = (index: number, key: string, value: any) => {
    const newAssertions = [...assertions];
    newAssertions[index] = { ...newAssertions[index], [key]: value };
    
    if (key === 'payloadFormat') {
      if (value === 'JSON') newAssertions[index].xPath = '';
      else newAssertions[index].jsonPath = '';
    }
    
    handleConfigChange('assertions', newAssertions);
  };

  const addAssertion = () => {
    handleConfigChange('assertions', [...assertions, {
      source: 'RESPONSE_BODY',
      payloadFormat: 'JSON',
      jsonPath: '',
      xPath: '',
      operator: 'EQUALS',
      expectedValue: '',
      message: 'Assertion failed'
    }]);
  };

  const removeAssertion = (index: number) => {
    const newAssertions = [...assertions];
    newAssertions.splice(index, 1);
    handleConfigChange('assertions', newAssertions);
  };

  if (assertions.length === 0) {
    return (
      <div className="text-center py-6 border border-dashed border-border/50 rounded-lg">
        <p className="text-xs text-muted-foreground mb-3">No assertions defined. Add assertions to validate the response.</p>
        <Button variant="outline" size="sm" onClick={addAssertion}>
          <Plus className="mr-2 h-4 w-4" /> Add Assertion
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {assertions.map((a: any, index: number) => {
        const source = a.source || 'RESPONSE_BODY';
        const payloadFormat = a.payloadFormat || (a.xPath ? 'XML' : 'JSON');

        return (
          <div key={index} className="flex flex-col gap-2 p-3 border border-border/50 rounded-md bg-card/30 relative">
            <div className="flex items-start gap-2">
              <div className="w-[120px] space-y-1">
                <label className="text-[9px] font-bold uppercase text-muted-foreground">Source</label>
                <Select
                  options={[
                    { value: 'RESPONSE_BODY', label: 'Body' },
                    { value: 'STATUS_CODE', label: 'Status' },
                    { value: 'RESPONSE_HEADER', label: 'Header' },
                  ]}
                  value={source}
                  onChange={(e) => updateAssertion(index, 'source', e.target.value)}
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
                    onChange={(e) => updateAssertion(index, 'payloadFormat', e.target.value)}
                    className="h-8 text-xs py-1 px-2"
                  />
                </div>
              )}

              {(source === 'RESPONSE_BODY' || source === 'RESPONSE_HEADER') && (
                <div className="flex-[2] min-w-[120px] space-y-1">
                  {source === 'RESPONSE_BODY' ? (
                    <>
                      <label className="text-[9px] font-bold uppercase text-muted-foreground">{payloadFormat === 'XML' ? 'XPath' : 'JSONPath'}</label>
                      <Input
                        placeholder={payloadFormat === 'XML' ? "//node" : "$.value"}
                        value={payloadFormat === 'XML' ? (a.xPath || '') : (a.jsonPath || '')}
                        onChange={(e) => updateAssertion(index, payloadFormat === 'XML' ? 'xPath' : 'jsonPath', e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </>
                  ) : (
                    <>
                      <label className="text-[9px] font-bold uppercase text-muted-foreground">Header Name</label>
                      <Input
                        placeholder="e.g. Content-Type"
                        value={a.headerName || ''}
                        onChange={(e) => updateAssertion(index, 'headerName', e.target.value)}
                        className="h-8 text-xs"
                      />
                    </>
                  )}
                </div>
              )}
              
              <button 
                onClick={() => removeAssertion(index)}
                className="mt-5 text-muted-foreground hover:text-destructive transition-colors p-1 ml-auto"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            
            <div className="flex items-start gap-2">
              <div className="w-[120px] space-y-1">
                <label className="text-[9px] font-bold uppercase text-muted-foreground">Operator</label>
                <Select
                  options={[
                    { value: 'EQUALS', label: 'Equals' },
                    { value: 'NOT_EQUALS', label: 'Not Equals' },
                    { value: 'CONTAINS', label: 'Contains' },
                    { value: 'GREATER_THAN', label: '>' },
                    { value: 'LESS_THAN', label: '<' },
                    { value: 'REGEX_MATCH', label: 'Regex' },
                  ]}
                  value={a.operator || 'EQUALS'}
                  onChange={(e) => updateAssertion(index, 'operator', e.target.value)}
                  className="h-8 text-xs py-1 px-2"
                />
              </div>

              <div className="flex-[2] space-y-1">
                <label className="text-[9px] font-bold uppercase text-muted-foreground">Expected Value</label>
                <Input
                  placeholder="Expected result..."
                  value={a.expectedValue || ''}
                  onChange={(e) => updateAssertion(index, 'expectedValue', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="flex-[2] space-y-1">
                <label className="text-[9px] font-bold uppercase text-muted-foreground">Error Message (Optional)</label>
                <Input
                  placeholder="Custom failure msg..."
                  value={a.message || ''}
                  onChange={(e) => updateAssertion(index, 'message', e.target.value)}
                  className="h-8 text-xs text-muted-foreground"
                />
              </div>
            </div>
          </div>
        );
      })}

      <Button 
        variant="outline" 
        size="sm" 
        onClick={addAssertion}
        className="w-full border-dashed border-border text-muted-foreground hover:text-foreground h-8"
      >
        <Plus className="mr-2 h-4 w-4" /> Add Assertion
      </Button>
    </div>
  );
};
