import React, { useState, useMemo } from 'react';
import openApiYamlString from '../../assets/openapi.yaml?raw';
import { 
  HelpCircle, 
  Search, 
  BookOpen, 
  Terminal, 
  Code, 
  Globe, 
  Database, 
  PlayCircle, 
  Workflow, 
  CheckCircle, 
  Copy, 
  Check, 
  Info, 
  AlertCircle, 
  ShieldAlert, 
  FileCode, 
  FileJson, 
  Sliders, 
  Split, 
  Repeat, 
  GitBranch, 
  Clock, 
  Link, 
  ArrowRight,
  MonitorPlay,
  Monitor,
  Eye,
  FileText,
  KeyRound,
  Shield,
  Lock,
  Sparkles,
  Download,
  ExternalLink,
  Server,
  Filter,
  Layers
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Tabs, TabsList, TabsTrigger, TabsContent, Badge, Button } from '../../components/ui';

interface StepHelp {
  type: string;
  name: string;
  category: 'Primary' | 'Support' | 'Display' | 'Technical';
  description: string;
  icon: React.ReactNode;
  colorClass: string;
  badgeClass: string;
  fields: { name: string; type: string; required: boolean; desc: string }[];
  exampleValue: string;
  snippet: string;
  explanation: string;
}

export const HelpPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [apiSearch, setApiSearch] = useState('');
  const [apiMethodFilter, setApiMethodFilter] = useState<string>('ALL');
  const [apiTagFilter, setApiTagFilter] = useState<string>('ALL');
  const [openApiSubTab, setOpenApiSubTab] = useState<'explorer' | 'yaml'>('explorer');

  const handleDownloadYaml = () => {
    const blob = new Blob([openApiYamlString], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orion-openapi.yaml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const apiEndpointsData = useMemo(() => [
    { method: 'POST', path: '/api/auth/register', tag: 'Auth', summary: 'Register a new user account', secured: false },
    { method: 'POST', path: '/api/auth/login', tag: 'Auth', summary: 'User login authentication', secured: false },
    { method: 'POST', path: '/api/auth/refresh', tag: 'Auth', summary: 'Refresh JWT token', secured: false },
    { method: 'POST', path: '/api/auth/logout', tag: 'Auth', summary: 'User logout', secured: false },
    
    { method: 'GET', path: '/api/users', tag: 'Users', summary: 'List users (Admin required)', secured: true },
    { method: 'GET', path: '/api/users/me', tag: 'Users', summary: 'Get authenticated user profile', secured: true },
    { method: 'PUT', path: '/api/users/me', tag: 'Users', summary: 'Update authenticated user profile', secured: true },
    { method: 'PUT', path: '/api/users/me/password', tag: 'Users', summary: 'Change current user password', secured: true },
    { method: 'GET', path: '/api/users/{id}', tag: 'Users', summary: 'Get user details by ID', secured: true },
    { method: 'PUT', path: '/api/users/{id}', tag: 'Users', summary: 'Update user by ID', secured: true },
    { method: 'DELETE', path: '/api/users/{id}', tag: 'Users', summary: 'Delete user by ID (Admin required)', secured: true },
    { method: 'PATCH', path: '/api/users/{id}/role', tag: 'Users', summary: 'Change user role (Admin required)', secured: true },
    { method: 'PATCH', path: '/api/users/{id}/status', tag: 'Users', summary: 'Change user status (Admin required)', secured: true },

    { method: 'GET', path: '/api/applications', tag: 'Applications', summary: 'List application workspaces', secured: true },
    { method: 'POST', path: '/api/applications', tag: 'Applications', summary: 'Create new application workspace', secured: true },
    { method: 'GET', path: '/api/applications/{id}', tag: 'Applications', summary: 'Get application workspace details', secured: true },
    { method: 'PUT', path: '/api/applications/{id}', tag: 'Applications', summary: 'Update application workspace', secured: true },
    { method: 'DELETE', path: '/api/applications/{id}', tag: 'Applications', summary: 'Delete application workspace', secured: true },
    { method: 'GET', path: '/api/applications/{id}/summary', tag: 'Applications', summary: 'Get workspace metrics & summary', secured: true },

    { method: 'GET', path: '/api/applications/{appId}/collaborators', tag: 'Collaborators', summary: 'List collaborators for workspace', secured: true },
    { method: 'POST', path: '/api/applications/{appId}/collaborators', tag: 'Collaborators', summary: 'Add collaborator to workspace', secured: true },
    { method: 'DELETE', path: '/api/applications/{appId}/collaborators/{username}', tag: 'Collaborators', summary: 'Remove collaborator from workspace', secured: true },

    { method: 'GET', path: '/api/applications/{appId}/environments', tag: 'Environments', summary: 'List environments for application', secured: true },
    { method: 'POST', path: '/api/applications/{appId}/environments', tag: 'Environments', summary: 'Create new environment', secured: true },
    { method: 'GET', path: '/api/applications/{appId}/environments/{envId}', tag: 'Environments', summary: 'Get environment configuration', secured: true },
    { method: 'PUT', path: '/api/applications/{appId}/environments/{envId}', tag: 'Environments', summary: 'Update environment configuration', secured: true },
    { method: 'DELETE', path: '/api/applications/{appId}/environments/{envId}', tag: 'Environments', summary: 'Delete environment configuration', secured: true },
    { method: 'POST', path: '/api/applications/{appId}/environments/{envId}/clone', tag: 'Environments', summary: 'Clone environment', secured: true },
    { method: 'PUT', path: '/api/applications/{appId}/environments/{envId}/default', tag: 'Environments', summary: 'Set default environment', secured: true },
    { method: 'POST', path: '/api/applications/{appId}/environments/validate-db-connection', tag: 'Environments', summary: 'Test JDBC database connection', secured: true },
    { method: 'GET', path: '/api/applications/{appId}/environments/diff', tag: 'Environments', summary: 'Compare variable differences', secured: true },
    { method: 'POST', path: '/api/applications/{appId}/environments/sync-missing', tag: 'Environments', summary: 'Sync missing variables across environments', secured: true },

    { method: 'GET', path: '/api/applications/{appId}/testcases', tag: 'TestCases', summary: 'List test cases in application', secured: true },
    { method: 'POST', path: '/api/applications/{appId}/testcases', tag: 'TestCases', summary: 'Create new test case workflow', secured: true },
    { method: 'GET', path: '/api/applications/{appId}/testcases/{tcId}', tag: 'TestCases', summary: 'Get test case details with steps', secured: true },
    { method: 'PUT', path: '/api/applications/{appId}/testcases/{tcId}', tag: 'TestCases', summary: 'Update test case metadata', secured: true },
    { method: 'DELETE', path: '/api/applications/{appId}/testcases/{tcId}', tag: 'TestCases', summary: 'Delete test case workflow', secured: true },
    { method: 'POST', path: '/api/applications/{appId}/testcases/{tcId}/clone', tag: 'TestCases', summary: 'Clone existing test case', secured: true },
    { method: 'GET', path: '/api/applications/{appId}/testcases/{tcId}/export', tag: 'TestCases', summary: 'Export test case as YAML specification', secured: true },
    { method: 'POST', path: '/api/applications/{appId}/testcases/{tcId}/run', tag: 'Executions', summary: 'Execute test case workflow', secured: true },

    { method: 'GET', path: '/api/testcases/{tcId}/steps', tag: 'TestSteps', summary: 'Get steps in test case', secured: true },
    { method: 'POST', path: '/api/testcases/{tcId}/steps', tag: 'TestSteps', summary: 'Add step to test case workflow', secured: true },
    { method: 'PUT', path: '/api/testcases/{tcId}/steps/{stepId}', tag: 'TestSteps', summary: 'Update step configuration', secured: true },
    { method: 'DELETE', path: '/api/testcases/{tcId}/steps/{stepId}', tag: 'TestSteps', summary: 'Delete step from workflow', secured: true },
    { method: 'PUT', path: '/api/testcases/{tcId}/steps/reorder', tag: 'TestSteps', summary: 'Reorder workflow steps sequence', secured: true },

    { method: 'GET', path: '/api/applications/{appId}/suites', tag: 'TestSuites', summary: 'List test suites', secured: true },
    { method: 'POST', path: '/api/applications/{appId}/suites', tag: 'TestSuites', summary: 'Create test suite', secured: true },
    { method: 'POST', path: '/api/applications/{appId}/suites/{id}/run', tag: 'TestSuites', summary: 'Execute test suite run', secured: true },

    { method: 'GET', path: '/api/executions', tag: 'Executions', summary: 'List execution runs history', secured: true },
    { method: 'GET', path: '/api/executions/{execId}', tag: 'Executions', summary: 'Get execution run details & step logs', secured: true },
    { method: 'POST', path: '/api/executions/{execId}/cancel', tag: 'Executions', summary: 'Cancel active execution run', secured: true },
    { method: 'DELETE', path: '/api/executions/{execId}', tag: 'Executions', summary: 'Delete execution record', secured: true },

    { method: 'POST', path: '/api/record/proxy', tag: 'RecordingProxy', summary: 'Forward HTTP requests through Playwright proxy', secured: false },

    { method: 'GET', path: '/api/global/env-configs', tag: 'GlobalConfigs', summary: 'List global environment configurations', secured: true },
    { method: 'POST', path: '/api/global/env-configs', tag: 'GlobalConfigs', summary: 'Create global environment configuration', secured: true },

    { method: 'GET', path: '/api/global/test-steps', tag: 'GlobalSteps', summary: 'List global reusable test step templates', secured: true },
    { method: 'POST', path: '/api/global/test-steps', tag: 'GlobalSteps', summary: 'Create global test step template', secured: true },

    { method: 'GET', path: '/api/admin/audit-logs', tag: 'AdminSettings', summary: 'View audit activity log history (Admin)', secured: true },
    { method: 'GET', path: '/api/admin/settings', tag: 'AdminSettings', summary: 'Get all system settings (Admin)', secured: true },
    { method: 'PUT', path: '/api/admin/settings/{key}', tag: 'AdminSettings', summary: 'Update system setting value (Admin)', secured: true },
    { method: 'GET', path: '/api/admin/settings/public', tag: 'AdminSettings', summary: 'Get public system configurations', secured: false },
    { method: 'GET', path: '/api/admin/diagnostics', tag: 'AdminSettings', summary: 'System diagnostics & memory statistics (Admin)', secured: true },

    { method: 'GET', path: '/api/admin/logs', tag: 'AdminLogs', summary: 'View backend server logs (Admin)', secured: true },
    { method: 'GET', path: '/api/admin/logs/export', tag: 'AdminLogs', summary: 'Export backend server log file (Admin)', secured: true },

    { method: 'GET', path: '/api/admin/database/tables', tag: 'AdminDatabase', summary: 'List database tables and row counts (Admin)', secured: true },
    { method: 'GET', path: '/api/admin/database/tables/{tableName}/schema', tag: 'AdminDatabase', summary: 'Get table columns & schema (Admin)', secured: true },
    { method: 'POST', path: '/api/admin/database/query', tag: 'AdminDatabase', summary: 'Execute SQL statement in console (Admin)', secured: true },

    { method: 'POST', path: '/api/tools/db-validator/query', tag: 'Tools', summary: 'Validate JDBC database query execution', secured: true },
    { method: 'GET', path: '/api/openapi.yaml', tag: 'AdminSettings', summary: 'Download raw OpenAPI 3.0 YAML specification', secured: false },
  ], []);

  const filteredApiEndpoints = useMemo(() => {
    return apiEndpointsData.filter(ep => {
      const matchesSearch = 
        ep.path.toLowerCase().includes(apiSearch.toLowerCase()) ||
        ep.summary.toLowerCase().includes(apiSearch.toLowerCase()) ||
        ep.tag.toLowerCase().includes(apiSearch.toLowerCase());

      const matchesMethod = apiMethodFilter === 'ALL' || ep.method === apiMethodFilter;
      const matchesTag = apiTagFilter === 'ALL' || ep.tag === apiTagFilter;

      return matchesSearch && matchesMethod && matchesTag;
    });
  }, [apiEndpointsData, apiSearch, apiMethodFilter, apiTagFilter]);

  const uniqueTags = useMemo(() => {
    const tags = Array.from(new Set(apiEndpointsData.map(e => e.tag)));
    return ['ALL', ...tags];
  }, [apiEndpointsData]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const stepsHelpData: StepHelp[] = useMemo(() => [
    {
      type: 'HTTP_REQUEST',
      name: 'HTTP Request',
      category: 'Primary',
      description: 'Performs standard HTTP REST API operations (GET, POST, PUT, DELETE, etc.) against external hosts.',
      icon: <Globe className="h-5 w-5 text-cyan-400" />,
      colorClass: 'border-cyan-500/30 bg-cyan-500/5',
      badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      fields: [
        { name: 'Method', type: 'String', required: true, desc: 'HTTP verb: GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD' },
        { name: 'URL', type: 'String', required: true, desc: 'Target endpoint. Fully supports variable interpolation like {{baseUrl}}/users' },
        { name: 'Headers', type: 'KeyValue Pairs', required: false, desc: 'Request headers. Variable placeholders allowed in both keys and values.' },
        { name: 'Query Parameters', type: 'KeyValue Pairs', required: false, desc: 'Appends URL query string query parameter variables.' },
        { name: 'Body Type', type: 'Select', required: false, desc: 'JSON, XML, Form-Data, Text, or None' },
        { name: 'Payload Body', type: 'String', required: false, desc: 'Post payload or raw payload string content.' }
      ],
      exampleValue: 'POST https://api.service.local/v1/auth/login',
      snippet: JSON.stringify({
        method: "POST",
        url: "{{baseUrl}}/v1/auth/login",
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": "{{requestId}}"
        },
        body: "{\n  \"username\": \"{{adminUser}}\",\n  \"password\": \"{{adminPass}}\"\n}"
      }, null, 2),
      explanation: 'Use this step to interact with microservices, gateway layers, or downstream web application APIs. By assigning mTLS client certificates inside the Environment Drawer, this step will automatically present the target certificate for mutual authentication. Response bodies and headers can be validated or saved downstream.'
    },
    {
      type: 'SOAP_REQUEST',
      name: 'SOAP Request',
      category: 'Primary',
      description: 'Sends custom XML payloads encapsulated inside SOAP envelopes to legacy web service interfaces.',
      icon: <FileCode className="h-5 w-5 text-indigo-400" />,
      colorClass: 'border-indigo-500/30 bg-indigo-500/5',
      badgeClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      fields: [
        { name: 'Endpoint URL', type: 'String', required: true, desc: 'SOAP endpoint URL' },
        { name: 'SOAP Action', type: 'String', required: false, desc: 'SOAPAction request header value' },
        { name: 'SOAP Envelope', type: 'String', required: true, desc: 'XML SOAP body envelope structure' }
      ],
      exampleValue: 'POST https://services.org/CardVerificationService',
      snippet: `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <VerifyCard xmlns="http://services.org/payments">
      <CardNumber>{{cardNumber}}</CardNumber>
      <Expiry>{{cardExpiry}}</Expiry>
    </VerifyCard>
  </soap:Body>
</soap:Envelope>`,
      explanation: 'Designed for enterprise integration workflows communicating with WSDL endpoints. Variable interpolation works in XML elements. Use XPath assertions in downstream assertion sub-steps to check values.'
    },
    {
      type: 'GRAPHQL_REQUEST',
      name: 'GraphQL Request',
      category: 'Primary',
      description: 'Executes clean GraphQL queries or mutations with separate dynamic variable maps.',
      icon: <Globe className="h-5 w-5 text-purple-400" />,
      colorClass: 'border-purple-500/30 bg-purple-500/5',
      badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      fields: [
        { name: 'Endpoint URL', type: 'String', required: true, desc: 'GraphQL service URL' },
        { name: 'Query', type: 'String', required: true, desc: 'Standard GraphQL query or mutation string' },
        { name: 'Variables', type: 'JSON String', required: false, desc: 'JSON object defining query variables' }
      ],
      exampleValue: 'POST https://api.storefront.local/graphql',
      snippet: JSON.stringify({
        query: "query GetProductDetail($id: ID!) {\n  product(id: $id) {\n    title\n    price\n    inventory\n  }\n}",
        variables: {
          id: "{{currentProductId}}"
        }
      }, null, 2),
      explanation: 'Simplifies GraphQL request layouts compared to raw HTTP setups by segregating the operational query document and runtime variables. Interpolate variables directly in the variable fields JSON map.'
    },
    {
      type: 'DATABASE_QUERY',
      name: 'Database Query',
      category: 'Primary',
      description: 'Executes a single SELECT, DML, or DDL SQL query against a targeted JDBC database.',
      icon: <Database className="h-5 w-5 text-blue-400" />,
      colorClass: 'border-blue-500/30 bg-blue-500/5',
      badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      fields: [
        { name: 'Database Target', type: 'Select', required: false, desc: 'Target JDBC Connection Key configured in the Environment drawer.' },
        { name: 'Connection String', type: 'String', required: false, desc: 'Fallback inline JDBC URL override: jdbc:postgresql://localhost:5432/db' },
        { name: 'SQL Query', type: 'String', required: true, desc: 'Single SQL command to execute. Supports double curly brace variable interpolation: {{variableName}}' }
      ],
      exampleValue: 'SELECT count(1) FROM users WHERE active = true',
      snippet: "SELECT status, email, created_at \nFROM accounts \nWHERE account_id = '{{newAccountId}}';",
      explanation: 'Designed for single SQL statement execution per step. Multiple database steps in the same workflow automatically share and reuse pooled connection sessions per execution ID. Results are returned as a JSON structure, and logs can optionally print as formatted terminal console tables.'
    },
    {
      type: 'BROWSER_AUTOMATION',
      name: 'Browser Automation',
      category: 'Primary',
      description: 'Launches a browser automation workflow (via Playwright) to load pages, perform actions, and run UI tests.',
      icon: <MonitorPlay className="h-5 w-5 text-teal-400" />,
      colorClass: 'border-teal-500/30 bg-teal-500/5',
      badgeClass: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
      fields: [
        { name: 'Browser Type', type: 'Select', required: true, desc: 'Chromium, Firefox, or WebKit' },
        { name: 'Headless Mode', type: 'Boolean', required: true, desc: 'Run browser silently or display visually (on supported environments)' },
        { name: 'Actions List', type: 'Array of Actions', required: true, desc: 'Sequence of browser tasks: NAVIGATE, CLICK, FILL, SCREENSHOT, etc.' }
      ],
      exampleValue: 'Actions: NAVIGATE -> CLICK -> FILL -> ASSERT_ELEMENT',
      snippet: JSON.stringify([
        { actionType: "NAVIGATE", value: "{{loginUrl}}" },
        { actionType: "FILL", selector: "#username", value: "{{adminUser}}" },
        { actionType: "FILL", selector: "#password", value: "{{adminPass}}" },
        { actionType: "CLICK", selector: "button[type='submit']" },
        { actionType: "ASSERT_ELEMENT", selector: ".dashboard-container", value: "visible" },
        { actionType: "SCREENSHOT", name: "dashboard_success", fullPage: false }
      ], null, 2),
      explanation: 'Allows end-to-end user-experience validation. Use standard CSS selectors. Captured screenshots are displayed step-by-step in the execution dashboard. Supports variable interpolation inside selectors, URLs, and inputs.'
    },
    {
      type: 'MAINFRAME_TERMINAL',
      name: 'Mainframe Terminal',
      category: 'Primary',
      description: 'Emulates direct TN3270 / TN3270E connections to IBM mainframes to interact with green-screen panels.',
      icon: <Monitor className="h-5 w-5 text-lime-400" />,
      colorClass: 'border-lime-500/30 bg-lime-500/5',
      badgeClass: 'bg-lime-500/10 text-lime-400 border-lime-500/20',
      fields: [
        { name: 'Host Address', type: 'String', required: true, desc: 'Mainframe host IP or hostname. Variables allowed: {{mainframeHost}}' },
        { name: 'Terminal Port', type: 'Integer', required: true, desc: 'TN3270 service port. Variables allowed: {{mainframePort}}' },
        { name: 'Terminal Model', type: 'Select', required: true, desc: 'IBM-3278-2 (24x80), IBM-3278-5 (27x132)' },
        { name: 'Actions List', type: 'Array of Actions', required: true, desc: 'Sequence of interactions: waitForField, waitForText, input, sendKey, readField, screenshot, sleep' }
      ],
      exampleValue: 'Actions: waitForText -> input -> sendKey -> screenshot',
      snippet: JSON.stringify([
        { type: "waitForText", text: "ENTER USERID", timeout: 5000 },
        { type: "input", row: 10, col: 20, value: "{{mUser}}" },
        { type: "input", row: 11, col: 20, value: "{{mPass}}" },
        { type: "sendKey", key: "ENTER" },
        { type: "waitForField", timeout: 5000 },
        { type: "readField", row: 2, col: 5, length: 16, variableName: "logonStatus" },
        { type: "screenshot", name: "mainframe_login" }
      ], null, 2),
      explanation: 'Emulates physical mainframe key input and screen reading actions. Active sessions are pooled by execution ID, letting multiple terminal steps execute in the same continuous terminal session. Terminal screenshots are rendered as visual PNG captures and stored in the step execution screenshot gallery.'
    },
    {
      type: 'DB_CONNECT',
      name: 'Database Connect Session',
      category: 'Primary',
      description: 'Establishes and validates a JDBC connection session to reduce query overhead for multiple database step operations.',
      icon: <Database className="h-5 w-5 text-cyan-400" />,
      colorClass: 'border-cyan-500/30 bg-cyan-500/5',
      badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      fields: [
        { name: 'Database Target', type: 'Select', required: false, desc: 'Target JDBC connection key configured in Environment drawer.' },
        { name: 'Connection String', type: 'String', required: false, desc: 'Fallback JDBC URL (e.g. jdbc:postgresql://localhost:5432/mydb)' },
        { name: 'Username / Password', type: 'String', required: false, desc: 'Database access credentials' }
      ],
      exampleValue: 'Session: default_db',
      snippet: JSON.stringify({
        dbKey: "default_db",
        connectionString: "jdbc:postgresql://{{dbHost}}:5432/{{dbName}}"
      }, null, 2),
      explanation: 'Pre-validates connection parameters and SSL client certificates before executing subsequent SQL query steps.'
    },
    {
      type: 'MAINFRAME_CONNECT',
      name: 'Mainframe Connect Session',
      category: 'Primary',
      description: 'Establishes and holds an active TN3270 / TN3270E terminal connection session to an IBM Mainframe host.',
      icon: <Monitor className="h-5 w-5 text-emerald-400" />,
      colorClass: 'border-emerald-500/30 bg-emerald-500/5',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      fields: [
        { name: 'Host Address', type: 'String', required: true, desc: 'Mainframe host IP or hostname' },
        { name: 'Port', type: 'Integer', required: true, desc: 'TN3270 service port (default: 23)' },
        { name: 'Model', type: 'Select', required: true, desc: 'IBM-3278-2 (24x80) or IBM-3278-5 (27x132)' },
        { name: 'SSL/TLS', type: 'Boolean', required: false, desc: 'Enable secure TN3270S encryption' }
      ],
      exampleValue: 'Connect: mainframe.corp:23 (IBM-3278-2)',
      snippet: JSON.stringify({
        host: "mainframe.corp",
        port: 23,
        model: "IBM-3278-2",
        useSsl: false
      }, null, 2),
      explanation: 'Opens a persistent terminal session so subsequent Mainframe Terminal steps execute within the same green-screen session.'
    },
    {
      type: 'AUTH_TOKEN',
      name: 'Generate Auth Token',
      category: 'Support',
      description: 'Generates Basic Auth or fetches OAuth 2.0 (Client Credentials / Password) & API Key tokens for step authorization.',
      icon: <KeyRound className="h-5 w-5 text-cyan-400" />,
      colorClass: 'border-cyan-500/30 bg-cyan-500/5',
      badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      fields: [
        { name: 'Auth Type', type: 'Select', required: true, desc: 'BASIC, OAUTH2_CLIENT_CREDENTIALS, OAUTH2_PASSWORD, or API_KEY' },
        { name: 'Target Variable', type: 'String', required: false, desc: 'Variable name to save token in (default: authToken).' },
        { name: 'Token URL', type: 'String', required: false, desc: 'OAuth 2.0 token endpoint (e.g., https://auth.company.com/oauth/token)' },
        { name: 'Client ID', type: 'String', required: false, desc: 'OAuth2 client ID credentials' },
        { name: 'Client Secret', type: 'String', required: false, desc: 'OAuth2 client secret credentials' },
        { name: 'Scope', type: 'String', required: false, desc: 'Requested OAuth scope string' },
        { name: 'Username / Password', type: 'String', required: false, desc: 'Required for Basic Auth or OAuth2 Password grant' }
      ],
      exampleValue: 'Target: authToken, Type: OAUTH2_CLIENT_CREDENTIALS',
      snippet: JSON.stringify({
        authType: "OAUTH2_CLIENT_CREDENTIALS",
        targetVariable: "authToken",
        tokenUrl: "https://auth.company.com/oauth/token",
        clientId: "{{clientId}}",
        clientSecret: "{{clientSecret}}",
        scope: "read write"
      }, null, 2),
      explanation: 'Executes token retrieval and automatically prefixes OAuth tokens with "Bearer ". The output variable (default: authToken) can be referenced directly in subsequent HTTP headers as Authorization: {{authToken}}. Automatically respects Skip SSL Verification and System Proxy settings.'
    },
    {
      type: 'ASSERTION',
      name: 'Validation Assertion',
      category: 'Support',
      description: 'Evaluates the success of preceding steps by verifying status codes, payloads, header structures, or latency parameters.',
      icon: <CheckCircle className="h-5 w-5 text-emerald-400" />,
      colorClass: 'border-emerald-500/30 bg-emerald-500/5',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      fields: [
        { name: 'Target Field', type: 'Select', required: true, desc: 'STATUS_CODE, RESPONSE_BODY, RESPONSE_TIME, HEADER' },
        { name: 'Operator', type: 'Select', required: true, desc: 'EQUALS, CONTAINS, MATCHES_REGEX, GREATER_THAN, IS_NULL' },
        { name: 'JsonPath/XPath', type: 'String', required: false, desc: 'Query selector to target nested fields in HTTP/SOAP payloads.' },
        { name: 'Expected Value', type: 'String', required: true, desc: 'Value to validate against. Supports variable placeholders.' }
      ],
      exampleValue: 'STATUS_CODE EQUALS 200',
      snippet: JSON.stringify({
        targetField: "RESPONSE_BODY",
        jsonPath: "$.user.profile.active",
        operator: "EQUALS",
        expectedValue: "true"
      }, null, 2),
      explanation: 'If any assertion in this block fails, the containing test case execution is immediately flagged as FAILED, unless conditional structures allow otherwise. You can chain multiple assertions sequentially.'
    },
    {
      type: 'SET_VARIABLE',
      name: 'Extract Variable',
      category: 'Support',
      description: 'Extracts values from execution logs, headers, or request/response payloads to store in memory for subsequent steps.',
      icon: <HelpCircle className="h-5 w-5 text-pink-400" />,
      colorClass: 'border-pink-500/30 bg-pink-500/5',
      badgeClass: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
      fields: [
        { name: 'Save Key', type: 'String', required: true, desc: 'Name of the variable (e.g. authToken). Must not contain spaces.' },
        { name: 'Source', type: 'Select', required: true, desc: 'RESPONSE_BODY or RESPONSE_HEADER' },
        { name: 'Format', type: 'Select', required: true, desc: 'JSON or XML (Only applicable for Body)' },
        { name: 'JSONPath / XPath', type: 'String', required: false, desc: 'Expression to fetch the targeted property.' },
        { name: 'Header Name', type: 'String', required: false, desc: 'Name of header (e.g., Authorization) to record.' }
      ],
      exampleValue: 'authToken = RESPONSE_HEADER.Authorization',
      snippet: JSON.stringify({
        variableName: "createdUserId",
        source: "RESPONSE_BODY",
        payloadFormat: "JSON",
        jsonPath: "$.id"
      }, null, 2),
      explanation: 'Crucial for step chaining (e.g., extracting a dynamic JWT token from a Login response to include in subsequent API requests as Authorization: Bearer {{createdUserId}}).'
    },
    {
      type: 'CSV_EXTRACT',
      name: 'CSV Dataset Extract',
      category: 'Support',
      description: 'Parses database outputs or pasted CSV rows to load data grids directly into local execution variables.',
      icon: <FileJson className="h-5 w-5 text-amber-400" />,
      colorClass: 'border-amber-500/30 bg-amber-500/5',
      badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      fields: [
        { name: 'CSV Payload', type: 'Textarea', required: true, desc: 'CSV records separated by line breaks. Column headers required in first row.' },
        { name: 'Select Strategy', type: 'Select', required: true, desc: 'SEQUENTIAL, RANDOM, or MATCH_KEY (matches variables).' },
        { name: 'Assign Prefix', type: 'String', required: false, desc: 'Prefix to avoid variable key name clashes (e.g. csv_).' }
      ],
      exampleValue: 'Columns: id,username,role',
      snippet: `username,email,tier\nuser1,u1@orion.dev,pro\nuser2,u2@orion.dev,standard`,
      explanation: 'Loads structured tables into executing contexts. Great for data-driven testing workflows where inputs vary across test steps inside loop sequences.'
    },
    {
      type: 'RESPONSE_PROCESSOR',
      name: 'Response Recorder',
      category: 'Support',
      description: 'Allows recording, filtering, and validating fragments of large responses to optimize database storage.',
      icon: <Eye className="h-5 w-5 text-amber-400" />,
      colorClass: 'border-amber-500/30 bg-amber-500/5',
      badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      fields: [
        { name: 'Target Element', type: 'String', required: true, desc: 'JSONPath or XPath element in response to filter.' },
        { name: 'Truncate Limit', type: 'Integer', required: false, desc: 'Character limit threshold for response logging.' },
        { name: 'Action On Size Exceeded', type: 'Select', required: true, desc: 'TRUNCATE, FAIL_STEP, or IGNORE_BODY' }
      ],
      exampleValue: 'Filter: $.data.hugePayloadList',
      snippet: JSON.stringify({
        targetElement: "$.data.records",
        truncateLimit: 500,
        actionOnSizeExceeded: "TRUNCATE"
      }, null, 2),
      explanation: 'Prevents database bloat on steps handling heavy datasets (megabytes of JSON/XML). Ensures test logs are clean, focused, and secure.'
    },
    {
      type: 'LOG',
      name: 'Log Message',
      category: 'Display',
      description: 'Prints custom messages to the execution report screen, dynamically resolving runtime variables.',
      icon: <FileText className="h-5 w-5 text-gray-400" />,
      colorClass: 'border-gray-500/30 bg-gray-500/5',
      badgeClass: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
      fields: [
        { name: 'Log Level', type: 'Select', required: true, desc: 'INFO, DEBUG, WARN, ERROR' },
        { name: 'Message Text', type: 'String', required: true, desc: 'Dynamic text using {{placeholders}}' }
      ],
      exampleValue: 'Execution status of {{userId}} is active',
      snippet: "Created client successfully with ID: {{createdUserId}} and correlation token: {{correlationToken}}",
      explanation: 'Used for debugging. Renders clearly in the live logs list of your executions pane.'
    },
    {
      type: 'DB_TABLE_VIEW',
      name: 'DB Table View',
      category: 'Display',
      description: 'Renders the result rows of a SQL SELECT statement as a visual data grid inside the execution report.',
      icon: <Database className="h-5 w-5 text-orange-400" />,
      colorClass: 'border-orange-500/30 bg-orange-500/5',
      badgeClass: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      fields: [
        { name: 'Database Key', type: 'Select', required: false, desc: 'Reference configured database keys.' },
        { name: 'SQL Query', type: 'String', required: true, desc: 'SELECT statement' },
        { name: 'Table Title', type: 'String', required: false, desc: 'Header title for rendering the grid in reports.' }
      ],
      exampleValue: 'SELECT * FROM audit_logs LIMIT 10',
      snippet: "SELECT transaction_id, amount, status FROM transactions WHERE user_id = '{{userId}}' LIMIT 50;",
      explanation: 'Improves execution report review by embedding query outputs inside step logs, bypassing the need for separate DB client checks.'
    },
    {
      type: 'DELAY',
      name: 'Delay/Pause',
      category: 'Technical',
      description: 'Suspends workflow execution for a defined period (in milliseconds) before progressing.',
      icon: <Clock className="h-5 w-5 text-yellow-400" />,
      colorClass: 'border-yellow-500/30 bg-yellow-500/5',
      badgeClass: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      fields: [
        { name: 'Duration (ms)', type: 'Integer', required: true, desc: 'Pause duration. E.g. 5000 for 5 seconds.' }
      ],
      exampleValue: 'Duration: 3000',
      snippet: JSON.stringify({ durationMs: 3000 }, null, 2),
      explanation: 'Essential for testing asynchronous systems, queuing services, or processing pipelines that require buffer intervals.'
    },
    {
      type: 'CONDITIONAL',
      name: 'Conditional Branch',
      category: 'Technical',
      description: 'Executes nested step blocks only when a evaluated JavaScript expression returns true.',
      icon: <GitBranch className="h-5 w-5 text-indigo-400" />,
      colorClass: 'border-indigo-500/30 bg-indigo-500/5',
      badgeClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      fields: [
        { name: 'Condition Expression', type: 'String', required: true, desc: 'JS expression (e.g. context.get("status") === "ACTIVE")' }
      ],
      exampleValue: 'context.get("status") === "success"',
      snippet: "context.get('statusCode') == 200 && context.get('isNewUser') === true",
      explanation: 'Enables branching logic in test sequences, bypassing administrative steps or setting alternate pathways for failures.'
    },
    {
      type: 'LOOP',
      name: 'Loop Iteration',
      category: 'Technical',
      description: 'Repeats a nested set of test steps over a specific range or elements in a response collection.',
      icon: <Repeat className="h-5 w-5 text-purple-400" />,
      colorClass: 'border-purple-500/30 bg-purple-500/5',
      badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      fields: [
        { name: 'Loop Type', type: 'Select', required: true, desc: 'COUNT (numeric loops) or COLLECTION (lists/arrays)' },
        { name: 'Iterations / Path', type: 'String', required: true, desc: 'Number of loops or JSONPath referencing the collection array.' },
        { name: 'Index Variable', type: 'String', required: false, desc: 'Stores current loop index (e.g., loopIndex) to access elements.' }
      ],
      exampleValue: 'Loop: 5 times, Index: i',
      snippet: JSON.stringify({
        loopType: "COLLECTION",
        collectionPath: "$.items",
        indexVariable: "index",
        itemVariable: "currentItem"
      }, null, 2),
      explanation: 'Use this step to process multi-row database returns, paginate through REST payloads, or execute performance tests with dynamic inputs.'
    },
    {
      type: 'SCRIPT',
      name: 'Custom Script',
      category: 'Technical',
      description: 'Evaluates standard JavaScript code inside a safe backend sandboxed script execution engine.',
      icon: <Terminal className="h-5 w-5 text-teal-400" />,
      colorClass: 'border-teal-500/30 bg-teal-500/5',
      badgeClass: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
      fields: [
        { name: 'JavaScript Code', type: 'String', required: true, desc: 'JavaScript commands utilizing the backend context object.' }
      ],
      exampleValue: 'context.put("hash", md5(context.get("data")))',
      snippet: `// Retrieve existing variable\nconst orderTotal = parseFloat(context.get('totalAmount'));\n\n// Perform mathematical operations or string mutations\nconst calculatedTax = orderTotal * 0.0825;\nconst finalAmount = orderTotal + calculatedTax;\n\n// Save variables back to the execution context\ncontext.put('salesTax', calculatedTax.toFixed(2));\ncontext.put('totalWithTax', finalAmount.toFixed(2));\n\n// Log details using print functions\nprint("Sales tax calculated: " + calculatedTax);`,
      explanation: 'Allows advanced scripting like hashing passwords, generating UUIDs, converting epoch times, encoding query payloads, or chaining scripts.'
    },
    {
      type: 'PARALLEL',
      name: 'Parallel Group',
      category: 'Technical',
      description: 'Groups multiple tasks together, executing them simultaneously using virtual threading.',
      icon: <Split className="h-5 w-5 text-violet-400" />,
      colorClass: 'border-violet-500/30 bg-violet-500/5',
      badgeClass: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
      fields: [
        { name: 'Sub-steps list', type: 'Container', required: true, desc: 'Drag-and-drop container for sub-steps' },
        { name: 'Max Threads', type: 'Integer', required: false, desc: 'Maximum concurrent threads (default: automatic)' }
      ],
      exampleValue: 'Parallel: Send 3 HTTP Requests concurrently',
      snippet: 'Visual container node supporting multiple parallel lanes.',
      explanation: 'Reduces test run durations by processing independent tasks concurrently. Ideal for launching multiple microservice checks or testing race conditions.'
    },
    {
      type: 'GLOBAL_REF',
      name: 'Global Step Template',
      category: 'Technical',
      description: 'References a predefined, admin-managed reusable step configuration template.',
      icon: <Link className="h-5 w-5 text-amber-400" />,
      colorClass: 'border-amber-500/30 bg-amber-500/5',
      badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      fields: [
        { name: 'Step Template', type: 'Select', required: true, desc: 'Pre-defined global step config.' },
        { name: 'Override Variables', type: 'KeyValue Pairs', required: false, desc: 'Override values for target step parameters.' }
      ],
      exampleValue: 'Template: Standard LDAP Login Check',
      snippet: JSON.stringify({
        globalStepId: "12",
        overrides: {
          username: "test_user_override"
        }
      }, null, 2),
      explanation: 'Promotes code reuse. Admins configure step templates (like SSO validation or environment diagnostics) in "Global Steps", which testers can drop into any test case.'
    }
  ], []);

  const filteredSteps = useMemo(() => {
    return stepsHelpData.filter(step => 
      step.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      step.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      step.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      step.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, stepsHelpData]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent flex items-center gap-2">
            <HelpCircle className="h-8 w-8 text-primary" />
            User Guide & Documentation
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Learn about ORION's execution design patterns, variable rules, test steps catalog, and scripting utilities.
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search steps, terms, syntax..."
            className="w-full h-10 pl-9 pr-4 rounded-md border border-border bg-card text-foreground placeholder:text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Main Tabs Container */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 h-auto p-1.5 bg-secondary/35 border border-border/40 rounded-xl mb-6">
          <TabsTrigger value="overview" className="py-2.5 font-bold rounded-lg transition-all text-xs flex items-center justify-center gap-2">
            <BookOpen className="h-4 w-4" />
            <span>Overview</span>
          </TabsTrigger>
          <TabsTrigger value="catalog" className="py-2.5 font-bold rounded-lg transition-all text-xs flex items-center justify-center gap-2">
            <Workflow className="h-4 w-4" />
            <span>Step Catalog</span>
          </TabsTrigger>
          <TabsTrigger value="variables" className="py-2.5 font-bold rounded-lg transition-all text-xs flex items-center justify-center gap-2">
            <FileJson className="h-4 w-4" />
            <span>Variables & JSONPath</span>
          </TabsTrigger>
          <TabsTrigger value="scripting" className="py-2.5 font-bold rounded-lg transition-all text-xs flex items-center justify-center gap-2">
            <Terminal className="h-4 w-4" />
            <span>JS Sandbox</span>
          </TabsTrigger>
          <TabsTrigger value="advanced" className="py-2.5 font-bold rounded-lg transition-all text-xs flex items-center justify-center gap-2">
            <Sliders className="h-4 w-4" />
            <span>Advanced Guides</span>
          </TabsTrigger>
          <TabsTrigger value="openapi" className="py-2.5 font-bold rounded-lg transition-all text-xs flex items-center justify-center gap-2">
            <FileCode className="h-4 w-4 text-cyan-400" />
            <span>OpenAPI Specs</span>
          </TabsTrigger>
        </TabsList>

        {/* ── TAB CONTENT: OVERVIEW ────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <Card className="border border-border/40 bg-card/25 backdrop-blur-sm shadow-md">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Info className="h-5 w-5 text-primary" />
                    What is ORION?
                  </CardTitle>
                  <CardDescription>Visual Test Design & Parallel Execution Orchestrator</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                  <p>
                    ORION is an enterprise-grade automated testing workstation designed to simplify end-to-end interface validation. It merges visual workflow designer graphs with a high-performance execution engine capable of running processes concurrently.
                  </p>
                  <p>
                    Instead of writing brittle custom frameworks in code, ORION enables QA professionals, developers, and product teams to assemble test sequences using simple, structured building blocks. Under the hood, ORION compiles these visual steps into structured test matrices executed inside standard Java environments.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="p-3.5 bg-secondary/20 rounded-lg border border-border/20">
                      <h4 className="text-foreground font-bold text-xs uppercase tracking-wider mb-1">State Isolation</h4>
                      <p className="text-[12px]">Each test execution launches a sandbox environment context. Local variables, database connections, and session variables are isolated to prevent cross-run contamination.</p>
                    </div>
                    <div className="p-3.5 bg-secondary/20 rounded-lg border border-border/20">
                      <h4 className="text-foreground font-bold text-xs uppercase tracking-wider mb-1">Execution Speed</h4>
                      <p className="text-[12px]">The orchestration engine utilizes multi-threaded parallel queues. Executions run rapidly, bypassing sequential network waiting blocks.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Core Execution Flow Diagram */}
              <Card className="border border-border/40 bg-card/25 backdrop-blur-sm shadow-md">
                <CardHeader>
                  <CardTitle className="text-base font-bold">Standard Test Execution Sequence</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-3">
                    <div className="flex flex-col items-center p-3 bg-secondary/40 border border-border/40 rounded-lg w-full sm:w-1/4 text-center">
                      <span className="text-[10px] font-bold text-primary uppercase">Step 1: Setup</span>
                      <span className="text-xs font-semibold mt-1 text-foreground">Load Environment</span>
                      <p className="text-[9px] text-muted-foreground mt-0.5">Injects keys, secrets, & JDBC connections</p>
                    </div>
                    <ArrowRight className="hidden sm:block h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex flex-col items-center p-3 bg-secondary/40 border border-border/40 rounded-lg w-full sm:w-1/4 text-center">
                      <span className="text-[10px] font-bold text-cyan-400 uppercase">Step 2: Designer</span>
                      <span className="text-xs font-semibold mt-1 text-foreground">Visual Node Flow</span>
                      <p className="text-[9px] text-muted-foreground mt-0.5">Runs APIs, Queries, Loops or Scripts</p>
                    </div>
                    <ArrowRight className="hidden sm:block h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex flex-col items-center p-3 bg-secondary/40 border border-border/40 rounded-lg w-full sm:w-1/4 text-center">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase">Step 3: Assertions</span>
                      <span className="text-xs font-semibold mt-1 text-foreground">Evaluate Quality</span>
                      <p className="text-[9px] text-muted-foreground mt-0.5">Validate outputs, statuses & times</p>
                    </div>
                    <ArrowRight className="hidden sm:block h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex flex-col items-center p-3 bg-secondary/40 border border-border/40 rounded-lg w-full sm:w-1/4 text-center">
                      <span className="text-[10px] font-bold text-amber-400 uppercase">Step 4: Output</span>
                      <span className="text-xs font-semibold mt-1 text-foreground">Live Metrics Log</span>
                      <p className="text-[9px] text-muted-foreground mt-0.5">Step-by-step reports & trace logs</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar quick hints */}
            <div className="space-y-6">
              <Card className="border border-border/40 bg-secondary/15 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                    <Sliders className="h-4.5 w-4.5 text-primary" />
                    Workspace Components
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="border-l-2 border-primary pl-3 py-0.5">
                    <h5 className="font-bold text-foreground">Applications</h5>
                    <p className="text-muted-foreground mt-0.5">Logical container grouping related test suites and endpoints.</p>
                  </div>
                  <div className="border-l-2 border-cyan-400 pl-3 py-0.5">
                    <h5 className="font-bold text-foreground">Test Cases</h5>
                    <p className="text-muted-foreground mt-0.5">A series of steps connected sequentially in the workflow designer canvas.</p>
                  </div>
                  <div className="border-l-2 border-emerald-400 pl-3 py-0.5">
                    <h5 className="font-bold text-foreground">Environments</h5>
                    <p className="text-muted-foreground mt-0.5">Drawers hosting key-value variables (Dev, Staging, Prod), connection secrets, and local setup mappings.</p>
                  </div>
                  <div className="border-l-2 border-orange-400 pl-3 py-0.5">
                    <h5 className="font-bold text-foreground">Database Keys</h5>
                    <p className="text-muted-foreground mt-0.5">Named JDBC configuration references allowing SQL checks to execute across environments without editing code.</p>
                  </div>
                </CardContent>
              </Card>

              <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <h4 className="font-bold text-foreground">Security Notice</h4>
                  <p className="text-muted-foreground leading-relaxed">
                    User actions, changes to environments, and database validations are fully captured in the system's Audit Logs for compliance review.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── TAB CONTENT: STEP CATALOG ───────────────────────────────────── */}
        <TabsContent value="catalog" className="space-y-6 mt-0">
          {searchQuery && (
            <p className="text-xs text-muted-foreground">
              Showing {filteredSteps.length} of {stepsHelpData.length} steps matching search query.
            </p>
          )}

          {filteredSteps.length === 0 ? (
            <div className="text-center py-12 border border-border border-dashed rounded-lg bg-card/10">
              <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <h3 className="font-bold text-sm text-foreground">No steps found</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Try refining your search text or clear the filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {filteredSteps.map((step) => (
                <Card key={step.type} className={`border ${step.colorClass} shadow-md overflow-hidden transition-all hover:border-primary/45`}>
                  <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/30 bg-secondary/5 py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-secondary rounded-lg border border-border/40 shrink-0">
                        {step.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base font-extrabold">{step.name}</CardTitle>
                          <Badge variant="outline" className={`text-[9px] uppercase font-bold tracking-wider ${step.badgeClass}`}>
                            {step.category}
                          </Badge>
                          <span className="text-[10px] font-mono text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded border border-border/40">
                            {step.type}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleCopy(step.type, step.snippet)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-secondary hover:bg-secondary/80 border border-border text-foreground rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
                    >
                      {copiedId === step.type ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>Copy Template</span>
                        </>
                      )}
                    </button>
                  </CardHeader>
                  <CardContent className="p-6 space-y-5">
                    {/* Grid containing properties and snippet */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-3.5">
                        <h4 className="text-xs font-extrabold uppercase text-foreground tracking-wider">Field Configurations</h4>
                        <div className="overflow-x-auto border border-border/40 rounded-lg">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-secondary/45 border-b border-border/40">
                                <th className="p-2.5 font-bold text-foreground">Property</th>
                                <th className="p-2.5 font-bold text-foreground">Type</th>
                                <th className="p-2.5 font-bold text-foreground text-center">Req.</th>
                                <th className="p-2.5 font-bold text-foreground">Description</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30 bg-card/10">
                              {step.fields.map((field) => (
                                <tr key={field.name} className="hover:bg-secondary/10">
                                  <td className="p-2.5 font-semibold text-foreground">{field.name}</td>
                                  <td className="p-2.5 font-mono text-muted-foreground text-[10px]">{field.type}</td>
                                  <td className="p-2.5 text-center">
                                    {field.required ? (
                                      <span className="text-destructive font-extrabold">*</span>
                                    ) : (
                                      <span className="text-muted-foreground text-[10px]">No</span>
                                    )}
                                  </td>
                                  <td className="p-2.5 text-muted-foreground leading-normal">{field.desc}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="space-y-3.5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-extrabold uppercase text-foreground tracking-wider">Config Block Template</h4>
                          <span className="text-[10px] font-mono text-muted-foreground">JSON/YAML Schema</span>
                        </div>
                        <pre className="p-3.5 bg-secondary/40 border border-border/40 rounded-lg text-[11px] font-mono text-foreground overflow-x-auto max-h-56 scrollbar-thin">
                          <code>{step.snippet}</code>
                        </pre>
                      </div>
                    </div>

                    {/* Explanations section */}
                    <div className="p-3 bg-secondary/15 border border-border/30 rounded-lg">
                      <h5 className="text-[11px] font-extrabold uppercase text-foreground tracking-wider mb-1">Execution Behavior & Usage Guide</h5>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{step.explanation}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── TAB CONTENT: VARIABLES & JSONPATH ────────────────────────────── */}
        <TabsContent value="variables" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              {/* Variable Rules Card */}
              <Card className="border border-border/40 bg-card/25 backdrop-blur-sm shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <FileJson className="h-5 w-5 text-primary" />
                    How Variable Interpolation Works
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                  <p>
                    Variables in ORION are stored in a runtime execution memory context dictionary. These variables can be initialized in the **Environment Drawer** or extracted on-the-fly during test step operations.
                  </p>
                  <p>
                    To inject variables into request URLs, payload strings, headers, JDBC configurations, or SQL queries, enclose the variable key in double curly brackets:
                  </p>
                  <div className="p-3 bg-secondary/40 border border-border/40 rounded-lg text-center font-mono text-foreground text-sm">
                    {"{{myVariableName}}"}
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">Dynamic Interpolation Examples</h4>
                    <ul className="list-disc pl-5 space-y-2 text-xs">
                      <li>
                        <strong className="text-foreground">URL Path:</strong> <code>https://api.myweb.com/users/{"{{userId}}"}</code>
                      </li>
                      <li>
                        <strong className="text-foreground">Request Headers:</strong> <code>Authorization: Bearer {"{{userToken}}"}</code>
                      </li>
                      <li>
                        <strong className="text-foreground">SQL Scripting:</strong> <code>UPDATE profiles SET verified = true WHERE id = '{"{{profileId}}"}';</code>
                      </li>
                      <li>
                        <strong className="text-foreground">POST JSON Body:</strong> 
                        <pre className="p-2 bg-secondary/20 border border-border/20 rounded mt-1 font-mono text-[10px] text-foreground">
                          {"{\n  \"client\": \"{{clientName}}\",\n  \"limit\": {{defaultLimit}}\n}"}
                        </pre>
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* JSONPath syntax table */}
              <Card className="border border-border/40 bg-card/25 backdrop-blur-sm shadow-md">
                <CardHeader>
                  <CardTitle className="text-base font-bold">JSONPath Selection Syntax Cheat Sheet</CardTitle>
                  <CardDescription>Use this guide to extract fields from JSON bodies in Extract Variable nodes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto border border-border/40 rounded-lg">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-secondary/45 border-b border-border/40">
                          <th className="p-2.5 font-bold text-foreground">Query Target</th>
                          <th className="p-2.5 font-bold text-foreground">JSONPath Expression</th>
                          <th className="p-2.5 font-bold text-foreground">Example Match</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30 bg-card/10 text-muted-foreground font-mono">
                        <tr className="hover:bg-secondary/10">
                          <td className="p-2.5 text-foreground font-sans">Root attribute</td>
                          <td className="p-2.5 text-primary">$.id</td>
                          <td className="p-2.5">123</td>
                        </tr>
                        <tr className="hover:bg-secondary/10">
                          <td className="p-2.5 text-foreground font-sans">Nested property</td>
                          <td className="p-2.5 text-primary">$.data.user.email</td>
                          <td className="p-2.5">"johndoe@domain.com"</td>
                        </tr>
                        <tr className="hover:bg-secondary/10">
                          <td className="p-2.5 text-foreground font-sans">First array item</td>
                          <td className="p-2.5 text-primary">$.items[0].name</td>
                          <td className="p-2.5">"Orion Pro Kit"</td>
                        </tr>
                        <tr className="hover:bg-secondary/10">
                          <td className="p-2.5 text-foreground font-sans">All values in list</td>
                          <td className="p-2.5 text-primary">$.items[*].price</td>
                          <td className="p-2.5">[29.99, 14.50]</td>
                        </tr>
                        <tr className="hover:bg-secondary/10">
                          <td className="p-2.5 text-foreground font-sans">Filter item by condition</td>
                          <td className="p-2.5 text-primary">$.items[?(@.active == true)].id</td>
                          <td className="p-2.5">[1003, 1007]</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* XPath sidebar guide */}
            <div className="space-y-6">
              <Card className="border border-border/40 bg-secondary/15 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                    <FileCode className="h-4.5 w-4.5 text-primary" />
                    SOAP/XML XPath Extracts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs text-muted-foreground leading-relaxed">
                  <p>
                    When handling SOAP web services, use XPath queries to extract data values.
                  </p>
                  <div className="space-y-3.5">
                    <div>
                      <h5 className="font-bold text-foreground">Target XML Node:</h5>
                      <code className="text-[10px] bg-secondary/30 p-1 rounded block border border-border/30 font-mono mt-1 text-foreground">
                        {"/soap:Envelope/soap:Body/VerifyResult/CardStatus/text()"}
                      </code>
                    </div>
                    <div>
                      <h5 className="font-bold text-foreground">Querying Namespaces:</h5>
                      <p className="text-[11px] mt-0.5">XPath processing supports standard namespaces automatically. Reference element tags locally if XML incorporates namespaces without strict declarations:</p>
                      <code className="text-[10px] bg-secondary/30 p-1 rounded block border border-border/30 font-mono mt-1 text-foreground">
                        {"//*[local-name()='CardStatus']/text()"}
                      </code>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <h4 className="font-bold text-foreground">Avoid Circular Loops</h4>
                  <p className="text-muted-foreground leading-relaxed text-[11px]">
                    Updating a variable dynamically resolves variables immediately in all subsequent blocks. Be careful not to reference the variable inside its own extraction query.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── TAB CONTENT: JS SANDBOX ──────────────────────────────────────── */}
        <TabsContent value="scripting" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <Card className="border border-border/40 bg-card/25 backdrop-blur-sm shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Code className="h-5 w-5 text-primary" />
                    JavaScript Scripting Sandbox API
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                  <p>
                    For complex logic that cannot be built visually, drop a **Custom Script** step (type <code>SCRIPT</code>) into the test case canvas. ORION runs this script inside a secured, isolated backend script compilation sandbox.
                  </p>
                  <p>
                    The script has access to a global <code>context</code> object mapping execution memory.
                  </p>

                  <div className="space-y-3">
                    <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">Context Methods Reference</h4>
                    <div className="overflow-x-auto border border-border/40 rounded-lg">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-secondary/45 border-b border-border/40">
                            <th className="p-2.5 font-bold text-foreground">Signature Method</th>
                            <th className="p-2.5 font-bold text-foreground">Returns</th>
                            <th className="p-2.5 font-bold text-foreground">Usage Summary</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30 bg-card/10 text-muted-foreground font-mono">
                          <tr className="hover:bg-secondary/10">
                            <td className="p-2.5 text-primary">context.get(key)</td>
                            <td className="p-2.5">String</td>
                            <td className="p-2.5 font-sans">Fetches the variable value associated with key name. Returns null if not exists.</td>
                          </tr>
                          <tr className="hover:bg-secondary/10">
                            <td className="p-2.5 text-primary">context.put(key, value)</td>
                            <td className="p-2.5">Void</td>
                            <td className="p-2.5 font-sans">Stores value inside execution context memory, overwriting existing variables.</td>
                          </tr>
                          <tr className="hover:bg-secondary/10">
                            <td className="p-2.5 text-primary">context.clear(key)</td>
                            <td className="p-2.5">Void</td>
                            <td className="p-2.5 font-sans">Deletes the key-value pair mapping from the execution context.</td>
                          </tr>
                          <tr className="hover:bg-secondary/10">
                            <td className="p-2.5 text-primary">print(message)</td>
                            <td className="p-2.5">Void</td>
                            <td className="p-2.5 font-sans">Outputs text directly to the execution trace log area.</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Complete Script Example */}
              <Card className="border border-border/40 bg-card/25 backdrop-blur-sm shadow-md">
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center justify-between">
                    <span>Complex JS Sandbox Example Script</span>
                    <Badge variant="secondary">Javascript ECMAScript 5</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <pre className="p-4 bg-secondary/40 border border-border/40 rounded-lg text-xs font-mono text-foreground overflow-x-auto max-h-80 scrollbar-thin">
                      <code>{`// 1. Fetch values from previous steps\nconst responseTimeStr = context.get('lastResponseTime');\nconst payloadJson = context.get('lastResponseBody');\n\nif (!payloadJson) {\n    throw new Error("Missing response payload from preceding step!");\n}\n\n// 2. Parse response JSON\nconst response = JSON.parse(payloadJson);\nprint("Verifying response signature for user: " + response.username);\n\n// 3. Perform custom logic and algorithms\nconst thresholdMs = 1500;\nconst duration = parseInt(responseTimeStr || "0");\n\nif (duration > thresholdMs) {\n    print("WARNING: Latency exceeded threshold limits. Latency: " + duration + "ms");\n    context.put("perf_warning", "true");\n} else {\n    context.put("perf_warning", "false");\n}\n\n// 4. Generate dynamic mock variables\nconst mockEmail = response.username.toLowerCase() + "_" + Math.floor(Math.random() * 1000) + "@domain.com";\ncontext.put("generatedUserEmail", mockEmail);\nprint("Saved temporary test email: " + mockEmail);`}</code>
                    </pre>
                    <button
                      onClick={() => handleCopy('complex_script', `const responseTimeStr = context.get('lastResponseTime');\nconst payloadJson = context.get('lastResponseBody');\nif (!payloadJson) {\n    throw new Error("Missing response payload!");\n}\nconst response = JSON.parse(payloadJson);\nprint("Verifying response for user: " + response.username);\nconst duration = parseInt(responseTimeStr || "0");\ncontext.put("generatedUserEmail", response.username.toLowerCase() + "@domain.com");`)}
                      className="absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold bg-background hover:bg-secondary border border-border text-foreground rounded transition-colors cursor-pointer"
                    >
                      {copiedId === 'complex_script' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                      <span>{copiedId === 'complex_script' ? 'Copied' : 'Copy Code'}</span>
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* JS limitations checklist */}
            <div className="space-y-6">
              <Card className="border border-border/40 bg-secondary/15 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                    <ShieldAlert className="h-4.5 w-4.5 text-primary" />
                    Sandbox Restrictions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3.5 text-xs text-muted-foreground leading-relaxed">
                  <p>
                    Scripts run in a restricted execution framework to maintain portal stability.
                  </p>
                  <ul className="list-disc pl-4 space-y-2">
                    <li>
                      <strong className="text-foreground">No Networking:</strong> Scripts cannot issue direct network calls. Utilize <code>HTTP_REQUEST</code> or <code>SOAP_REQUEST</code> nodes instead.
                    </li>
                    <li>
                      <strong className="text-foreground">No File System Access:</strong> Read/write permissions to underlying server disks are blocked.
                    </li>
                    <li>
                      <strong className="text-foreground">Timeout Thresholds:</strong> Script execution is automatically halted if processing extends beyond 10 seconds.
                    </li>
                    <li>
                      <strong className="text-foreground">Object Safety:</strong> Access to Java classes, JVM descriptors, reflection APIs, or process hooks is disabled.
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── TAB CONTENT: ADVANCED GUIDES ─────────────────────────────────── */}
        <TabsContent value="advanced" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* OAuth 2.0 Token Chaining */}
            <Card className="border border-border/40 bg-card/25 backdrop-blur-sm shadow-md">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-cyan-400" />
                  OAuth 2.0 Token Chaining & Dynamic Auth
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3.5 text-sm text-muted-foreground leading-relaxed">
                <p>
                  ORION allows you to request OAuth 2.0 access tokens dynamically using the <code>AUTH_TOKEN</code> step and pass them to downstream API requests seamlessly.
                </p>
                <div className="space-y-2">
                  <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">Step-by-Step Chaining Guide:</h4>
                  <ol className="list-decimal pl-5 space-y-1.5 text-xs">
                    <li>
                      Add a **Generate Auth Token** (<code>AUTH_TOKEN</code>) step at the start of your workflow sequence.
                    </li>
                    <li>
                      Set <strong>Auth Type</strong> to <code>OAUTH2_CLIENT_CREDENTIALS</code> or <code>OAUTH2_PASSWORD</code>.
                    </li>
                    <li>
                      Provide your token endpoint URL, Client ID, Client Secret, and optional scope.
                    </li>
                    <li>
                      Set <strong>Target Variable</strong> to <code>authToken</code> (or leave empty to default to <code>authToken</code>).
                    </li>
                    <li>
                      In subsequent <code>HTTP_REQUEST</code>, <code>GRAPHQL_REQUEST</code>, or <code>SOAP_REQUEST</code> steps, add a header:
                      <br />
                      <code className="text-foreground font-mono text-[11px] bg-secondary/40 p-1 rounded mt-1 inline-block">Authorization: {"{{authToken}}"}</code>
                    </li>
                  </ol>
                </div>
                <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg flex items-start gap-2 text-xs">
                  <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                  <p>OAuth tokens are automatically stored in context with the <code>Bearer </code> prefix, ready to insert into the Authorization header directly.</p>
                </div>
              </CardContent>
            </Card>

            {/* Skip SSL Verification & Enterprise Proxy */}
            <Card className="border border-border/40 bg-card/25 backdrop-blur-sm shadow-md">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Shield className="h-5 w-5 text-emerald-400" />
                  SSL Verification & Corporate Proxy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3.5 text-sm text-muted-foreground leading-relaxed">
                <p>
                  Testing internal APIs behind enterprise SSL interception proxies (Zscaler, Netskope, Fortinet) or self-signed staging servers often triggers PKIX path validation errors.
                </p>
                <div className="space-y-2">
                  <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">How to resolve PKIX & Proxy errors:</h4>
                  <ul className="list-disc pl-5 space-y-1.5 text-xs">
                    <li>
                      <strong className="text-foreground">Skip SSL Verification:</strong> Navigate to <strong>Admin Settings -&gt; Security</strong> and enable <code>orion.ssl.skip_verification</code>. This allows HTTP, OAuth, SOAP, GraphQL, and Recording Proxy calls to ignore self-signed certificate errors.
                    </li>
                    <li>
                      <strong className="text-foreground">Playwright Codegen CLI:</strong> If running Playwright codegen from terminal, pass the flag: <code>npx playwright codegen --ignore-https-errors &lt;URL&gt;</code>.
                    </li>
                    <li>
                      <strong className="text-foreground">Corporate Proxy Routing:</strong> In <strong>System Settings -&gt; Proxy</strong>, configure your enterprise HTTP or SOCKS5 proxy host, port, credentials, and non-proxy host bypass lists. All outbound executors will automatically tunnel requests through the configured proxy.
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Mutual Authentication mTLS */}
            <Card className="border border-border/40 bg-card/25 backdrop-blur-sm shadow-md">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-primary" />
                  SSL/TLS Mutual Authentication (mTLS)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3.5 text-sm text-muted-foreground leading-relaxed">
                <p>
                  For secure corporate APIs that require validating client identity, ORION supports assigning certificate credentials directly inside environments.
                </p>
                <div className="space-y-2">
                  <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">How to configure mTLS:</h4>
                  <ol className="list-decimal pl-5 space-y-1.5 text-xs">
                    <li>
                      Open your target test Application and slide open the **Environment Configurations Drawer**.
                    </li>
                    <li>
                      Under the SSL/TLS section, upload your client certificate keystore file (supports <code>.p12</code> or <code>.pfx</code> PKCS12 files).
                    </li>
                    <li>
                      Specify the keystore decryption passcode and select the target alias mapping, then save the configuration.
                    </li>
                    <li>
                      Subsequent <code>HTTP_REQUEST</code> or SOAP calls executed inside this environment will automatically present the certificate details to external endpoints.
                    </li>
                  </ol>
                </div>
                <div className="p-3 bg-secondary/35 border border-border/40 rounded-lg flex items-start gap-2 text-xs">
                  <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <p>Keystore decryption parameters are stored as encrypted values in the system's credentials vault.</p>
                </div>
              </CardContent>
            </Card>

            {/* Playwright Code Generator */}
            <Card className="border border-border/40 bg-card/25 backdrop-blur-sm shadow-md">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <PlayCircle className="h-5 w-5 text-primary" />
                  Playwright Automation Generator
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3.5 text-sm text-muted-foreground leading-relaxed">
                <p>
                  To accelerate creating <code>BROWSER_AUTOMATION</code> step definitions, utilize ORION's integrated **Playwright Gen** tool located in the main sidebar.
                </p>
                <div className="space-y-2">
                  <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">Usage Workflow:</h4>
                  <ol className="list-decimal pl-5 space-y-1.5 text-xs">
                    <li>
                      Click **Playwright Gen** in the left navigation sidebar.
                    </li>
                    <li>
                      Provide the base URL of the website you want to test and select **Launch Recorder**.
                    </li>
                    <li>
                      An interactive browser proxy will load. Perform actions on the screen (type fields, click links, assert element visible).
                    </li>
                    <li>
                      The generator maps your actions into standard ORION JSON actions in real time.
                    </li>
                    <li>
                      When complete, click **Export actions**, and drop the generated actions array directly into your Browser Automation step configs.
                    </li>
                  </ol>
                </div>
              </CardContent>
            </Card>

            {/* Database connection pool details */}
            <Card className="border border-border/40 bg-card/25 backdrop-blur-sm shadow-md">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  JDBC Connection Profiles
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3.5 text-sm text-muted-foreground leading-relaxed">
                <p>
                  JDBC databases are mapped environment-wide, allowing you to alternate query contexts between Staging and Production databases seamlessly.
                </p>
                <div className="space-y-2">
                  <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">Supported Drivers & URLs:</h4>
                  <ul className="list-disc pl-5 space-y-1.5 text-xs font-mono text-muted-foreground">
                    <li>
                      <strong className="text-foreground font-sans">PostgreSQL:</strong> <code>jdbc:postgresql://host:5432/dbname</code>
                    </li>
                    <li>
                      <strong className="text-foreground font-sans">MySQL / MariaDB:</strong> <code>jdbc:mysql://host:3306/dbname</code>
                    </li>
                    <li>
                      <strong className="text-foreground font-sans">Oracle DB:</strong> <code>jdbc:oracle:thin:@host:1521:SID</code>
                    </li>
                    <li>
                      <strong className="text-foreground font-sans">Microsoft SQL Server:</strong> <code>jdbc:sqlserver://host:1433;databaseName=dbname</code>
                    </li>
                    <li>
                      <strong className="text-foreground font-sans">SQLite:</strong> <code>jdbc:sqlite:./data.db</code>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* DB Validator tool */}
            <Card className="border border-border/40 bg-card/25 backdrop-blur-sm shadow-md">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  Database Query Validator Drawer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3.5 text-sm text-muted-foreground leading-relaxed">
                <p>
                  To verify your sql query strings parse correctly before adding them to workflows, use the **DB Validator** tool in the sidebar.
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-xs">
                  <li>Select the Environment and JDBC connection key.</li>
                  <li>Write your SQL query in the console.</li>
                  <li>Click **Execute Check** to test the connection and review syntax errors.</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── TAB CONTENT: OPENAPI SPECS ───────────────────────────────────── */}
        <TabsContent value="openapi" className="space-y-6 mt-0">
          {/* Top Banner */}
          <Card className="border border-cyan-500/30 bg-cyan-500/5 backdrop-blur-sm shadow-md">
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-cyan-400">
                    <FileCode className="h-5 w-5 text-cyan-400" />
                    ORION OpenAPI 3.0.3 Specification
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-1">
                    Complete REST API specification covering 40+ endpoints for Authentication, Users, Workspaces, Workflows, Executions, and Admin settings.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleCopy('yaml-full', openApiYamlString)}
                    className="h-8 text-xs border-cyan-500/30 hover:bg-cyan-500/10 text-cyan-300"
                  >
                    {copiedId === 'yaml-full' ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                    {copiedId === 'yaml-full' ? 'Copied YAML' : 'Copy YAML'}
                  </Button>
                  <Button 
                    variant="primary" 
                    size="sm" 
                    onClick={handleDownloadYaml}
                    className="h-8 text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-medium"
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Download openapi.yaml
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 text-xs">
              <div className="flex flex-wrap items-center gap-4 text-muted-foreground border-t border-cyan-500/20 pt-3">
                <div className="flex items-center gap-1.5">
                  <Server className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Backend Endpoint:</span>
                  <a 
                    href="/api/openapi.yaml" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="font-mono text-cyan-300 hover:underline flex items-center gap-1 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/30"
                  >
                    /api/openapi.yaml <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-[10px]">OpenAPI 3.0.3</Badge>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">{apiEndpointsData.length} Endpoints</Badge>
                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-[10px]">YAML Format</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sub Navigation Bar */}
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div className="flex items-center space-x-2">
              <Button
                variant={openApiSubTab === 'explorer' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setOpenApiSubTab('explorer')}
                className="h-8 text-xs font-semibold"
              >
                <Globe className="h-3.5 w-3.5 mr-1.5" />
                Interactive API Explorer
              </Button>
              <Button
                variant={openApiSubTab === 'yaml' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setOpenApiSubTab('yaml')}
                className="h-8 text-xs font-semibold"
              >
                <Code className="h-3.5 w-3.5 mr-1.5" />
                Raw OpenAPI YAML Code
              </Button>
            </div>
            <span className="text-xs text-muted-foreground hidden md:inline">
              Showing {filteredApiEndpoints.length} of {apiEndpointsData.length} endpoints
            </span>
          </div>

          {openApiSubTab === 'explorer' && (
            <div className="space-y-4">
              {/* Filters Bar */}
              <div className="p-3 bg-secondary/25 border border-border/40 rounded-xl space-y-3">
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Filter endpoints by path or description..."
                      value={apiSearch}
                      onChange={(e) => setApiSearch(e.target.value)}
                      className="w-full h-8 pl-8 pr-3 bg-background border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  {/* Method Filters */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase mr-1">Method:</span>
                    {['ALL', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(method => (
                      <button
                        key={method}
                        onClick={() => setApiMethodFilter(method)}
                        className={`px-2 py-1 rounded text-[11px] font-mono font-bold transition-colors ${
                          apiMethodFilter === method 
                            ? 'bg-primary text-primary-foreground shadow-sm' 
                            : 'bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category Tags Filter */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-border/20">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase mr-1 flex items-center gap-1">
                    <Filter className="h-3 w-3" /> Category:
                  </span>
                  {uniqueTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setApiTagFilter(tag)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                        apiTagFilter === tag
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'bg-secondary/40 text-muted-foreground border border-border/30 hover:bg-secondary hover:text-foreground'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Endpoints List */}
              <div className="grid grid-cols-1 gap-2.5">
                {filteredApiEndpoints.map((ep, idx) => {
                  const methodColor = 
                    ep.method === 'GET' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                    ep.method === 'POST' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                    ep.method === 'PUT' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                    ep.method === 'DELETE' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                    'bg-purple-500/10 text-purple-400 border-purple-500/30';

                  return (
                    <Card key={idx} className="border border-border/40 bg-card/20 hover:bg-card/40 transition-all">
                      <CardContent className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`px-2.5 py-1 rounded text-xs font-mono font-extrabold border ${methodColor}`}>
                            {ep.method}
                          </span>
                          <span className="font-mono text-xs text-foreground font-semibold truncate">
                            {ep.path}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground mr-2 hidden lg:inline">
                            {ep.summary}
                          </span>
                          <Badge variant="outline" className="text-[10px] bg-secondary/40 border-border/40 text-muted-foreground">
                            {ep.tag}
                          </Badge>
                          {ep.secured ? (
                            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20 flex items-center gap-1">
                              <Lock className="h-2.5 w-2.5" /> JWT Auth
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                              Public
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {filteredApiEndpoints.length === 0 && (
                  <div className="text-center py-12 border border-dashed border-border/40 rounded-xl">
                    <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm font-semibold text-foreground">No matching endpoints found</p>
                    <p className="text-xs text-muted-foreground mt-1">Try broadening your search query or reset method/category filters.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {openApiSubTab === 'yaml' && (
            <Card className="border border-border/40 bg-slate-950/80 backdrop-blur-sm shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/30">
                <div className="flex items-center space-x-2">
                  <FileCode className="h-4 w-4 text-cyan-400" />
                  <CardTitle className="text-xs font-mono text-cyan-300">openapi.yaml</CardTitle>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleCopy('yaml-raw', openApiYamlString)}
                  className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  {copiedId === 'yaml-raw' ? <Check className="h-3 w-3 mr-1 text-emerald-400" /> : <Copy className="h-3 w-3 mr-1" />}
                  {copiedId === 'yaml-raw' ? 'Copied' : 'Copy'}
                </Button>
              </CardHeader>
              <CardContent className="p-4 overflow-x-auto max-h-[650px]">
                <pre className="font-mono text-[11px] leading-relaxed text-cyan-100/90 whitespace-pre">
                  {openApiYamlString}
                </pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HelpPage;
