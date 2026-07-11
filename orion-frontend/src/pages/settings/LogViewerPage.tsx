import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge, Input, Switch } from '../../components/ui';
import { Terminal, Loader2, Download, Search, RefreshCw, AlertTriangle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface LogEntryDto {
  timestamp: string;
  thread: string;
  level: string;
  logger: string;
  message: string;
  rawLine: string;
}

export const LogViewerPage: React.FC = () => {
  const [level, setLevel] = useState('ALL');
  const [searchVal, setSearchVal] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [days, setDays] = useState<1 | 7>(1);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Debounce search filter input
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchVal);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchVal]);

  // Fetch logs query
  const { data: logs, isLoading, refetch, isFetching } = useQuery<LogEntryDto[]>({
    queryKey: ['admin-logs', level, searchQuery, days],
    queryFn: async () => {
      let url = `/admin/logs?days=${days}&level=${level}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      const res = await api.get(url);
      return res.data;
    },
    refetchInterval: autoRefresh ? 5000 : false, // Auto-refresh log viewer console if toggle is checked
  });

  // Auto-scroll to bottom of console terminal window on new logs
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleExport = () => {
    let url = `${api.defaults.baseURL || ''}/admin/logs/export?days=${days}&level=${level}`;
    if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
    
    // Trigger download using authentication token headers
    const downloadPromise = api.get(url, { responseType: 'blob' })
      .then(res => {
        const blob = new Blob([res.data], { type: 'text/plain' });
        const urlBlob = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = urlBlob;
        anchor.download = `orion-logs-${days}days.log`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(urlBlob);
      });

    toast.promise(downloadPromise, {
      loading: 'Preparing log export text...',
      success: 'Log file exported successfully!',
      error: 'Failed to download logs text.',
    });
  };

  const getLogColorClass = (levelStr: string) => {
    switch (levelStr.toUpperCase()) {
      case 'ERROR':
        return 'text-rose-400 bg-rose-500/5 font-semibold';
      case 'WARN':
        return 'text-amber-400 bg-amber-500/5 font-semibold';
      case 'DEBUG':
        return 'text-cyan-400';
      case 'TRACE':
        return 'text-purple-400/80';
      default:
        return 'text-foreground';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center">
            <Terminal className="mr-2 h-7 w-7 text-primary" />
            Console Log Viewer
          </h1>
          <p className="text-muted-foreground mt-1">Audit active server output streams and runtime exceptions</p>
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading || isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={handleExport} disabled={isLoading || !logs || logs.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export Raw Logs
          </Button>
        </div>
      </div>

      {/* Filter and settings header control bar */}
      <Card className="border border-border/50 bg-card/20">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3 flex-1 min-w-[280px]">
            {/* Search inputs */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                placeholder="Search log output lines..."
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Level selection dropdown */}
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="flex h-9 rounded-md border border-border bg-background px-3 py-2 text-xs w-32 text-foreground cursor-pointer"
            >
              <option value="ALL">All Levels</option>
              <option value="INFO">Info Only</option>
              <option value="WARN">Warnings</option>
              <option value="ERROR">Errors</option>
              <option value="DEBUG">Debug</option>
            </select>
          </div>

          <div className="flex items-center space-x-6">
            {/* Date scope toggle */}
            <div className="flex bg-secondary/35 p-0.5 rounded-lg border border-border/40 shrink-0">
              <button
                onClick={() => setDays(1)}
                className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${days === 1 ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                1 Day Scope
              </button>
              <button
                onClick={() => setDays(7)}
                className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${days === 7 ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                7 Days Scope
              </button>
            </div>

            {/* Auto refresh switch */}
            <div className="flex items-center space-x-2 border-l border-border/40 pl-6 h-6">
              <Switch
                label="Auto Refresh (5s)"
                checked={autoRefresh}
                onChange={(e: any) => setAutoRefresh(e.target.checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Terminal window rendering block */}
      <Card className="border border-border/60 bg-black/80 shadow-2xl relative overflow-hidden flex flex-col h-[520px] rounded-lg">
        {/* Terminal Header */}
        <div className="bg-secondary/40 border-b border-border/50 px-4 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
            <span className="text-[10px] text-muted-foreground font-mono ml-3 font-semibold">logs/orion.log — {days} days history</span>
          </div>
          {isFetching && (
            <div className="flex items-center space-x-1">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span className="text-[9px] text-muted-foreground/80 font-semibold font-mono">streaming...</span>
            </div>
          )}
        </div>

        {/* Console logs output terminal pane */}
        <div className="flex-1 p-4 overflow-y-auto font-mono text-[11px] leading-relaxed select-text scrollbar-thin">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-3">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <span className="text-muted-foreground font-mono text-xs">Parsing rolling log file streams...</span>
            </div>
          ) : !logs || logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground/60 space-y-2">
              <AlertCircle className="h-10 w-10 text-muted-foreground/20" />
              <span>No matching console entries recorded.</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {logs.map((entry, index) => (
                <div key={index} className={`py-0.5 px-1.5 rounded transition-colors ${getLogColorClass(entry.level)}`}>
                  <span className="text-muted-foreground select-none">[{entry.timestamp}]</span>{' '}
                  <span className="text-blue-400 select-none">[{entry.thread}]</span>{' '}
                  <span className="font-bold select-none">{entry.level}</span>{' '}
                  <span className="text-teal-400/85 select-none">{entry.logger}</span>{' '}
                  <span className="text-muted-foreground select-none">-</span>{' '}
                  <span className="whitespace-pre-wrap">{entry.message}</span>
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default LogViewerPage;
