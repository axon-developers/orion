import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Copy, Check, Info } from 'lucide-react';
import { toast } from 'sonner';

interface InlineStepHelperProps {
  stepType: string;
}

interface HelpContent {
  title: string;
  description: string;
  parameters: { name: string; desc: string }[];
  example: string;
  tips: string[];
}

const HELP_DATA: Record<string, HelpContent> = {
  HTTP_REQUEST: {
    title: 'HTTP REST Request',
    description: 'Executes a REST API call (GET, POST, PUT, DELETE, etc.) against a target endpoint.',
    parameters: [
      { name: 'URL', desc: 'Target endpoint. Fully supports variable interpolation (e.g. {{apiHost}}/v1/users).' },
      { name: 'Method', desc: 'HTTP verb (GET, POST, PUT, DELETE, PATCH, OPTIONS).' },
      { name: 'Headers / Body', desc: 'Define headers or request payloads. Dynamic variables are resolved at execution.' }
    ],
    example: 'POST {{apiHost}}/v1/auth/login\nHeaders:\n  Content-Type: application/json\nBody:\n{\n  "username": "{{username}}",\n  "password": "{{password}}"\n}',
    tips: [
      'Store returned tokens (JWT/Cookies) using an Extract Variable step immediately after this step.',
      'Environment certificates are automatically attached if mutual TLS (mTLS) is enabled.'
    ]
  },
  DATABASE_QUERY: {
    title: 'Database Query',
    description: 'Executes a single SQL command (SELECT, INSERT, UPDATE, DDL) against a target database.',
    parameters: [
      { name: 'Database Target', desc: 'Pre-configured database connection selected from environment settings.' },
      { name: 'JDBC URL Override', desc: 'Optional inline database connection string fallback.' },
      { name: 'SQL Query', desc: 'SQL command to execute. Supports variable parameterization.' }
    ],
    example: "SELECT first_name, email \nFROM customers \nWHERE customer_id = '{{customerId}}';",
    tips: [
      'Use result mapping to extract specific columns into workflow variables.',
      'Active connections are pooled per execution to eliminate handshake latency across steps.'
    ]
  },
  MAINFRAME_TERMINAL: {
    title: 'Mainframe Screen Action',
    description: 'Emulates actions on IBM 3270 green-screen panels inside a pooled TN3270 session.',
    parameters: [
      { name: 'Host / Port', desc: 'Mainframe address (supports environment variables e.g. {{mainframeHost}}).' },
      { name: 'Actions List', desc: 'Ordered action sequence (waitForText, input, sendKey, readField, screenshot, sleep).' }
    ],
    example: '[\n  { "type": "waitForText", "text": "ENTER USERID", "timeout": 5000 },\n  { "type": "input", "row": 10, "col": 20, "value": "{{mUser}}" },\n  { "type": "sendKey", "key": "ENTER" },\n  { "type": "screenshot", "name": "cics_dashboard" }\n]',
    tips: [
      'Coordinates are 1-based (Row 1-24, Col 1-80).',
      'The "screenshot" action generates visual captures viewable in the interactive gallery.'
    ]
  },
  BROWSER_AUTOMATION: {
    title: 'Browser Automation',
    description: 'Drives user interactions in Web browsers (Chromium, Firefox, WebKit) using Playwright.',
    parameters: [
      { name: 'Viewport', desc: 'Target resolution for the web browser session.' },
      { name: 'Actions List', desc: 'Sequence of browser tasks (navigate, click, fill, screenshot, waitForElement).' }
    ],
    example: '[\n  { "type": "navigate", "url": "{{webAppUrl}}" },\n  { "type": "fill", "selector": "#email", "value": "{{userEmail}}" },\n  { "type": "click", "selector": "button[type=submit]" },\n  { "type": "screenshot", "name": "home_page", "fullPage": false }\n]',
    tips: [
      'Use "fullPage: true" on screenshots to capture entire scrollable page height.',
      'Verify selector syntax inside the web console by running document.querySelector("selector").'
    ]
  },
  ASSERTION: {
    title: 'Validation Assertion',
    description: 'Verifies state results of preceding steps against expected values.',
    parameters: [
      { name: 'Target Field', desc: 'Part of output to validate (e.g. STATUS_CODE, RESPONSE_BODY, RESPONSE_TIME).' },
      { name: 'JsonPath / XPath', desc: 'Selector expression to point to a specific field in JSON/XML payloads.' },
      { name: 'Expected Value', desc: 'Dynamic or static value to validate against.' }
    ],
    example: 'Target: RESPONSE_BODY\nJsonPath: $.status\nOperator: EQUALS\nExpected: ACTIVE',
    tips: [
      'If any assertion fails, the workflow execution immediately halts with a FAILED status.',
      'Check status codes via STATUS_CODE EQUALS 200.'
    ]
  },
  SET_VARIABLE: {
    title: 'Extract & Store Variable',
    description: 'Extracts values from step logs, headers, or response payloads and stores them in workflow variables.',
    parameters: [
      { name: 'Variable Name', desc: 'Save key (e.g. authToken) to reference in subsequent steps.' },
      { name: 'Source', desc: 'Where to extract from (RESPONSE_BODY, RESPONSE_HEADER).' },
      { name: 'JSONPath / XPath', desc: 'Expression to match the desired value.' }
    ],
    example: 'Variable Name: loggedInUser\nSource: RESPONSE_BODY\nJSONPath: $.user.username',
    tips: [
      'Extracted variables remain active throughout the rest of the workflow execution.',
      'Use {{variableName}} syntax in subsequent steps to inject the value.'
    ]
  }
};

export const InlineStepHelper: React.FC<InlineStepHelperProps> = ({ stepType }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const help = HELP_DATA[stepType];
  if (!help) return null;

  const handleCopyExample = () => {
    navigator.clipboard.writeText(help.example);
    setCopied(true);
    toast.success('Example copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-border/40 rounded-xl bg-secondary/5 overflow-hidden transition-all duration-300">
      {/* Trigger bar */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3.5 hover:bg-secondary/15 transition-all text-xs font-bold text-muted-foreground select-none"
      >
        <span className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-primary animate-pulse" />
          <span>{help.title} Guide & Options</span>
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
          {isOpen ? (
            <>
              <span>Hide Help</span>
              <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              <span>Show Quick Guide</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </span>
      </button>

      {/* Content panel */}
      {isOpen && (
        <div className="p-4 border-t border-border/30 space-y-4 text-xs leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
          <p className="text-foreground/80 font-medium">
            {help.description}
          </p>

          {/* Parameters list */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Parameter Guide</h4>
            <div className="grid gap-2 border border-border/20 rounded-lg p-2.5 bg-card/60">
              {help.parameters.map((p, idx) => (
                <div key={idx} className="flex items-start gap-1.5 text-[11px]">
                  <strong className="text-foreground shrink-0 font-semibold">{p.name}:</strong>
                  <span className="text-muted-foreground">{p.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Example snippet */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Sample Configuration</h4>
              <button
                type="button"
                onClick={handleCopyExample}
                className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="p-3 bg-secondary/40 text-foreground font-mono text-[10px] rounded-lg border border-border/30 overflow-x-auto select-all">
              {help.example}
            </pre>
          </div>

          {/* Bullet tips */}
          <div className="space-y-1.5 border-t border-border/20 pt-3">
            <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Info className="h-3.5 w-3.5 text-primary" />
              <span>Pro Tips</span>
            </h4>
            <ul className="list-disc pl-4 space-y-1 text-muted-foreground text-[11px]">
              {help.tips.map((tip, idx) => (
                <li key={idx}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
