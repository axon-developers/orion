import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../../lib/api';
import { 
  Card, CardHeader, CardTitle, CardContent, 
  Button, Input, Textarea, Badge,
  Dialog, DialogHeader, DialogTitle, DialogFooter
} from '../../components/ui';
import { 
  Database, Play, RefreshCw, Table2, Search, 
  Download, Copy, Check, Terminal, AlertCircle, Key
} from 'lucide-react';
import { toast } from 'sonner';

interface TableMeta {
  tableName: string;
  rowCount: number;
}

interface ColumnMeta {
  columnName: string;
  dataType: string;
  columnSize: number;
  nullable: boolean;
  primaryKey: boolean;
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
  executionTimeMs?: number;
}

export const AdminDatabasePage: React.FC = () => {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM executions LIMIT 50;');
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selection & Edit States
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    row: Record<string, any>;
    rowIndex: number;
  } | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<Record<string, any> | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, any>>({});

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Local Storage Query History
  const [history, setHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('orion_sql_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // List of tables query
  const { data: tables = [], isLoading: isTablesLoading, refetch: refetchTables } = useQuery<TableMeta[]>({
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

  // Primary Key Resolver
  const resolvedPkColumn = useMemo(() => {
    const pkCol = schema?.columns?.find(c => c.primaryKey)?.columnName;
    if (pkCol) return pkCol;
    if (!schema?.columns) return null;
    const colNames = schema.columns.map(c => c.columnName.toLowerCase());
    if (colNames.includes('id')) {
      const idx = colNames.indexOf('id');
      return schema.columns[idx].columnName;
    }
    return null;
  }, [schema]);

  // Run Query mutation
  const runQueryMutation = useMutation<QueryResponse, any, string>({
    mutationFn: async (queryText: string) => {
      const res = await api.post('/admin/database/query', { query: queryText });
      return res.data;
    },
    onSuccess: (data, queryText) => {
      if (data.success) {
        toast.success(data.message || "Query executed successfully!");
        
        // Add to history if DDL or select
        setHistory(prev => {
          const next = [queryText, ...prev.filter(q => q !== queryText)].slice(0, 15);
          localStorage.setItem('orion_sql_history', JSON.stringify(next));
          return next;
        });

        // Refresh tables if DDL/DML query ran
        const upperQuery = queryText.toUpperCase();
        if (
          upperQuery.includes('CREATE ') || 
          upperQuery.includes('DROP ') || 
          upperQuery.includes('ALTER ') || 
          upperQuery.includes('INSERT ') || 
          upperQuery.includes('DELETE ')
        ) {
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

  // Reset pagination and selection on new query data
  useEffect(() => {
    setCurrentPage(1);
    setSelectedRowIndex(null);
  }, [runQueryMutation.data]);

  // Close context menu on external window clicks
  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

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
  const filteredRows = useMemo(() => {
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

  // Paginated Rows
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredRows.slice(startIndex, startIndex + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const downloadResultsCsv = () => {
    const data = runQueryMutation.data;
    if (!data || !data.rows || data.rows.length === 0 || !data.columns) return;

    const headers = data.columns.join(',');
    const csvContent = data.rows.map(row => 
      data.columns!.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return '';
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

  // Context Menu handlers
  const handleRowContextMenu = (e: React.MouseEvent, row: Record<string, any>, rowIndex: number) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      row,
      rowIndex
    });
  };

  const handleOpenEditRowDialog = (row: Record<string, any>) => {
    setEditingRow(row);
    
    // Normalize keys in row to match schema column name casing case-insensitively
    const normalizedRow: Record<string, any> = {};
    if (schema?.columns) {
      schema.columns.forEach(col => {
        const matchingKey = Object.keys(row).find(
          k => k.toLowerCase() === col.columnName.toLowerCase()
        );
        if (matchingKey !== undefined) {
          normalizedRow[col.columnName] = row[matchingKey];
        } else {
          normalizedRow[col.columnName] = null;
        }
      });
    } else {
      Object.assign(normalizedRow, row);
    }
    
    setEditFormData(normalizedRow);
    setIsEditModalOpen(true);
  };

  const handleDeleteRow = (row: Record<string, any>) => {
    if (!selectedTable) {
      toast.error("No table selected to run DELETE operation");
      return;
    }
    const pkCol = resolvedPkColumn;
    if (!pkCol) {
      toast.error("Cannot delete: No primary key (or 'id' column) identified for this table schema.");
      return;
    }
    const matchingKey = Object.keys(row).find(k => k.toLowerCase() === pkCol.toLowerCase());
    const pkValue = matchingKey !== undefined ? row[matchingKey] : null;
    if (pkValue === undefined || pkValue === null) {
      toast.error(`Primary key value for column '${pkCol}' is null or undefined.`);
      return;
    }

    const formattedVal = typeof pkValue === 'number' ? pkValue : `'${String(pkValue).replace(/'/g, "''")}'`;
    const deleteSql = `DELETE FROM ${selectedTable} WHERE ${pkCol} = ${formattedVal};`;

    if (window.confirm(`Are you sure you want to delete this row from '${selectedTable}'?\n\nQuery: ${deleteSql}`)) {
      runQueryMutation.mutate(deleteSql, {
        onSuccess: (data) => {
          if (data.success) {
            executeQuery();
          }
        }
      });
    }
  };

  const handleSaveChanges = () => {
    if (!selectedTable || !editingRow) return;
    const pkCol = resolvedPkColumn;
    if (!pkCol) {
      toast.error("Cannot update: No primary key (or 'id' column) identified for this table schema.");
      return;
    }
    
    const matchingPkKey = Object.keys(editingRow).find(k => k.toLowerCase() === pkCol.toLowerCase()) || pkCol;
    const pkValue = editingRow[matchingPkKey];
    if (pkValue === undefined || pkValue === null) {
      toast.error(`Primary key value is missing.`);
      return;
    }

    const updates: string[] = [];
    schema?.columns?.forEach((col) => {
      const colName = col.columnName;
      if (colName.toLowerCase() === pkCol.toLowerCase()) return;

      const newVal = editFormData[colName];
      
      const matchingKey = Object.keys(editingRow).find(k => k.toLowerCase() === colName.toLowerCase());
      const oldVal = matchingKey !== undefined ? editingRow[matchingKey] : null;

      if (newVal !== oldVal) {
        if (newVal === null || newVal === undefined || newVal === '') {
          updates.push(`${colName} = NULL`);
        } else {
          const isNum = typeof oldVal === 'number' || (!isNaN(Number(newVal)) && newVal.trim() !== '');
          const formattedVal = isNum ? newVal : `'${String(newVal).replace(/'/g, "''")}'`;
          updates.push(`${colName} = ${formattedVal}`);
        }
      }
    });

    if (updates.length === 0) {
      toast.info("No modifications detected.");
      setIsEditModalOpen(false);
      return;
    }

    const formattedPkVal = typeof pkValue === 'number' ? pkValue : `'${String(pkValue).replace(/'/g, "''")}'`;
    const updateSql = `UPDATE ${selectedTable} SET ${updates.join(', ')} WHERE ${pkCol} = ${formattedPkVal};`;

    runQueryMutation.mutate(updateSql, {
      onSuccess: (data) => {
        if (data.success) {
          setIsEditModalOpen(false);
          setEditingRow(null);
          executeQuery();
        }
      }
    });
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
                    key={table.tableName}
                    onClick={() => handleTableClick(table.tableName)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-mono truncate transition-all cursor-pointer flex items-center justify-between group ${
                      selectedTable === table.tableName 
                        ? 'bg-primary/10 text-primary font-bold border border-primary/20 shadow-inner' 
                        : 'text-foreground/80 hover:bg-secondary/40 hover:text-foreground border border-transparent'
                    }`}
                  >
                    <span className="truncate flex items-center">
                      <Table2 className="inline-block h-3.5 w-3.5 mr-2 opacity-60 shrink-0" />
                      {table.tableName}
                    </span>
                    <span className="ml-1.5 text-[9px] px-1.5 py-0.25 bg-secondary/50 text-muted-foreground rounded-full group-hover:bg-primary/20 group-hover:text-primary transition-colors shrink-0">
                      {table.rowCount}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Table Schema metadata */}
          <div className="h-[240px] flex flex-col min-h-0 bg-secondary/5">
            <div className="p-3 border-b border-border/30 flex items-center gap-1.5 shrink-0">
              <Table2 className="h-4 w-4 text-primary animate-in" />
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
                      <span className="text-foreground/90 font-semibold flex items-center gap-1" title={col.columnName}>
                        {col.primaryKey && <Key className="h-2.5 w-2.5 text-amber-500 fill-amber-500/20 shrink-0" />}
                        {col.columnName}
                      </span>
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
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Terminal className="h-4 w-4 text-primary shrink-0" />
                <CardTitle className="text-xs uppercase font-extrabold tracking-wider shrink-0">SQL Query Editor</CardTitle>
                
                {history.length > 0 && (
                  <div className="ml-4 max-w-xs shrink-0 flex items-center gap-1.5">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">History:</span>
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          setSqlQuery(e.target.value);
                          e.target.value = "";
                        }
                      }}
                      className="bg-[#0d1117] text-[#c9d1d9] border border-[#21262d] rounded px-2 py-0.5 text-[10px] focus:outline-none cursor-pointer"
                    >
                      <option value="" disabled>Select Previous Query...</option>
                      {history.map((q, idx) => (
                        <option key={idx} value={q}>
                          {q.trim().substring(0, 45)}{q.trim().length > 45 ? '...' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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
                  <p className="text-[10px] text-muted-foreground/75 mt-1 font-mono">Database engine supports standard SELECT, INSERT, UPDATE, DELETE, CREATE, DROP.</p>
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
                    <div className="flex items-start justify-between gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-400">
                      <div className="flex gap-2.5">
                        <Check className="h-4 w-4 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Success</p>
                          <p className="text-[10px] opacity-80 leading-snug">{runQueryMutation.data.message}</p>
                        </div>
                      </div>
                      {runQueryMutation.data.executionTimeMs !== undefined && (
                        <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] px-1.5 py-0.5 select-none shrink-0 font-mono">
                          Duration: {runQueryMutation.data.executionTimeMs}ms
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2.5 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-400">
                      <div className="flex gap-2.5">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">SQL Execution Failed</p>
                          <p className="font-mono text-[10px] opacity-90 leading-relaxed whitespace-pre-wrap">{runQueryMutation.data.message}</p>
                        </div>
                      </div>
                      {runQueryMutation.data.executionTimeMs !== undefined && (
                        <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] px-1.5 py-0.5 select-none shrink-0 font-mono">
                          Duration: {runQueryMutation.data.executionTimeMs}ms
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Results Data Grid */}
                  {runQueryMutation.data.success && runQueryMutation.data.rows && (
                    <div className="flex-1 min-h-0 flex flex-col space-y-3">
                      {filteredRows.length === 0 ? (
                        <div className="text-center py-12 text-xs text-muted-foreground border border-dashed border-border/40 rounded-lg">
                          No matching records found. {runQueryMutation.data.rows.length > 0 && "(Search query excluded all rows)"}
                        </div>
                      ) : (
                        <>
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
                                {paginatedRows.map((row, rIdx) => {
                                  const absoluteIndex = (currentPage - 1) * pageSize + rIdx;
                                  const isSelected = selectedRowIndex === absoluteIndex;
                                  return (
                                    <tr 
                                      key={rIdx} 
                                      onClick={() => setSelectedRowIndex(isSelected ? null : absoluteIndex)}
                                      onContextMenu={(e) => handleRowContextMenu(e, row, absoluteIndex)}
                                      className={`border-b border-border/20 last:border-b-0 hover:bg-secondary/15 cursor-pointer ${
                                        isSelected ? 'bg-primary/20 hover:bg-primary/25 font-semibold text-primary' : 
                                        absoluteIndex % 2 === 0 ? 'bg-background/40' : 'bg-secondary/5'
                                      }`}
                                    >
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
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Pagination Footer */}
                          <div className="flex items-center justify-between py-2 border-t border-border/20 text-xs shrink-0 select-none bg-secondary/5 p-3 rounded-lg border border-border/40">
                            <div className="flex items-center space-x-4">
                              <span className="text-muted-foreground">
                                Showing <span className="font-semibold text-foreground">{Math.min(filteredRows.length, (currentPage - 1) * pageSize + 1)}-{Math.min(filteredRows.length, currentPage * pageSize)}</span> of <span className="font-semibold text-foreground">{filteredRows.length}</span> rows
                              </span>
                              <div className="flex items-center space-x-1">
                                <span className="text-muted-foreground text-[11px]">Rows per page:</span>
                                <select
                                  value={pageSize}
                                  onChange={(e) => {
                                    setPageSize(parseInt(e.target.value));
                                    setCurrentPage(1);
                                  }}
                                  className="bg-background border border-border rounded text-[11px] p-0.5 focus:outline-none cursor-pointer"
                                >
                                  {[10, 25, 50, 100].map(sz => (
                                    <option key={sz} value={sz}>{sz}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                className="h-7 text-[11px] px-2.5 cursor-pointer"
                              >
                                Previous
                              </Button>
                              <span className="text-muted-foreground font-mono">
                                Page {currentPage} of {Math.ceil(filteredRows.length / pageSize)}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage >= Math.ceil(filteredRows.length / pageSize)}
                                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredRows.length / pageSize), prev + 1))}
                                className="h-7 text-[11px] px-2.5 cursor-pointer"
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── ROW EDIT DIALOG ────────────────────────────────────────────────── */}
      <Dialog isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} size="lg">
        <DialogHeader>
          <DialogTitle>Edit Row in '{selectedTable}'</DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
          {schema?.columns?.map((col) => {
            const colName = col.columnName;
            const isPk = colName === resolvedPkColumn;
            return (
              <div key={colName} className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                  {colName} 
                  {isPk && <span className="text-[10px] text-amber-500 font-mono font-bold">(Primary Key - Read Only)</span>}
                  {!col.nullable && !isPk && <span className="text-rose-500 font-bold">*</span>}
                </label>
                <Input
                  disabled={isPk}
                  value={editFormData[colName] === null || editFormData[colName] === undefined ? '' : String(editFormData[colName])}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditFormData(prev => ({
                      ...prev,
                      [colName]: val === '' && col.nullable ? null : val
                    }));
                  }}
                  className="font-mono text-xs"
                />
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveChanges} disabled={runQueryMutation.isPending}>
            {runQueryMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ── ROW LEVEL RIGHT-CLICK CONTEXT MENU ─────────────────────────────── */}
      {contextMenu && (
        <div 
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 bg-popover border border-border text-popover-foreground rounded-md shadow-lg p-1.5 min-w-[150px] text-xs font-sans animate-in fade-in zoom-in-95 duration-100"
        >
          <button 
            onClick={() => handleOpenEditRowDialog(contextMenu.row)}
            className="w-full text-left px-2.5 py-1.5 hover:bg-secondary rounded-sm transition-colors cursor-pointer flex items-center gap-1.5"
          >
            ✏️ Edit Row Details
          </button>
          <button 
            onClick={() => handleDeleteRow(contextMenu.row)}
            className="w-full text-left px-2.5 py-1.5 hover:bg-destructive/10 text-rose-400 hover:text-rose-300 rounded-sm transition-colors cursor-pointer flex items-center gap-1.5"
          >
            🗑️ Delete Row Record
          </button>
          <hr className="my-1 border-border/40" />
          <button 
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(contextMenu.row, null, 2));
              toast.success("Row copied as JSON");
            }}
            className="w-full text-left px-2.5 py-1.5 hover:bg-secondary rounded-sm transition-colors cursor-pointer flex items-center gap-1.5"
          >
            📋 Copy Row JSON
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminDatabasePage;
