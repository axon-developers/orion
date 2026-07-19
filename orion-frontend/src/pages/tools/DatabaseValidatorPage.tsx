import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { useSystemSettingsStore } from '../../stores/system-settings-store';
import { 
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Button, Select, Badge
} from '../../components/ui';
import { 
  Database, Play, CheckCircle2, XCircle, Code2, Table2, 
  Copy, Sparkles, AlertCircle, RefreshCw, HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { ApplicationDto, EnvironmentDto, DatabaseConnectionDto, PagedResponse } from '../../types/api';

export const DatabaseValidatorPage: React.FC = () => {
  const { getSetting } = useSystemSettingsStore();
  const isDbValidatorEnabled = getSetting('tools.db_query_validator.enabled', 'true') === 'true';

  // Dropdown States
  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [selectedEnvId, setSelectedEnvId] = useState<string>('');
  const [selectedDbId, setSelectedDbId] = useState<string>('');

  // Query state
  const [queryText, setQueryText] = useState<string>('SELECT * FROM users LIMIT 10;');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [resultTab, setResultTab] = useState<'table' | 'json'>('table');

  // Execution Results State
  const [executionResult, setExecutionResult] = useState<{
    success: boolean;
    message?: string;
    columns: string[];
    rows: any[];
    rowCount: number;
    query: string;
  } | null>(null);

  // Fetch Applications list
  const { data: appsData, isLoading: appsLoading } = useQuery<PagedResponse<ApplicationDto>>({
    queryKey: ['tools-applications'],
    queryFn: async () => {
      const res = await api.get('/applications?page=0&size=100');
      return res.data;
    },
    enabled: isDbValidatorEnabled
  });

  const apps = appsData?.content || [];

  // Fetch Environments for selected application
  const { data: envs = [], isLoading: envsLoading } = useQuery<EnvironmentDto[]>({
    queryKey: ['tools-environments', selectedAppId],
    queryFn: async () => {
      if (!selectedAppId) return [];
      const res = await api.get(`/applications/${selectedAppId}/environments`);
      return res.data;
    },
    enabled: !!selectedAppId && isDbValidatorEnabled
  });

  // Automatically select first app if available
  useEffect(() => {
    if (apps.length > 0 && !selectedAppId) {
      setSelectedAppId(apps[0].id);
    }
  }, [apps, selectedAppId]);

  // Automatically select first environment if available
  useEffect(() => {
    if (envs.length > 0) {
      setSelectedEnvId(envs[0].id);
    } else {
      setSelectedEnvId('');
      setSelectedDbId('');
    }
  }, [envs]);

  // Resolve active environment & databases
  const activeEnv = envs.find(e => e.id === selectedEnvId);
  const activeDbs = activeEnv?.databases || [];

  // Automatically select first database connection if available
  useEffect(() => {
    if (activeDbs.length > 0) {
      setSelectedDbId(activeDbs[0].id);
    } else {
      setSelectedDbId('');
    }
  }, [activeDbs]);

  // SQL Formatting Utility
  const handleFormatSQL = () => {
    if (!queryText.trim()) return;

    const newlineKeywords = [
      'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN', 'LEFT JOIN', 
      'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'GROUP BY', 
      'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'WITH'
    ];
    
    let formatted = queryText
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();

    // Uppercase key SQL commands
    const allKeywords = [...newlineKeywords, 'INSERT', 'UPDATE', 'DELETE', 'SET', 'INTO', 'VALUES', 'AS', 'ON', 'IN', 'IS', 'NULL', 'LIKE', 'EXISTS', 'NOT', 'PRAGMA', 'SHOW', 'DESCRIBE', 'EXPLAIN'];
    allKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      formatted = formatted.replace(regex, keyword);
    });

    // Break lines before major keywords
    newlineKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      formatted = formatted.replace(regex, `\n${keyword}`);
    });

    // Indent sub-clauses
    const lines = formatted.split('\n');
    const indentedLines = lines.map((line, idx) => {
      line = line.trim();
      if (idx === 0) return line;
      if (!newlineKeywords.some(keyword => line.startsWith(keyword))) {
        return '  ' + line;
      }
      return line;
    });

    setQueryText(indentedLines.join('\n').trim());
    toast.success('SQL Formatted');
  };

  // Run Query
  const handleExecuteQuery = async () => {
    if (!selectedEnvId || !selectedDbId) {
      toast.error('Please select both environment and database connection.');
      return;
    }
    if (!queryText.trim()) {
      toast.error('Please enter a query.');
      return;
    }

    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const res = await api.post('/tools/db-validator/query', {
        envId: selectedEnvId,
        databaseId: selectedDbId,
        query: queryText
      });
      setExecutionResult(res.data);
      toast.success('Query executed successfully');
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || 'Execution failed';
      setExecutionResult({
        success: false,
        message: errMsg,
        columns: [],
        rows: [],
        rowCount: 0,
        query: queryText
      });
      toast.error(errMsg);
    } finally {
      setIsExecuting(false);
    }
  };

  // Copy JSON Results helper
  const handleCopyJSON = () => {
    if (!executionResult || !executionResult.rows) return;
    navigator.clipboard.writeText(JSON.stringify(executionResult.rows, null, 2));
    toast.success('JSON results copied to clipboard');
  };

  // Render Access Denied
  if (!isDbValidatorEnabled) {
    return (
      <div className="flex flex-col items-center justify-center py-24 select-none animate-in fade-in duration-300">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-bold text-foreground">Access Denied</h2>
        <p className="text-muted-foreground mt-2 text-sm max-w-md text-center">
          The Database Query Validator tool is currently disabled by the administrator. Please contact your admin to enable it.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
          <Database className="h-7 w-7 text-primary" />
          Database Query Validator
        </h1>
        <p className="text-muted-foreground mt-1">
          Validate and test read-only queries against configured database connections
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left selector and controls panel */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border border-border/50 bg-card/25 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-400">Connection Options</CardTitle>
              <CardDescription>Select the target database</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Select Application */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground">Application</label>
                {appsLoading ? (
                  <div className="h-9 w-full bg-secondary/20 animate-pulse rounded border border-border/30" />
                ) : (
                  <Select
                    value={selectedAppId}
                    onChange={(e) => setSelectedAppId(e.target.value)}
                    options={apps.map(app => ({
                      value: app.id,
                      label: app.appName || app.name
                    }))}
                  />
                )}
              </div>

              {/* Select Environment */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground">Environment</label>
                {envsLoading ? (
                  <div className="h-9 w-full bg-secondary/20 animate-pulse rounded border border-border/30" />
                ) : (
                  <Select
                    value={selectedEnvId}
                    onChange={(e) => setSelectedEnvId(e.target.value)}
                    options={[
                      { value: '', label: envs.length === 0 ? 'No environments available' : 'Select environment...' },
                      ...envs.map(env => ({
                        value: env.id,
                        label: env.name
                      }))
                    ]}
                    disabled={!selectedAppId || envs.length === 0}
                  />
                )}
              </div>

              {/* Select Database */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground">Database Connection</label>
                <Select
                  value={selectedDbId}
                  onChange={(e) => setSelectedDbId(e.target.value)}
                  options={[
                    { value: '', label: activeDbs.length === 0 ? 'No databases available' : 'Select database...' },
                    ...activeDbs.map(db => ({
                      value: db.id,
                      label: `${db.name} (${db.type})`
                    }))
                  ]}
                  disabled={!selectedEnvId || activeDbs.length === 0}
                />
                {!selectedEnvId ? (
                  <p className="text-[10px] text-muted-foreground">Select an environment first.</p>
                ) : activeDbs.length === 0 ? (
                  <p className="text-[10px] text-amber-500 font-medium">No database connections found in this environment.</p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/50 bg-card/25 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <HelpCircle className="h-4 w-4 text-primary" />
                SQL Guardrails
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5 text-xs text-muted-foreground leading-relaxed">
              <p>
                To safeguard environment data integrity, queries are run in a **strict read-only environment**.
              </p>
              <ul className="list-disc pl-4 space-y-1 text-[11px]">
                <li>Only commands starting with <code className="text-primary font-mono font-bold">SELECT</code>, <code className="text-primary font-mono font-bold">WITH</code>, <code className="text-primary font-mono font-bold">SHOW</code>, <code className="text-primary font-mono font-bold">EXPLAIN</code> or <code className="text-primary font-mono font-bold">PRAGMA</code> are allowed.</li>
                <li>Modifications (<code className="text-red-400 font-mono font-bold">INSERT</code>, <code className="text-red-400 font-mono font-bold">UPDATE</code>, <code className="text-red-400 font-mono font-bold">DELETE</code>, <code className="text-red-400 font-mono font-bold">DROP</code>, etc.) are blocked at the gateway.</li>
                <li>Results are automatically capped at a maximum of **200 rows** to maintain performance.</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Right editor panel */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border border-border/50 bg-card/25 backdrop-blur-sm flex flex-col overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/30">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-400">SQL Query Editor</CardTitle>
                  <CardDescription>Compose your read-only database query</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleFormatSQL}
                    className="h-8 text-xs font-semibold px-3 group"
                    disabled={!queryText.trim()}
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1 text-primary group-hover:rotate-12 transition-transform" />
                    Format
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleExecuteQuery}
                    className="h-8 text-xs font-semibold px-4 cursor-pointer"
                    disabled={isExecuting || !selectedDbId}
                  >
                    {isExecuting ? (
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
                    )}
                    Run Query
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <textarea
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="-- Write your SQL query here&#10;SELECT * FROM users LIMIT 10;"
                className="w-full min-h-[220px] p-5 font-mono text-sm bg-slate-950/65 text-slate-100 border-0 focus:ring-0 focus:outline-none resize-y placeholder:text-slate-600 leading-relaxed"
                spellCheck="false"
              />
            </CardContent>
          </Card>

          {/* Results Block */}
          {executionResult && (
            <Card className="border border-border/50 bg-card/25 backdrop-blur-sm animate-in fade-in duration-300">
              <CardHeader className="pb-3 border-b border-border/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-2">
                  {executionResult.success ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive shrink-0" />
                  )}
                  <div>
                    <CardTitle className="text-sm font-bold">
                      {executionResult.success ? 'Query Succeeded' : 'Query Failed'}
                    </CardTitle>
                    <CardDescription className="text-[11px]">
                      {executionResult.success 
                        ? `Returned ${executionResult.rowCount} rows` 
                        : 'Review database logs or query syntax'}
                    </CardDescription>
                  </div>
                </div>

                {executionResult.success && (
                  <div className="flex items-center bg-secondary/35 p-0.5 rounded border border-border/40 shrink-0">
                    <button
                      onClick={() => setResultTab('table')}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-all cursor-pointer ${resultTab === 'table' ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <Table2 className="h-3.5 w-3.5" />
                      <span>Table View</span>
                    </button>
                    <button
                      onClick={() => setResultTab('json')}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-all cursor-pointer ${resultTab === 'json' ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <Code2 className="h-3.5 w-3.5" />
                      <span>JSON View</span>
                    </button>
                  </div>
                )}
              </CardHeader>
              
              <CardContent className="p-0">
                {executionResult.success ? (
                  resultTab === 'table' ? (
                    executionResult.rows.length > 0 ? (
                      <div className="overflow-x-auto max-h-[380px]">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-border bg-secondary/15 select-none font-bold text-slate-300">
                              {executionResult.columns.map(col => (
                                <th key={col} className="p-3 border-r border-border/10 last:border-0">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {executionResult.rows.map((row, idx) => (
                              <tr 
                                key={idx} 
                                className="border-b border-border/20 last:border-0 hover:bg-secondary/10 transition-colors text-slate-200"
                              >
                                {executionResult.columns.map(col => {
                                  const val = row[col];
                                  return (
                                    <td 
                                      key={col} 
                                      className="p-3 font-mono border-r border-border/10 last:border-0 max-w-[200px] truncate"
                                      title={val !== null && val !== undefined ? String(val) : 'NULL'}
                                    >
                                      {val === null || val === undefined ? (
                                        <span className="text-slate-500 italic">NULL</span>
                                      ) : (
                                        String(val)
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-8 text-center text-muted-foreground text-xs">
                        <CheckCircle2 className="h-8 w-8 text-emerald-500/60 mx-auto mb-2" />
                        Query executed successfully, but returned no rows.
                      </div>
                    )
                  ) : (
                    <div className="relative group">
                      <button
                        onClick={handleCopyJSON}
                        className="absolute right-4 top-4 p-2 bg-slate-900 border border-border/40 hover:border-primary/45 rounded-lg text-slate-400 hover:text-foreground cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Copy JSON"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <pre className="p-5 font-mono text-xs text-emerald-400 bg-slate-950/75 overflow-auto max-h-[380px] leading-relaxed">
                        {JSON.stringify(executionResult.rows, null, 2)}
                      </pre>
                    </div>
                  )
                ) : (
                  <div className="p-5 bg-destructive/5 text-destructive flex items-start space-x-3 text-xs border-t border-border/30">
                    <XCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
                    <div className="font-mono whitespace-pre-wrap leading-relaxed">
                      {executionResult.message || 'An unknown error occurred during database query execution.'}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default DatabaseValidatorPage;
