import React from 'react';
import { Input, Select, Textarea } from '../../ui';
import { Code } from 'lucide-react';
import { toast } from 'sonner';
import { parseCurl } from '../StepConfigPanel';
import { TestStepDto } from '../../../types/api';
import { HeaderTableEditor } from './HeaderTableEditor';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../ui';
import { EmbeddedAssertions } from './EmbeddedAssertions';
import { SetVariableConfig } from './SetVariableConfig';

interface SoapRequestConfigProps {
  step: TestStepDto;
  updateStep: (id: string, updates: Partial<TestStepDto>) => void;
  handleConfigChange: (key: string, value: any) => void;
  certOptions: { value: string; label: string }[];
  baseFields?: React.ReactNode;
}

export const SoapRequestConfig: React.FC<SoapRequestConfigProps> = ({
  step,
  updateStep,
  handleConfigChange,
  certOptions,
  baseFields
}) => {
  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="grid w-full grid-cols-3 mb-4">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="assertions">Assertions</TabsTrigger>
        <TabsTrigger value="variables">Variables</TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="space-y-4 mt-0">
        {baseFields}
        <div className="p-3 bg-secondary/25 rounded-lg border border-border/50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center space-x-1">
              <Code className="h-3.5 w-3.5 text-primary" />
              <span>Import from cURL</span>
            </span>
          </div>
          <Textarea
            placeholder="Paste SOAP curl command here... e.g. curl -X POST http://example.com/soap -H 'SOAPAction: http://tempuri.org/Add' -d '<soap:Envelope>...'"
            rows={2}
            className="font-mono text-[11px] bg-background/50"
            onChange={(e) => {
              const curl = e.target.value;
              if (curl.trim().startsWith('curl')) {
                try {
                  const parsed = parseCurl(curl);
                  
                  let soapAction = '';
                  let soapVersion = 'SOAP_1_1';
                  
                  if (parsed.headers) {
                    Object.keys(parsed.headers).forEach((key) => {
                      const lowerKey = key.toLowerCase();
                      if (lowerKey === 'soapaction') {
                        soapAction = parsed.headers[key].replace(/^['"]|['"]$/g, '');
                      }
                      if (lowerKey === 'content-type') {
                        const ct = parsed.headers[key].toLowerCase();
                        if (ct.includes('application/soap+xml')) {
                          soapVersion = 'SOAP_1_2';
                        } else if (ct.includes('text/xml')) {
                          soapVersion = 'SOAP_1_1';
                        }
                      }
                    });
                  }

                  const newConfig = {
                    ...step.config,
                    url: parsed.url,
                    envelope: parsed.body,
                    soapAction: soapAction,
                    soapVersion: soapVersion
                  };
                  updateStep(step.id, { config: newConfig });
                  e.target.value = '';
                  toast.success('Successfully imported and parsed SOAP cURL request!');
                } catch (err: any) {
                  toast.error('Failed to parse SOAP cURL: ' + err.message);
                }
              }
            }}
          />
          <p className="text-[9px] text-muted-foreground leading-normal">
            Paste any valid <code>curl</code> command containing SOAP envelope and actions to auto-populate SOAP request fields.
          </p>
        </div>

        <div className="space-y-1.5 pb-2">
          <label className="text-xs font-semibold uppercase text-muted-foreground">SOAP Endpoint URL <span className="text-destructive">*</span></label>
          <Input
            placeholder="e.g. http://www.dneonline.com/calculator.asmx"
            value={step.config.url || ''}
            onChange={(e) => handleConfigChange('url', e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <HeaderTableEditor
            headers={step.config.headers}
            onChange={(val) => handleConfigChange('headers', val)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Request Envelope (XML) <span className="text-destructive">*</span></label>
          <Textarea
            rows={10}
            className="font-mono text-xs"
            placeholder={`<?xml version="1.0" encoding="utf-8"?>\n<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\n  <soap:Body>\n    <Add xmlns="http://tempuri.org/">\n      <intA>2</intA>\n      <intB>3</intB>\n    </Add>\n  </soap:Body>\n</soap:Envelope>`}
            value={step.config.envelope || ''}
            onChange={(e) => handleConfigChange('envelope', e.target.value)}
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

        <div className="grid grid-cols-2 gap-3 pb-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-muted-foreground">SOAP Action</label>
            <Input
              placeholder="e.g. http://tempuri.org/Add"
              value={step.config.soapAction || ''}
              disabled={step.config.soapVersion === 'SOAP_1_2'}
              onChange={(e) => handleConfigChange('soapAction', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Client Cert Override</label>
            <Select
              options={certOptions}
              value={step.config.clientCertKey || ''}
              onChange={(e) => handleConfigChange('clientCertKey', e.target.value)}
            />
          </div>
        </div>
      </TabsContent>

    <TabsContent value="assertions" className="mt-0">
      <EmbeddedAssertions step={step} handleConfigChange={handleConfigChange} />
    </TabsContent>

    <TabsContent value="variables" className="mt-0">
      <SetVariableConfig step={step} handleConfigChange={handleConfigChange} />
    </TabsContent>
  </Tabs>
  );
};
