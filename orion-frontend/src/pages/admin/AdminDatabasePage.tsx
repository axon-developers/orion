import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { 
  Card, CardHeader, CardTitle, CardDescription, CardContent, 
  Button, Input, Textarea, Badge
} from '../../components/ui';
import { 
  Database, Play, RefreshCw, Table2, Search, Info, 
  Download, Copy, Check, Terminal, AlertTriangle, AlertCircle, ListCollapse
} from 'lucide-react';
import { toast } from 'sonner';

interface ColumnMeta {
  columnName: string;
  dataType: string;
  columnSize: number;
  nullable: boolean;
}

interface TableSchema {
  tableName: string;
  columns: ColumnMeta[];
}

interface QueryResponse {
  success: boolean;
  message: string;
  columns?: string[];
  rows?: Record<string, any>[];
  rowCount?: number;
  affectedRows?: number;
}

export const AdminDatabasePage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM executions LIMIT 50;');
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // List of tables query
  const { data: tables = [], isLoading: isTablesLoading, refetch: refetchTables } = useQuery<string[]>({
    queryKey: ['admin-db-tables'],
    queryFn: async () => {
      const res = await api.get('/admin/database/tables');
      return res.data;
    }
  });

  // Table Schema query
  const { data: schema, isLoading: isSchemaLoading } = useQuery<TableSchema>({
    queryKey: ['admin-db-schema', selectedTable],
    queryFn: async () => {
      const res = await api.get(`/admin/database/tables/${selectedTable}/schema`);
      return res.data;
    },
    enabled: !!selectedTable
  });

  // Run Query mutation
  const runQueryMutation = useMutation<QueryResponse, any, string>({
    mutationFn: async (queryText: string) => {
      const res = await api.post('/admin/database/query', { query: queryText });
      return res.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message || "Query executed successfully!");
        // Refresh tables if DDL query ran (e.g. CREATE TABLE or DROP TABLE)
        const upperQuery = sqlQuery.toUpperCase();
        if (upperQuery.includes('CREATE ') || upperQuery.includes('DROP ') || upperQuery.includes('ALTER ')) {
          refetchTables();
        }
      } else {
        toast.error(data.message || "Query returned errors.");
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || "Failed to execute database query.";
      toast.error(msg);
    }
  });

  const handleTableClick = (tableName: string) => {
    setSelectedTable(tableName);
    setSqlQuery(`SELECT * FROM ${tableName} LIMIT 50;`);
  };

  const executeQuery = () => {
    runQueryMutation.mutate(sqlQuery);
  };

  const appendToQuery = (template: string) => {
    if (!selectedTable) {
      toast.info("Select a table from the sidebar to populate template.");
      return;
    }
    const finalSql = template.replace('{TABLE}', selectedTable);
    setSqlQuery(finalSql);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlQuery);
    setCopied(true);
    toast.success('SQL query copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  // Filtered rows client-side search
  const filteredRows = React.useMemo(() => {
    const rows = runQueryMutation.data?.rows;
    if (!rows) return [];
    if (!searchQuery) return rows;

    const lowerSearch = searchQuery.toLowerCase();
    return rows.filter(row => 
      Object.values(row).some(val => 
        val !== null && val !== undefined && String(val).toLowerCase().includes(lowerSearch)
      )
    );
  }, [runQueryMutation.data, searchQuery]);

  const downloadResultsCsv = () => {
    const data = runQueryMutation.data;
    if (!data || !data.rows || data.rows.length === 0 || !data.columns) return;

    const headers = data.columns.join(',');
    const csvContent = data.rows.map(row => 
      data.columns!.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return '';
        // Escape quotes
        const valStr = String(val).replace(/"/g, '""');
        return valStr.includes(',') || valStr.includes('\n') || valStr.includes('"') ? `"${valStr}"` : valStr;
      }).join(',')
    ).join('\n');

    const fullCsv = headers + '\n' + csvContent;
    const blob = new Blob([fullCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${selectedTable || 'orion'}_query_results.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV file downloaded successfully");
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center pb-2 border-b border-border/20">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" /> Orion Database Console
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Admin tool to browse schemas, run queries, and modify internal database schemas and content directly.
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => { refetchTables(); toast.success("Table schema list refreshed!"); }} 
          className="h-8"
        >
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh Schema
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-210px)] min-h-[600px]">
        {/* Left Side: Tables Browser & Schema */}
        <div className="lg:col-span-1 flex flex-col bg-card/20 border border-border/40 rounded-xl overflow-hidden h-full">
          {/* Tables list */}
          <div className="flex-1 flex flex-col min-h-0 border-b border-border/30">
            <div className="p-3 bg-secondary/5 border-b border-border/30 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Database Tables</span>
              <Badge variant="secondary" className="text-[9px] font-mono">{tables.length}</Badge>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
              {isTablesLoading ? (
                <div className="flex items-center justify-center py-12 text-xs text-muted-foreground gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-primary" /> Loading tables...
                </div>
              ) : tables.length === 0 ? (
                <div className="text-center py-12 text-xs text-muted-foreground">No tables found.</div>
              ) : (
                tables.map(table => (
                  <button
                    key={table}
                    onClick={() => handleTableClick(table)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-mono truncate transition-all cursor-pointer ${
                      selectedTable === table 
                        ? 'bg-primary/10 text-primary font-bold border border-primary/20 shadow-inner' 
                        : 'text-foreground/80 hover:bg-secondary/40 hover:text-foreground border border-transparent'
                    }`}
                  >
                    <Table2 className="inline-block h-3.5 w-3.5 mr-2 opacity-60" />
                    {table}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Table Schema metadata */}
          <div className="h-[240px] flex flex-col min-h-0 bg-secondary/5">
            <div className="p-3 border-b border-border/30 flex items-center gap-1.5 shrink-0">
              <Table2 className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                {selectedTable ? `${selectedTable} Schema` : 'Select a Table'}
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
              {!selectedTable ? (
                <p className="text-[11px] text-muted-foreground italic text-center py-12">
                  Select a table to view column constraints and types.
                </p>
              ) : isSchemaLoading ? (
                <div className="flex items-center justify-center py-12 text-[11px] text-muted-foreground gap-2">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" /> Loading metadata...
                </div>
              ) : schema && schema.columns ? (
                <div className="space-y-1.5">
                  {schema.columns.map((col, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[10px] font-mono pb-1 border-b border-border/20 last:border-0">
                      <span className="text-foreground/90 font-semibold" title={col.columnName}>{col.columnName}</span>
                      <span className="text-muted-foreground">
                        {col.dataType.toLowerCase()}({col.columnSize})
                        {!col.nullable && <span className="text-rose-500 font-bold ml-1" title="Not Null">*</span>}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground italic">No schema metadata found.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Query Editor & Results */}
        <div className="lg:col-span-3 flex flex-col gap-4 h-full min-w-0">
          {/* Query Editor Box */}
          <Card className="glass border-border/40 shrink-0 shadow-lg">
            <CardHeader className="py-2.5 px-4 bg-secondary/5 border-b border-border/30 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-primary" />
                <CardTitle className="text-xs uppercase font-extrabold tracking-wider">SQL Query Editor</CardTitle>
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyToClipboard} title="Copy SQL">
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-3 space-y-3">
              <Textarea
                placeholder="Write your SQLite / SQL query here..."
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                className="h-28 font-mono text-xs leading-relaxed bg-[#0d1117]/60 text-[#c9d1d9] border-[#21262d] focus-visible:ring-primary focus-visible:ring-offset-0 focus:border-primary"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Helper templates */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase mr-1">Templates:</span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => appendToQuery('SELECT * FROM {TABLE} LIMIT 50;')} 
                    className="h-7 text-[10px] px-2"
                  >
                    SELECT
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => appendToQuery('INSERT INTO {TABLE} (...) VALUES (...);')} 
                    className="h-7 text-[10px] px-2"
                  >
                    INSERT
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => appendToQuery('UPDATE {TABLE} SET col = val WHERE id = 1;')} 
                    className="h-7 text-[10px] px-2"
                  >
                    UPDATE
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => appendToQuery('DELETE FROM {TABLE} WHERE id = 1;')} 
                    className="h-7 text-[10px] px-2 text-rose-400 hover:text-rose-300"
                  >
                    DELETE
                  </Button>
                </div>

                <Button 
                  onClick={executeQuery} 
                  disabled={runQueryMutation.isPending || !sqlQuery.trim()} 
                  size="sm" 
                  className="font-bold h-8 px-4 cursor-pointer gap-1.5 shadow-md bg-primary text-primary-foreground hover:bg-primary/95"
                >
                  {runQueryMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 fill-current" />
                  )}
                  Run Query
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Query Results Box */}
          <Card className="glass border-border/40 flex-1 min-h-0 flex flex-col shadow-lg overflow-hidden">
            <CardHeader className="py-2.5 px-4 bg-secondary/5 border-b border-border/30 flex flex-row items-center justify-between space-y-0 shrink-0">
              <span className="text-xs uppercase font-extrabold tracking-wider text-muted-foreground">Execution Output Console</span>
              
              {runQueryMutation.data?.success && runQueryMutation.data.rows && runQueryMutation.data.rows.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="relative w-44">
                    <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search output rows..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-7 pl-7 text-[11px] bg-background/20 border-border/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={downloadResultsCsv}
                    className="h-7 text-[10px] px-2 cursor-pointer"
                  >
                    <Download className="mr-1 h-3.5 w-3.5 text-cyan-400" /> Export CSV
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-4 flex-1 min-h-0 overflow-y-auto scrollbar-thin">
              {/* Idle state */}
              {runQueryMutation.isIdle && (
                <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground">
                  <Terminal className="h-10 w-10 text-muted-foreground/30 mb-2" />
                  <p className="text-xs">Console is idle. Write an SQL statement above and click "Run Query".</p>
                  <p className="text-[10px] text-muted-foreground/75 mt-1 font-mono">SQLite engine supports standard SELECT, INSERT, UPDATE, DELETE, CREATE, DROP.</p>
                </div>
              )}

              {/* Running State */}
              {runQueryMutation.isPending && (
                <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground">
                  <RefreshCw className="h-10 w-10 text-primary animate-spin mb-3" />
                  <p className="text-xs font-semibold">Executing statement against Orion active datasource...</p>
                </div>
              )}

              {/* Execution results */}
              {runQueryMutation.isSuccess && (
                <div className="h-full flex flex-col space-y-3">
                  {/* Status Banner */}
                  {runQueryMutation.data.success ? (
                    <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-400">
                      <Check className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Success</p>
                        <p className="text-[10px] opacity-80 leading-snug">{runQueryMutation.data.message}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2.5 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-400">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">SQL Execution Failed</p>
                        <p className="font-mono text-[10px] opacity-90 leading-relaxed whitespace-pre-wrap">{runQueryMutation.data.message}</p>
                      </div>
                    </div>
                  )}

                  {/* Results Data Grid */}
                  {runQueryMutation.data.success && runQueryMutation.data.rows && (
                    <div className="flex-1 min-h-0 flex flex-col">
                      {filteredRows.length === 0 ? (
                        <div className="text-center py-12 text-xs text-muted-foreground border border-dashed border-border/40 rounded-lg">
                          No matching records found. {runQueryMutation.data.rows.length > 0 && "(Search query excluded all rows)"}
                        </div>
                      ) : (
                        <div className="flex-1 min-h-0 overflow-auto border border-border/40 rounded-lg scrollbar-thin">
                          <table className="w-full text-[11px] border-collapse font-sans">
                            <thead>
                              <tr className="border-b border-border bg-secondary/35 text-left text-muted-foreground font-semibold sticky top-0 backdrop-blur z-10">
                                {runQueryMutation.data.columns?.map((col) => (
                                  <th key={col} className="p-2.5 border-r border-border last:border-r-0 tracking-wider text-[10px] whitespace-nowrap bg-secondary/20">
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {filteredRows.map((row, rIdx) => (
                                <tr key={rIdx} className={`border-b border-border/20 last:border-b-0 hover:bg-secondary/15 ${rIdx % 2 === 0 ? 'bg-background/40' : 'bg-secondary/5'}`}>
                                  {runQueryMutation.data.columns?.map((col, cIdx) => {
                                    const val = row[col];
                                    return (
                                      <td key={cIdx} className="p-2.5 border-r border-border/20 last:border-r-0 truncate max-w-xs text-foreground/90 font-mono" title={val === null ? 'NULL' : String(val)}>
                                        {val === null || val === undefined ? (
                                          <span className="text-muted-foreground italic">NULL</span>
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
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDatabasePage;
