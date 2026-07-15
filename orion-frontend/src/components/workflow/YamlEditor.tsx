import React, { useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import '../../lib/monaco-config';
import { Badge } from '../ui';
import { 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Play, 
  Code,
  FileJson,
  Database,
  ArrowRight,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Shield
} from 'lucide-react';

interface YamlEditorProps {
  yamlText: string;
  onChange: (val: string) => void;
  isValidating: boolean;
  validationErrors: string[];
  validationWarnings: string[];
  validationResult: any;
  readOnly?: boolean;
}

const TEMPLATES = [
  {
    name: 'HTTP Request',
    icon: GlobeIcon,
    snippet: `  - name: "HTTP GET Request"
    stepType: "HTTP_REQUEST"
    enabled: true
    config:
      method: "GET"
      url: "https://api.example.com/users"
      headers:
        Content-Type: "application/json"
      bodyType: "NONE"
      timeoutMs: 30000
`
  },
  {
    name: 'SOAP Request',
    icon: FileJson,
    snippet: `  - name: "SOAP GetProduct Request"
    stepType: "SOAP_REQUEST"
    enabled: true
    config:
      url: "https://api.example.com/soap-endpoint"
      envelope: |
        <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
           <soapenv:Header/>
           <soapenv:Body>
              <GetProductRequest>
                 <id>{{productId}}</id>
              </GetProductRequest>
           </soapenv:Body>
        </soapenv:Envelope>
`
  },
  {
    name: 'Database Query',
    icon: Database,
    snippet: `  - name: "Execute DB Query"
    stepType: "DATABASE_QUERY"
    enabled: true
    config:
      databaseKey: "postgres_db"
      query: "SELECT * FROM users LIMIT 10"
`
  },
  {
    name: 'DB Table View',
    icon: Database,
    snippet: `  - name: "Read DB Table"
    stepType: "DB_TABLE_VIEW"
    enabled: true
    config:
      databaseKey: "postgres_db"
      query: "SELECT * FROM users LIMIT 100"
`
  },
  {
    name: 'CSV Extract',
    icon: FileJson,
    snippet: `  - name: "Extract CSV dataset"
    stepType: "CSV_EXTRACT"
    enabled: true
    config:
      csvPayload: |
        id,name,role
        1,John Doe,Admin
        2,Jane Smith,Tester
      strategy: "SEQUENTIAL"
`
  },
  {
    name: 'Set Variable',
    icon: Code,
    snippet: `  - name: "Extract Response Variable"
    stepType: "SET_VARIABLE"
    enabled: true
    config:
      variables:
        - variableName: "userId"
          source: "RESPONSE_BODY"
          payloadFormat: "JSON"
          jsonPath: "$.id"
`
  },
  {
    name: 'Assertion',
    icon: CheckCircle,
    snippet: `  - name: "Assert HTTP 200"
    stepType: "ASSERTION"
    enabled: true
    config:
      assertions:
        - targetField: "STATUS_CODE"
          operator: "EQUALS"
          expectedValue: "200"
`
  },
  {
    name: 'Delay',
    icon: ClockIcon,
    snippet: `  - name: "Wait 2 seconds"
    stepType: "DELAY"
    enabled: true
    config:
      durationMs: 2000
`
  },
  {
    name: 'Loop',
    icon: Play,
    snippet: `  - name: "Run 5 times"
    stepType: "LOOP"
    enabled: true
    config:
      loopType: "COUNT"
      iterations: "5"
      indexVariable: "loopIndex"
      steps:
        - name: "HTTP Request in Loop"
          stepType: "HTTP_REQUEST"
          config:
            method: "GET"
            url: "https://api.example.com/ping"
`
  }
];

function GlobeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export const YamlEditor: React.FC<YamlEditorProps> = ({
  yamlText,
  onChange,
  isValidating,
  validationErrors,
  validationWarnings,
  validationResult,
  readOnly = false
}) => {
  const editorRef = useRef<any>(null);
  const [fontSize, setFontSize] = useState(13);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  const handleInsertSnippet = (snippet: string) => {
    const editor = editorRef.current;
    if (!editor) {
      onChange(yamlText + '\n' + snippet);
      return;
    }

    const selection = editor.getSelection();
    const op = {
      range: selection,
      text: snippet,
      forceMoveMarkers: true
    };
    editor.executeEdits("snippet-injector", [op]);
    editor.focus();
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0c0d12] text-slate-100">
      {/* LEFT: Monaco Editor panel */}
      <div className="flex-1 flex flex-col h-full border-r border-border/40 relative">
        
        {/* Editor Controls */}
        <div className="h-10 border-b border-border/30 px-4 flex items-center justify-between bg-[#08090d]/60 shrink-0 select-none">
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
              YAML Workflow Schema Editor
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Font Size: {fontSize}px</span>
            <div className="flex items-center space-x-1 bg-secondary/20 p-0.5 rounded border border-border/25">
              <button
                onClick={() => setFontSize(prev => Math.max(prev - 1, 10))}
                className="p-1 text-slate-400 hover:text-foreground hover:bg-secondary/40 rounded transition-all cursor-pointer"
                title="Decrease Font Size"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setFontSize(prev => Math.min(prev + 1, 24))}
                className="p-1 text-slate-400 hover:text-foreground hover:bg-secondary/40 rounded transition-all cursor-pointer"
                title="Increase Font Size"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Monaco Editor container */}
        <div className="flex-1 overflow-hidden h-full relative">
          <Editor
            value={yamlText}
            onChange={(val) => onChange(val || '')}
            onMount={handleEditorDidMount}
            language="yaml"
            theme="vs-dark"
            loading={
              <div className="absolute inset-0 flex items-center justify-center bg-card">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            }
            options={{
              readOnly,
              fontSize,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on',
              lineNumbers: 'on',
              scrollbar: {
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8
              }
            }}
          />
        </div>
      </div>

      {/* RIGHT: Snippet Templates & Validation Panel */}
      <div className="w-96 flex flex-col bg-[#0b0c10] border-l border-border/20 overflow-hidden shrink-0">
        
        {/* Validation Findings */}
        <div className="p-4 border-b border-border/20 flex flex-col space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Server Validation</h3>
            {isValidating && (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            )}
          </div>

          {!isValidating && validationResult && (
            <div className="space-y-2.5">
              <div className="flex items-center space-x-1.5 text-xs text-slate-300">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-semibold">{validationResult.stepCount} steps loaded</span>
              </div>

              {validationErrors.length > 0 && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg space-y-1 text-xs">
                  <div className="font-bold flex items-center">
                    <XCircle className="h-4 w-4 mr-1 shrink-0" />
                    Structure Errors:
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 max-h-32 overflow-y-auto">
                    {validationErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {validationWarnings.length > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg space-y-1 text-xs">
                  <div className="font-bold flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1 shrink-0" />
                    Warnings:
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 max-h-32 overflow-y-auto">
                    {validationWarnings.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}

              {validationErrors.length === 0 && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg flex items-center text-xs">
                  <CheckCircle className="h-4 w-4 mr-1.5 shrink-0" />
                  <span>YAML configuration is clean and valid.</span>
                </div>
              )}
            </div>
          )}

          {!validationResult && !isValidating && (
            <div className="text-xs text-muted-foreground bg-secondary/5 border border-dashed border-border/30 rounded-lg p-3 text-center">
              Type or inject a step snippet to trigger validation check.
            </div>
          )}
        </div>

        {/* Step Templates Injector */}
        {!readOnly ? (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-4 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Step Templates</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Click any snippet below to insert it at your cursor</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pt-1 space-y-2">
              {TEMPLATES.map((tmpl) => {
                const Icon = tmpl.icon;
                return (
                  <button
                    key={tmpl.name}
                    onClick={() => handleInsertSnippet(tmpl.snippet)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border/20 bg-secondary/5 hover:bg-secondary/15 hover:border-primary/30 transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="p-1.5 rounded bg-[#13141f] text-primary group-hover:text-foreground group-hover:bg-primary transition-all">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-200">{tmpl.name}</span>
                    </div>
                    <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-0.5" />
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none text-muted-foreground">
            <Shield className="h-8 w-8 text-slate-600 mb-2" />
            <p className="text-xs font-semibold">Templates Disabled</p>
            <p className="text-[10px] text-muted-foreground/80 mt-1">Snippet additions are locked in read-only mode.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default YamlEditor;
