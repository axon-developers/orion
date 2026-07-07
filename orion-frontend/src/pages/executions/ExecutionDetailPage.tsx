import React, { useEffect, useState, useRef } from 'react';
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
  Download,
  Table2,
  Eye,
  MonitorPlay
} from 'lucide-react';
import { ExecutionDetailDto, ExecutionStepLogDto } from '../../types/api';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface SecureImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

const SecureImage: React.FC<SecureImageProps> = ({ src, ...props }) => {
  const [objectUrl, setObjectUrl] = useState<string>('');
  const [error, setError] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    const fetchImage = async () => {
      try {
        setLoading(true);
        const response = await api.get(src, { responseType: 'blob' });
        if (active) {
          const url = URL.createObjectURL(response.data);
          setObjectUrl(url);
          setError(false);
        }
      } catch (err) {
        if (active) {
          setError(true);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchImage();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  if (loading) {
    return <div className="w-full h-full min-h-[120px] bg-secondary/15 flex items-center justify-center text-[10px] text-muted-foreground animate-pulse">Loading image...</div>;
  }

  if (error) {
    return <div className="w-full h-full min-h-[120px] bg-destructive/10 flex items-center justify-center text-[10px] text-destructive">Failed to load image</div>;
  }

  return <img src={objectUrl} {...props} />;
};

const JsonViewer = ({ data }: { data: any }) => {
  const highlight = (json: any) => {
    if (!json) return '';
    let jsonStr = typeof json !== 'string' ? JSON.stringify(json, null, 2) : json;
    jsonStr = jsonStr.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return jsonStr.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match: string) {
        let cls = 'text-blue-400'; // default string color
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'text-pink-400 font-semibold'; // key
            } else {
                cls = 'text-green-400'; // string
            }
        } else if (/true|false/.test(match)) {
            cls = 'text-orange-400'; // boolean
        } else if (/null/.test(match)) {
            cls = 'text-muted-foreground italic'; // null
        } else {
            cls = 'text-purple-400'; // number
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
  };

  return (
    <pre 
      className="p-3 rounded-lg bg-[#1e1e1e] text-gray-300 border border-[#333] shadow-inner text-[11px] leading-relaxed max-h-80 overflow-auto scrollbar-thin font-mono" 
      dangerouslySetInnerHTML={{ __html: highlight(data) }} 
    />
  );
};

const TimelineChart = ({ steps }: { steps: ExecutionStepLogDto[] }) => {
  const data = steps.filter(s => s.durationMs !== null).map(s => ({
    name: s.sequenceOrder.toString(),
    stepName: s.stepName,
    duration: s.durationMs || 0,
    status: s.status
  }));

  const getColor = (status: string) => {
    switch (status) {
      case 'PASSED': return 'hsl(142.1 76.2% 36.3%)'; // emerald
      case 'FAILED': return 'hsl(346.8 77.2% 49.8%)'; // rose
      case 'RUNNING': return 'hsl(221.2 83.2% 53.3%)'; // blue
      default: return 'hsl(215.4 16.3% 46.9%)'; // muted
    }
  };

  return (
    <Card className="glass mb-6">
      <CardHeader className="pb-2 border-b border-border/40">
        <CardTitle className="text-sm font-bold flex items-center">
          <Clock className="mr-2 h-4 w-4 text-primary" />
          Step Duration Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[230px] flex flex-col justify-center">
        {data.length === 0 ? (
          <div className="text-center py-12 text-xs text-muted-foreground">
            Waiting for step duration metrics to compile...
          </div>
        ) : (
          <div className="h-[180px] w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--foreground))' }} />
                <YAxis unit="ms" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                  cursor={{ fill: 'hsl(var(--secondary)/0.5)' }}
                  labelFormatter={(label, payload) => {
                    const stepName = payload?.[0]?.payload?.stepName || '';
                    return `Step ${label}: ${stepName}`;
                  }}
                />
                <Bar dataKey="duration" radius={[4, 4, 0, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getColor(entry.status)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};


export const ExecutionDetailPage: React.FC = () => {
  const { execId } = useParams<{ execId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'FAILED'>('ALL');
  const [detailTab, setDetailTab] = useState<'payload' | 'browser' | 'assertions'>('payload');
  const [isAutoTracking, setIsAutoTracking] = useState(true);
  const lastScrolledIdRef = useRef<string | null>(null);

  const [realtimeData, setRealtimeData] = useState<any>(null);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [activeScreenshotUrl, setActiveScreenshotUrl] = useState<string | null>(null);

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

  // Auto-select active or first step on load/run
  useEffect(() => {
    if (execution && execution.stepLogs.length > 0) {
      if (!isAutoTracking) return; // Pause auto-following if auto tracking is disabled by manual selection

      let targetId = selectedLogId;
      if (!selectedLogId) {
        const running = execution.stepLogs.find(l => l.status === 'RUNNING');
        if (running) {
          targetId = running.id;
          setSelectedLogId(running.id);
        } else {
          targetId = execution.stepLogs[0].id;
          setSelectedLogId(execution.stepLogs[0].id);
        }
      } else {
        const running = execution.stepLogs.find(l => l.status === 'RUNNING');
        if (running && running.id !== selectedLogId) {
          targetId = running.id;
          setSelectedLogId(running.id);
        }
      }

      if (targetId && targetId !== lastScrolledIdRef.current) {
        lastScrolledIdRef.current = targetId;
        setTimeout(() => {
          const el = document.getElementById(`step-btn-${targetId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 100);
      }
    }
  }, [execution, selectedLogId, isAutoTracking]);

  const filteredStepLogs = execution?.stepLogs.filter((log) => {
    if (statusFilter === 'FAILED') return log.status === 'FAILED';
    return true;
  }) || [];

  const selectedLog = execution?.stepLogs.find((l) => l.id === selectedLogId) || null;

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

  const getStepTypeBadge = (stepType: string) => {
    let classes = 'bg-primary/10 text-primary border border-primary/20';
    switch (stepType) {
      case 'HTTP_REQUEST':
        classes = 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
        break;
      case 'SOAP_REQUEST':
        classes = 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20';
        break;
      case 'DATABASE_QUERY':
      case 'DB_TABLE_VIEW':
        classes = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
        break;
      case 'SET_VARIABLE':
        classes = 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
        break;
      case 'ASSERTION':
        classes = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
        break;
      case 'DELAY':
        classes = 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
        break;
      case 'LOOP':
        classes = 'bg-violet-500/10 text-violet-400 border border-violet-500/20';
        break;
      case 'BROWSER_AUTOMATION':
        classes = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
        break;
    }
    return (
      <span className={`text-[8px] font-bold font-mono px-1.5 py-0.5 rounded shrink-0 uppercase tracking-wider ${classes}`}>
        {stepType.replace('_', ' ')}
      </span>
    );
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
            className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-2 cursor-pointer transition-colors"
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
      <Card className="glass relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <CardContent className="p-6 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Status</span>
              <div className="pt-0.5">{getStatusBadge(activeExecution?.status)}</div>
            </div>
            
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Duration</span>
              <div className="text-2xl font-extrabold text-foreground">
                {activeExecution?.durationMs ? `${(activeExecution.durationMs / 1000).toFixed(2)}s` : '--'}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Target Env</span>
              <div className="text-xl font-bold text-foreground mt-0.5">{activeExecution?.environmentName || 'Default'}</div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Step Progress</span>
              <div className="text-xl font-bold text-foreground mt-0.5">
                {activeExecution?.passedSteps} <span className="text-muted-foreground">/ {activeExecution?.totalSteps}</span> Passed
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

      {/* Timeline Chart */}
      <TimelineChart steps={execution.stepLogs} />

      {/* Steps breakdown split-pane */}
      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-360px)] min-h-[550px] overflow-hidden">
        
        {/* LEFT PANE: Steps Sidebar Navigator */}
        <div className="w-full lg:w-80 flex flex-col bg-card/25 border border-border/40 rounded-xl overflow-hidden shrink-0">
          {/* Header & Filter */}
          <div className="p-4 border-b border-border/30 bg-secondary/5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Steps List</span>
              {!isAutoTracking && isRunning && (
                <button
                  onClick={() => setIsAutoTracking(true)}
                  className="text-[9px] text-left text-blue-400 font-bold hover:underline mt-0.5 flex items-center gap-1 cursor-pointer animate-pulse"
                >
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                  Resume Live Follow
                </button>
              )}
            </div>
            <div className="flex items-center space-x-1.5">
              <Button
                variant={statusFilter === 'ALL' ? 'primary' : 'outline'}
                size="sm"
                className="h-6 text-[10px] px-2 py-0"
                onClick={() => setStatusFilter('ALL')}
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'FAILED' ? 'primary' : 'outline'}
                size="sm"
                className="h-6 text-[10px] px-2 py-0 border-destructive/20 text-destructive hover:bg-destructive/10"
                onClick={() => setStatusFilter('FAILED')}
              >
                Failed
              </Button>
            </div>
          </div>

          {/* List content */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredStepLogs.length === 0 ? (
              <div className="text-center py-12 text-xs text-muted-foreground">
                No steps match the filter.
              </div>
            ) : (
              filteredStepLogs.map((log) => {
                const isSelected = selectedLogId === log.id;
                return (
                  <button
                    key={log.id}
                    id={`step-btn-${log.id}`}
                    onClick={() => {
                      setSelectedLogId(log.id);
                      if (log.status !== 'RUNNING') {
                        setIsAutoTracking(false);
                      } else {
                        setIsAutoTracking(true);
                      }
                      if (log.stepType === 'BROWSER_AUTOMATION') {
                        setDetailTab('browser');
                      } else {
                        setDetailTab('payload');
                      }
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all duration-200 cursor-pointer ${
                      isSelected 
                        ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/20' 
                        : log.status === 'FAILED'
                          ? 'border-destructive/30 bg-destructive/5 hover:bg-destructive/10'
                          : 'border-border/50 hover:bg-secondary/10'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      {getStepStatusIcon(log.status)}
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-xs truncate text-foreground">{log.stepName}</span>
                          {getStepTypeBadge(log.stepType)}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Step {log.sequenceOrder} {log.durationMs !== null && `• ${log.durationMs}ms`}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANE: Details inspection workspace */}
        <div className="flex-1 flex flex-col bg-card/25 border border-border/40 rounded-xl overflow-hidden min-w-0">
          {selectedLog ? (
            <>
              {/* Tab selector header */}
              <div className="p-4 border-b border-border/30 bg-secondary/5 flex items-center justify-between flex-wrap gap-2 shrink-0">
                <div className="flex items-center space-x-3.5 min-w-0">
                  {getStepStatusIcon(selectedLog.status)}
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-foreground truncate">{selectedLog.stepName}</h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                      Type: {selectedLog.stepType} • Sequence: {selectedLog.sequenceOrder}
                    </p>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center space-x-1 bg-secondary/20 p-0.5 rounded border border-border/15">
                  <button
                    onClick={() => setDetailTab('payload')}
                    className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer ${
                      detailTab === 'payload' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-slate-400 hover:text-foreground'
                    }`}
                  >
                    Payloads
                  </button>
                  {selectedLog.stepType === 'BROWSER_AUTOMATION' && (
                    <button
                      onClick={() => setDetailTab('browser')}
                      className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer ${
                        detailTab === 'browser' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-slate-400 hover:text-foreground'
                      }`}
                    >
                      Browser Script
                    </button>
                  )}
                  {selectedLog.status === 'FAILED' && (
                    <button
                      onClick={() => setDetailTab('assertions')}
                      className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer ${
                        detailTab === 'assertions' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-slate-400 hover:text-foreground'
                      }`}
                    >
                      Error Details
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable details tab content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                
                {/* 1. Payload Output tab */}
                {detailTab === 'payload' && (
                  <div className="space-y-4">
                    {/* Database format viewer */}
                    {(selectedLog.stepType === 'DB_TABLE_VIEW' || (selectedLog.stepType === 'DATABASE_QUERY' && selectedLog.outputPayload?.printAsTable)) && selectedLog.outputPayload?.rows ? (
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Table2 className="h-4 w-4 text-orange-400" />
                          <span className="text-xs font-bold text-foreground">
                            {selectedLog.outputPayload.tableTitle || 'Query Results'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            ({selectedLog.outputPayload.rowCount ?? selectedLog.outputPayload.rows.length} rows)
                          </span>
                        </div>
                        {selectedLog.outputPayload.rows.length === 0 ? (
                          <div className="p-4 text-center text-muted-foreground text-xs bg-background border border-border/50 rounded font-sans">
                            No rows returned by query.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded border border-border/50">
                            <table className="w-full text-[11px]">
                              <thead>
                                <tr className="border-b border-border/50 bg-secondary/30">
                                  {Object.keys(selectedLog.outputPayload.rows[0]).map((col: string) => (
                                    <th
                                      key={col}
                                      className="px-3 py-2 text-left font-bold text-muted-foreground uppercase tracking-wider text-[10px] whitespace-nowrap border-r border-border/30 last:border-r-0"
                                    >
                                      {col}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {selectedLog.outputPayload.rows.map((row: Record<string, any>, rIdx: number) => (
                                  <tr
                                    key={rIdx}
                                    className={`border-b border-border/20 last:border-b-0 ${
                                      rIdx % 2 === 0 ? 'bg-background/50' : 'bg-secondary/10'
                                    } hover:bg-orange-500/5 transition-colors`}
                                  >
                                    {Object.values(row).map((val: any, cIdx: number) => {
                                      const cellTitle = val === null || val === undefined ? 'NULL' : (typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val));
                                      const displayVal = val === null || val === undefined ? (
                                        <span className="text-muted-foreground italic">NULL</span>
                                      ) : typeof val === 'object' ? (
                                        JSON.stringify(val)
                                      ) : typeof val === 'boolean' ? (
                                        val ? 'true' : 'false'
                                      ) : (
                                        String(val)
                                      );
                                      return (
                                        <td
                                          key={cIdx}
                                          className="px-3 py-2 text-foreground/90 border-r border-border/20 last:border-r-0 max-w-xs truncate"
                                          title={cellTitle}
                                        >
                                          {displayVal}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase font-sans tracking-wider">SQL Query Executed</span>
                          <pre className="p-3 rounded-lg bg-[#111218] text-[#d4d4d4] border border-[#2a2c3a] overflow-x-auto text-[11px] leading-relaxed shadow-inner font-mono">
                            {selectedLog.outputPayload.query}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      // Standard API / general JSON output parameters
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Resolved Input Params</span>
                          <JsonViewer data={selectedLog.inputPayload} />
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Execution Output Response</span>
                          <JsonViewer data={selectedLog.outputPayload} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Browser Script tab */}
                {detailTab === 'browser' && selectedLog.stepType === 'BROWSER_AUTOMATION' && (
                  <div className="space-y-4">
                    {/* Actions List */}
                    {selectedLog.outputPayload?.actions && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Automation Script Steps</span>
                        <div className="bg-[#111218] rounded-lg border border-[#2a2c3a] shadow-inner p-3 font-mono text-[11px] space-y-1.5 max-h-64 overflow-y-auto">
                          {selectedLog.outputPayload.actions.map((act: any, aIdx: number) => {
                            const isSuccess = act.status === 'SUCCESS';
                            return (
                              <div key={aIdx} className="flex items-start space-x-2">
                                <span className={`font-bold shrink-0 ${isSuccess ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  [{act.status}]
                                </span>
                                <span className="text-blue-400 font-semibold">
                                  {act.type}:
                                </span>
                                <span className="text-gray-300">
                                  {act.message || act.error}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Screenshots Gallery */}
                    {selectedLog.outputPayload?.screenshots && selectedLog.outputPayload.screenshots.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Captured Screenshots</span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {selectedLog.outputPayload.screenshots.map((s: any, sIdx: number) => {
                            const imgPath = `/executions/${execId}/steps/${selectedLog.id}/screenshots/${s.filename}`;
                            return (
                              <div 
                                key={sIdx} 
                                className="border border-border/60 rounded-md overflow-hidden bg-card shadow-sm hover:border-primary transition-all cursor-zoom-in group hover:shadow-lg hover:-translate-y-1"
                                onClick={() => setActiveScreenshotUrl(imgPath)}
                              >
                                <div className="w-full h-32 relative bg-secondary/10 flex items-center justify-center overflow-hidden">
                                  <SecureImage 
                                    src={imgPath} 
                                    alt={s.name} 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                </div>
                                <div className="p-2 text-center text-[10px] font-semibold truncate text-muted-foreground border-t border-border/40">
                                  {s.name}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Error / Assertion Details tab */}
                {detailTab === 'assertions' && selectedLog.status === 'FAILED' && (
                  <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold space-y-2">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-destructive/80">Failure Message</h4>
                    <p className="font-mono text-xs">{selectedLog.errorMessage || 'No error details recorded.'}</p>
                  </div>
                )}

              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
              Select a step from the list to view its execution details.
            </div>
          )}
        </div>

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

      {/* Lightbox for screenshots */}
      {activeScreenshotUrl && (
        <div 
          onClick={() => setActiveScreenshotUrl(null)}
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-200"
        >
          <div className="relative max-w-full max-h-full">
            <SecureImage 
              src={activeScreenshotUrl} 
              alt="Screenshot preview" 
              className="max-w-full max-h-[92vh] object-contain rounded-md shadow-2xl border border-white/10" 
            />
          </div>
        </div>
      )}
    </div>
  );
};
export default ExecutionDetailPage;
