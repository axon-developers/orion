import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge, Input } from '../../components/ui';
import { Activity, Loader2, Clock, CheckCircle, XCircle, ArrowRight, Search } from 'lucide-react';
import { ExecutionDto, PagedResponse } from '../../types/api';

export const ExecutionListPage: React.FC = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const [searchVal, setSearchVal] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);

  // Debounce searchVal input changes to update searchQuery
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchVal);
      setPage(0);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchVal]);

  // Fetch all execution runs
  const { data: executions, isLoading } = useQuery<PagedResponse<ExecutionDto>>({
    queryKey: ['executions-history-list', statusFilter, searchQuery, page, size],
    queryFn: async () => {
      let url = `/executions?page=${page}&size=${size}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      const res = await api.get(url);
      return res.data;
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PASSED':
        return <Badge variant="success">Passed</Badge>;
      case 'FAILED':
        return <Badge variant="destructive">Failed</Badge>;
      case 'RUNNING':
        return <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse">Running</Badge>;
      case 'QUEUED':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Queued</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center">
          <Activity className="mr-2 h-7 w-7 text-primary" />
          Global Executions History
        </h1>
        <p className="text-muted-foreground mt-1">Audit logs of all historical test case executions</p>
      </div>

      <div className="flex items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            placeholder="Search test case name..."
            className="pl-9 h-10 text-xs"
          />
        </div>

        {/* Status select dropdown */}
        <div className="flex items-center space-x-2">
          <select 
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-xs max-w-[180px] text-foreground cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="PASSED">Passed</option>
            <option value="FAILED">Failed</option>
            <option value="RUNNING">Running</option>
            <option value="QUEUED">Queued</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !executions?.content || executions.content.length === 0 ? (
        <Card className="text-center py-16 border-dashed">
          <Activity className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-bold">No runs recorded</h3>
          <p className="text-muted-foreground mt-1">Trigger test execution templates from applications detail panel.</p>
        </Card>
      ) : (
        <Card className="border border-border/50 bg-card/20 overflow-hidden flex flex-col justify-between">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/35 text-muted-foreground uppercase text-[10px] tracking-wider">
                    <th className="p-4 font-bold">Test Case</th>
                    <th className="p-4 font-bold">Environment</th>
                    <th className="p-4 font-bold">Duration</th>
                    <th className="p-4 font-bold">Status</th>
                    <th className="p-4 font-bold">Date Triggered</th>
                    <th className="p-4 font-bold text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {executions.content.map((exec) => (
                    <tr key={exec.id} className="hover:bg-secondary/10 transition-colors">
                      <td className="p-4 font-bold text-foreground truncate max-w-xs">{exec.testCaseName || `Run #${exec.id.substring(0, 8)}`}</td>
                      <td className="p-4 font-mono text-muted-foreground">{exec.environmentName}</td>
                      <td className="p-4 font-mono text-[11px]">
                        {exec.durationMs ? `${(exec.durationMs / 1000).toFixed(2)}s` : '--'}
                      </td>
                      <td className="p-4">{getStatusBadge(exec.status)}</td>
                      <td className="p-4 text-xs text-muted-foreground">
                        {new Date(exec.createdAt).toLocaleString()}
                      </td>
                      <td className="p-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => navigate(`/executions/${exec.id}`)}
                          className="h-8"
                        >
                          View Logs
                          <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>

          {/* Pagination Controls */}
          {executions && executions.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border/40 px-4 py-3 bg-secondary/10 text-xs">
              <div className="flex items-center space-x-2">
                <span className="text-muted-foreground">Rows per page:</span>
                <select
                  value={size}
                  onChange={(e) => {
                    setSize(parseInt(e.target.value) || 10);
                    setPage(0);
                  }}
                  className="h-8 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground cursor-pointer font-semibold"
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-muted-foreground font-semibold">
                  Page {page + 1} of {executions.totalPages} ({executions.totalElements} runs)
                </span>
                <div className="flex items-center space-x-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                    disabled={page === 0}
                    className="h-8 py-0"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((prev) => Math.min(executions.totalPages - 1, prev + 1))}
                    disabled={page >= executions.totalPages - 1}
                    className="h-8 py-0"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default ExecutionListPage;
