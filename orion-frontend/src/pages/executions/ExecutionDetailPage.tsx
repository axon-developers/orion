import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge, Input, Dialog, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui';
import { 
  Activity, 
  Clock, 
  ArrowLeft, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Play, 
  ChevronRight, 
  ChevronDown,
  Terminal,
  RefreshCw,
  Ban,
  Mail,
  Download
} from 'lucide-react';
import { ExecutionDetailDto, ExecutionStepLogDto } from '../../types/api';
import { toast } from 'sonner';

export const ExecutionDetailPage: React.FC = () => {
  const { execId } = useParams<{ execId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [realtimeData, setRealtimeData] = useState<any>(null);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');

  // Fetch execution details initially
  const { data: execution, isLoading, refetch } = useQuery<ExecutionDetailDto>({
    queryKey: ['execution-detail', execId],
    queryFn: async () => {
      const res = await api.get(`/executions/${execId}`);
      return res.data;
    },
    enabled: !!execId,
  });

  // mutations
  const cancelMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/executions/${execId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['execution-detail', execId] });
      toast.info('Cancellation request sent');
    },
  });

  const rerunMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/executions/${execId}/rerun`);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success('Rerun triggered successfully');
      navigate(`/executions/${data.id}`);
    },
  });

  const emailMutation = useMutation({
    mutationFn: async (email: string) => {
      await api.post(`/executions/${execId}/email`, { recipientEmail: email });
    },
    onSuccess: () => {
      toast.success('Execution report emailed successfully');
      setIsEmailDialogOpen(false);
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message || err.message || 'Failed to email report';
      toast.error(message);
    }
  });

  const handleDownloadReport = async () => {
    try {
      const res = await api.get(`/executions/${execId}/report`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `execution-report-${execId}.html`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Report downloaded successfully');
    } catch (err: any) {
      toast.error('Failed to download report: ' + (err.message || 'Unknown error'));
    }
  };

  // Real-time update stream via SSE
  useEffect(() => {
    if (!execId) return;

    // Connect to SSE stream
    const eventSource = new EventSource(`/api/executions/${execId}/stream`);

    eventSource.addEventListener('execution-update', (event: MessageEvent) => {
      try {
        const update = JSON.parse(event.data);
        setRealtimeData(update);
        queryClient.invalidateQueries({ queryKey: ['execution-detail', execId] });
      } catch (err) {
        // parsing error
      }
    });

    eventSource.onerror = () => {
      // On connection error, close SSE and fall back to polling query client
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [execId, queryClient]);

  // Fallback Polling if status is RUNNING or QUEUED and SSE disconnected
  const activeExecution = realtimeData || execution;
  const isRunning = activeExecution?.status === 'RUNNING' || activeExecution?.status === 'QUEUED';

  useEffect(() => {
    let interval: any;
    if (isRunning) {
      interval = setInterval(() => {
        refetch();
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, refetch]);

  const toggleExpandLog = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PASSED':
        return <Badge variant="success" className="px-3 py-1 font-bold text-sm">Passed</Badge>;
      case 'FAILED':
        return <Badge variant="destructive" className="px-3 py-1 font-bold text-sm">Failed</Badge>;
      case 'RUNNING':
        return <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse px-3 py-1 font-bold text-sm">Running</Badge>;
      case 'QUEUED':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-3 py-1 font-bold text-sm">Queued</Badge>;
      case 'CANCELLED':
        return <Badge variant="secondary" className="px-3 py-1 font-bold text-sm">Cancelled</Badge>;
      default:
        return <Badge variant="secondary" className="px-3 py-1 font-bold text-sm">{status}</Badge>;
    }
  };

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case 'PASSED':
        return <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />;
      case 'FAILED':
        return <XCircle className="h-5 w-5 text-rose-400 shrink-0" />;
      case 'RUNNING':
        return <Loader2 className="h-5 w-5 text-blue-400 animate-spin shrink-0" />;
      case 'SKIPPED':
        return <Ban className="h-5 w-5 text-muted-foreground shrink-0" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground shrink-0" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-48">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
        <p className="text-sm text-muted-foreground">Loading test run logs...</p>
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <XCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold">Execution not found</h2>
        <Button onClick={() => navigate('/')} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Home Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <button 
            onClick={() => navigate(-1)} 
            className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-2 cursor-pointer"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </button>
          <h1 className="text-3xl font-extrabold tracking-tight">Test Run Results</h1>
          <p className="text-xs text-muted-foreground">
            ID: <span className="font-mono text-foreground font-semibold">{activeExecution?.id}</span>
          </p>
        </div>
        
        <div className="flex items-center space-x-2 shrink-0">
          {!isRunning && (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsEmailDialogOpen(true)}>
                <Mail className="mr-1.5 h-4 w-4" /> Email Report
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadReport}>
                <Download className="mr-1.5 h-4 w-4" /> Download Report
              </Button>
            </>
          )}
          {isRunning && (
            <Button variant="outline" size="sm" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
              Cancel Run
            </Button>
          )}
          {!isRunning && (
            <Button size="sm" onClick={() => rerunMutation.mutate()} disabled={rerunMutation.isPending}>
              <RefreshCw className="mr-1.5 h-4 w-4" /> Rerun Test
            </Button>
          )}
        </div>
      </div>

      {/* Overview Card */}
      <Card className="border border-border/50 bg-card/30 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Status</span>
              <div className="pt-0.5">{getStatusBadge(activeExecution?.status)}</div>
            </div>
            
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Duration</span>
              <div className="text-base font-extrabold text-foreground">
                {activeExecution?.durationMs ? `${(activeExecution.durationMs / 1000).toFixed(2)}s` : '--'}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Target Env</span>
              <div className="text-base font-extrabold text-foreground">{activeExecution?.environmentName || 'Default'}</div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Step Progress</span>
              <div className="text-base font-extrabold text-foreground">
                {activeExecution?.passedSteps} / {activeExecution?.totalSteps} Passed
              </div>
            </div>
          </div>

          {activeExecution?.errorMessage && (
            <div className="mt-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold">
              Failure Message: {activeExecution.errorMessage}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Steps breakdown list */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold flex items-center">
          <Terminal className="mr-2 h-5 w-5 text-primary" />
          Execution Log Output
        </h3>

        {execution.stepLogs.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground text-sm">
            Waiting for step execution metrics...
          </Card>
        ) : (
          <div className="space-y-3">
            {execution.stepLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const hasPayload = log.inputPayload || log.outputPayload;

              return (
                <Card 
                  key={log.id} 
                  className={`border border-border/50 hover:border-border transition-all duration-200 ${
                    log.status === 'FAILED' ? 'border-l-4 border-l-destructive bg-destructive/5' : ''
                  }`}
                >
                  <div 
                    onClick={() => hasPayload && toggleExpandLog(log.id)}
                    className={`p-4 flex items-center justify-between gap-4 select-none ${
                      hasPayload ? 'cursor-pointer hover:bg-secondary/10' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3.5 min-w-0">
                      {getStepStatusIcon(log.status)}
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-sm truncate">{log.stepName}</span>
                          <span className="text-[9px] uppercase font-bold text-muted-foreground font-mono">
                            {log.stepType}
                          </span>
                        </div>
                        <div className="flex items-center space-x-3 text-xs text-muted-foreground mt-0.5">
                          <span>Step {log.sequenceOrder}</span>
                          {log.durationMs !== null && (
                            <>
                              <span>•</span>
                              <span>{log.durationMs}ms</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      {log.status === 'FAILED' && log.errorMessage && (
                        <span className="text-xs text-destructive font-semibold mr-2 hidden md:inline">
                          {log.errorMessage}
                        </span>
                      )}
                      {hasPayload && (
                        isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Payload Output */}
                  {isExpanded && (
                    <div className="border-t border-border/30 bg-secondary/15 p-4 space-y-4 text-xs font-mono">
                      {log.errorMessage && (
                        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-md font-semibold font-sans">
                          {log.errorMessage}
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase font-sans">Resolved Input Params</span>
                          <pre className="p-3 rounded bg-background border border-border/50 overflow-x-auto text-[11px] leading-relaxed max-h-60 overflow-y-auto">
                            {JSON.stringify(log.inputPayload, null, 2)}
                          </pre>
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase font-sans">Execution Output Response</span>
                          <pre className="p-3 rounded bg-background border border-border/50 overflow-x-auto text-[11px] leading-relaxed max-h-60 overflow-y-auto">
                            {JSON.stringify(log.outputPayload, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Email Report Dialog */}
      <Dialog isOpen={isEmailDialogOpen} onClose={() => setIsEmailDialogOpen(false)} size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Mail className="mr-2 h-5 w-5 text-primary" />
            Email Execution Report
          </DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter the email address where you would like to receive the HTML execution report.
          </p>
          <div className="space-y-1.5">
            <label htmlFor="email-input" className="text-xs font-bold text-muted-foreground uppercase">
              Recipient Email Address
            </label>
            <Input
              id="email-input"
              type="email"
              placeholder="e.g. qa-reports@example.com"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="bg-background border border-border"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setIsEmailDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            size="sm" 
            onClick={() => emailMutation.mutate(recipientEmail)} 
            disabled={emailMutation.isPending || !recipientEmail.trim()}
          >
            {emailMutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Sending...
              </>
            ) : (
              <>Send Report</>
            )}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
};
export default ExecutionDetailPage;
