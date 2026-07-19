import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { PagedResponse, ExecutionDto } from '../../types/api';
import { Badge, Button, Card, CardHeader, CardTitle, CardContent, Skeleton } from '../ui';
import { History, Clock, CheckCircle2, XCircle, Loader2, ArrowUpRight, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TestCaseRunHistoryPanelProps {
  testCaseId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const TestCaseRunHistoryPanel: React.FC<TestCaseRunHistoryPanelProps> = ({
  testCaseId,
  isOpen,
  onClose,
}) => {
  const navigate = useNavigate();

  const { data: runsResponse, isLoading, refetch } = useQuery<PagedResponse<ExecutionDto>>({
    queryKey: ['testcase-history-runs', testCaseId],
    queryFn: async () => {
      const res = await api.get(`/executions?testCaseId=${testCaseId}&page=0&size=5&sort=createdAt,desc`);
      return res.data;
    },
    enabled: isOpen && !!testCaseId,
  });

  if (!isOpen) return null;

  const runs = runsResponse?.content || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PASSED':
        return <Badge variant="success" className="text-[10px]">Passed</Badge>;
      case 'FAILED':
        return <Badge variant="destructive" className="text-[10px]">Failed</Badge>;
      case 'RUNNING':
        return <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse text-[10px]">Running</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-96 bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-sm">Execution Run History</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
          ✕
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-xs">
            <Activity className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
            No execution history found for this test case.
          </div>
        ) : (
          runs.map((run) => (
            <Card
              key={run.id}
              className="p-3 border border-border/60 hover:border-primary/40 transition-colors cursor-pointer group"
              onClick={() => {
                onClose();
                navigate(`/executions/${run.id}`);
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusBadge(run.status)}
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {run.durationMs ? `${(run.durationMs / 1000).toFixed(2)}s` : '--'}
                  </span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="truncate">By: {run.triggeredBy || 'System'}</span>
                <span>{new Date(run.createdAt).toLocaleDateString()} {new Date(run.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </Card>
          ))
        )}
      </div>

      <div className="p-3 border-t border-border bg-muted/10 flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs h-7 gap-1">
          Refresh History
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onClose();
            navigate('/executions');
          }}
          className="text-xs h-7"
        >
          View All Executions →
        </Button>
      </div>
    </div>
  );
};
