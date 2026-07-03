import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge, Input } from '../../components/ui';
import { Activity, Loader2, Clock, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { ExecutionDto, PagedResponse } from '../../types/api';

export const ExecutionListPage: React.FC = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');

  // Fetch all execution runs
  const { data: executions, isLoading } = useQuery<PagedResponse<ExecutionDto>>({
    queryKey: ['executions-history-list', statusFilter],
    queryFn: async () => {
      const url = statusFilter 
        ? `/executions?page=0&size=100&status=${statusFilter}`
        : '/executions?page=0&size=100';
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

      <div className="flex items-center space-x-2">
        <select 
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm max-w-[180px]"
        >
          <option value="">All Statuses</option>
          <option value="PASSED">Passed</option>
          <option value="FAILED">Failed</option>
          <option value="RUNNING">Running</option>
          <option value="QUEUED">Queued</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
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
        <Card className="border border-border/50 bg-card/20 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/35 text-muted-foreground">
                    <th className="p-4 font-semibold">Test Case</th>
                    <th className="p-4 font-semibold">Environment</th>
                    <th className="p-4 font-semibold">Duration</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold">Date Triggered</th>
                    <th className="p-4 font-semibold text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {executions.content.map((exec) => (
                    <tr key={exec.id} className="hover:bg-secondary/10 transition-colors">
                      <td className="p-4 font-bold text-foreground truncate max-w-xs">{exec.testCaseName || `Run #${exec.id.substring(0, 8)}`}</td>
                      <td className="p-4">{exec.environmentName}</td>
                      <td className="p-4 font-mono text-xs">
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
        </Card>
      )}
    </div>
  );
};
export default ExecutionListPage;
