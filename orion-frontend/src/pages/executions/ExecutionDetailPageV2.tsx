import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { 
  Card, CardHeader, CardTitle, CardDescription, CardContent, 
  Button, Badge, Input, Dialog, DialogHeader, DialogTitle, DialogFooter 
} from '../../components/ui';
import { 
  Activity, Clock, ArrowLeft, Loader2, CheckCircle2, XCircle, 
  Play, ChevronRight, ChevronDown, Terminal, RefreshCw, Ban, 
  Mail, Download, Eye, Layers, Copy, Check, FileJson, ShieldCheck, 
  Image as ImageIcon, ZoomIn, Info, Table2, Globe, Database, 
  HelpCircle, GitBranch, Repeat, Split, Link as LinkIcon, MonitorPlay, 
  Monitor, FileText, FileCode
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
    return <div className="w-full h-full min-h-[200px] bg-secondary/15 flex items-center justify-center text-[10px] text-muted-foreground animate-pulse rounded-lg border border-border/35">Loading image...</div>;
  }

  if (error) {
    return <div className="w-full h-full min-h-[200px] bg-destructive/10 flex items-center justify-center text-[10px] text-destructive rounded-lg border border-destructive/25">Failed to load screenshot</div>;
  }

  return <img src={objectUrl} {...props} />;
};

const JsonViewer = ({ data }: { data: any }) => {
  const highlight = (json: any) => {
    if (!json) return '';
    let jsonStr = typeof json !== 'string' ? JSON.stringify(json, null, 2) : json;
    jsonStr = jsonStr.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return jsonStr.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match: string) {
        let cls = 'text-[#79c0ff]';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'text-[#ff7b72] font-semibold';
            } else {
                cls = 'text-[#7ee787]';
            }
        } else if (/true|false/.test(match)) {
            cls = 'text-[#ff9b50]';
        } else if (/null/.test(match)) {
            cls = 'text-[#8b949e] italic';
        } else {
            cls = 'text-[#79c0ff]';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
  };

  return (
    <pre 
      className="p-4 rounded-xl bg-[#0d1117] text-[#c9d1d9] border border-[#21262d] shadow-2xl text-[13px] leading-relaxed max-h-[550px] overflow-auto scrollbar-thin font-mono w-full" 
      dangerouslySetInnerHTML={{ __html: highlight(data) }} 
    />
  );
};

const MinimalDurationChart = ({ steps }: { steps: ExecutionStepLogDto[] }) => {
  const data = useMemo(() => {
    return steps.filter(s => s.durationMs !== null).map(s => ({
      name: `S${s.sequenceOrder}`,
      stepName: s.stepName,
      duration: s.durationMs || 0,
      status: s.status
    }));
  }, [steps]);

  const getColor = (status: string) => {
    switch (status) {
      case 'PASSED': return '#10b981';
      case 'FAILED': return '#f43f5e';
      case 'RUNNING': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  if (data.length === 0) return null;

  return (
    <div className="h-20 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={1}>
          <Tooltip 
            contentStyle={{ backgroundColor: 'black', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '10px' }}
            itemStyle={{ color: 'white' }}
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            labelFormatter={(label, payload) => {
              const stepName = payload?.[0]?.payload?.stepName || '';
              return `Step ${label}: ${stepName}`;
            }}
          />
          <Bar dataKey="duration" radius={[2, 2, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.status)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const ExecutionDetailPageV2: React.FC = () => {
  const { execId } = useParams<{ execId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'FAILED'>('ALL');
  const [detailTab, setDetailTab] = useState<'payload' | 'logs' | 'screenshot' | 'assertions'>('payload');
  const [isAutoTracking, setIsAutoTracking] = useState(true);
  const [copied, setCopied] = useState(false);
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

  const copyExecId = () => {
    if (!execId) return;
    navigator.clipboard.writeText(execId);
    setCopied(true);
    toast.success('Execution ID copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  // Mutations
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
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [execId, queryClient]);

  const activeExecution = realtimeData || execution;
  const isRunning = activeExecution?.status === 'RUNNING' || activeExecution?.status === 'QUEUED';

  // Fallback polling
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
      if (!isAutoTracking) return;

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
          const el = document.getElementById(`step-card-${targetId}`);
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

  const hasScreenshots = selectedLog?.outputPayload?.screenshots && selectedLog.outputPayload.screenshots.length > 0;
  const hasAssertions = selectedLog?.outputPayload?.assertions && selectedLog.outputPayload.assertions.length > 0;

  // Auto tab focus change when selected log switches
  useEffect(() => {
    if (selectedLog) {
      if (selectedLog.stepType === 'BROWSER_AUTOMATION' && hasScreenshots) {
        setDetailTab('screenshot');
      } else if (hasAssertions) {
        setDetailTab('assertions');
      } else {
        setDetailTab('payload');
      }
    }
  }, [selectedLogId, selectedLog, hasScreenshots, hasAssertions]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PASSED':
        return <Badge variant="success" className="px-3 py-1 font-bold text-xs uppercase tracking-wider">Passed</Badge>;
      case 'FAILED':
        return <Badge variant="destructive" className="px-3 py-1 font-bold text-xs uppercase tracking-wider">Failed</Badge>;
      case 'RUNNING':
        return <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse px-3 py-1 font-bold text-xs uppercase tracking-wider">Running</Badge>;
      case 'QUEUED':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-3 py-1 font-bold text-xs uppercase tracking-wider">Queued</Badge>;
      case 'CANCELLED':
        return <Badge variant="secondary" className="px-3 py-1 font-bold text-xs uppercase tracking-wider">Cancelled</Badge>;
      default:
        return <Badge variant="secondary" className="px-3 py-1 font-bold text-xs uppercase tracking-wider">{status}</Badge>;
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
      <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded uppercase tracking-wider ${classes}`}>
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
        return <Ban className="h-5 w-5 text-muted-foreground/60 shrink-0" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground/60 shrink-0" />;
    }
  };

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'HTTP_REQUEST':
        return <Globe className="h-5 w-5 text-cyan-400" />;
      case 'ASSERTION':
        return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
      case 'DELAY':
        return <Clock className="h-5 w-5 text-yellow-400" />;
      case 'SET_VARIABLE':
        return <HelpCircle className="h-5 w-5 text-pink-400" />;
      case 'CONDITIONAL':
        return <GitBranch className="h-5 w-5 text-indigo-400" />;
      case 'LOOP':
        return <Repeat className="h-5 w-5 text-purple-400" />;
      case 'SCRIPT':
        return <Terminal className="h-5 w-5 text-teal-400" />;
      case 'LOG':
        return <FileText className="h-5 w-5 text-gray-400" />;
      case 'DATABASE_QUERY':
        return <Database className="h-5 w-5 text-blue-400" />;
      case 'DB_TABLE_VIEW':
        return <Table2 className="h-5 w-5 text-orange-400" />;
      case 'GLOBAL_REF':
        return <LinkIcon className="h-5 w-5 text-amber-400" />;
      case 'PARALLEL':
        return <Split className="h-5 w-5 text-violet-400" />;
      case 'SOAP_REQUEST':
        return <FileCode className="h-5 w-5 text-indigo-400" />;
      case 'BROWSER_AUTOMATION':
        return <MonitorPlay className="h-5 w-5 text-teal-400" />;
      case 'MAINFRAME_TERMINAL':
        return <Monitor className="h-5 w-5 text-lime-400" />;
      default:
        return <ChevronRight className="h-5 w-5 text-foreground" />;
    }
  };

  const getStepStatusOverlay = (status: string) => {
    switch (status) {
      case 'PASSED':
        return (
          <div className="absolute -bottom-1 -right-1 rounded-full p-0.5 bg-background shadow-xs border border-border flex items-center justify-center">
            <CheckCircle2 className="h-3 w-3 text-emerald-500 fill-emerald-500/10" />
          </div>
        );
      case 'FAILED':
        return (
          <div className="absolute -bottom-1 -right-1 rounded-full p-0.5 bg-background shadow-xs border border-border flex items-center justify-center">
            <XCircle className="h-3 w-3 text-rose-500 fill-rose-500/10" />
          </div>
        );
      case 'RUNNING':
        return (
          <div className="absolute -bottom-1 -right-1 rounded-full p-0.5 bg-background shadow-xs border border-border flex items-center justify-center">
            <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
          </div>
        );
      case 'SKIPPED':
        return (
          <div className="absolute -bottom-1 -right-1 rounded-full p-0.5 bg-background shadow-xs border border-border flex items-center justify-center">
            <Ban className="h-3 w-3 text-muted-foreground/60" />
          </div>
        );
      default:
        return (
          <div className="absolute -bottom-1 -right-1 rounded-full p-0.5 bg-background shadow-xs border border-border flex items-center justify-center">
            <Clock className="h-3 w-3 text-muted-foreground/60" />
          </div>
        );
    }
  };

  const getLineComponent = (status: string, index: number) => {
    if (status === 'RUNNING') {
      return (
        <div key={`line-${index}`} className="absolute top-10 bottom-0 w-[2px] left-5 z-0 flex flex-col justify-between overflow-hidden">
          <div className="w-full h-full border-l-2 border-dashed border-blue-400 animate-pulse" />
        </div>
      );
    }
    return (
      <div key={`line-${index}`} className={`absolute top-10 bottom-0 w-[2px] left-5 z-0 ${
        status === 'PASSED' 
          ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' 
          : status === 'FAILED' 
            ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]' 
            : 'bg-border/40'
      }`} />
    );
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
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Sleek dynamic breadcrumbs & back headers */}
      <div className="flex items-center justify-between border-b border-border/30 pb-4">
        <div className="space-y-1">
          <button 
            onClick={() => navigate(-1)} 
            className="flex items-center text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Return to Runs
          </button>
          <div className="flex items-center space-x-3 mt-1.5">
            <h1 className="text-2xl font-black tracking-tight">{activeExecution?.testCaseName || 'Workflow Execution Detail'}</h1>
            {getStatusBadge(activeExecution?.status)}
          </div>
          <div className="flex items-center space-x-2 text-[10px] text-muted-foreground">
            <span>Execution UUID:</span>
            <span className="font-mono text-foreground font-semibold">{execId}</span>
            <button onClick={copyExecId} className="hover:text-foreground transition-colors p-0.5" title="Copy UUID">
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {!isRunning && (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsEmailDialogOpen(true)} className="h-8 text-xs font-bold">
                <Mail className="mr-1.5 h-3.5 w-3.5" /> Email
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadReport} className="h-8 text-xs font-bold">
                <Download className="mr-1.5 h-3.5 w-3.5" /> Export HTML
              </Button>
            </>
          )}
          {isRunning && (
            <Button variant="outline" size="sm" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending} className="h-8 text-xs font-bold border-rose-500/20 text-rose-400 hover:bg-rose-500/10">
              Stop Execution
            </Button>
          )}
          {!isRunning && (
            <Button size="sm" onClick={() => rerunMutation.mutate()} disabled={rerunMutation.isPending} className="h-8 text-xs font-bold">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Restart Run
            </Button>
          )}
        </div>
      </div>

      {/* Grid containing minimal diagnostics stats & micro timeline chart */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass md:col-span-2">
          <CardContent className="p-4 flex items-center justify-between gap-6 h-full">
            <div className="flex items-center space-x-12">
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider">Duration</span>
                <div className="text-xl font-black text-foreground flex items-center">
                  <Clock className="h-4 w-4 text-primary mr-1.5 shrink-0" />
                  {activeExecution?.durationMs ? `${(activeExecution.durationMs / 1000).toFixed(2)}s` : '--'}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider">Target Env</span>
                <div className="text-xl font-black text-foreground">{activeExecution?.environmentName || 'Default'}</div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider">Steps Progress</span>
                <div className="text-xl font-black text-foreground">
                  {activeExecution?.passedSteps} <span className="text-muted-foreground text-sm font-semibold">/ {activeExecution?.totalSteps}</span>
                </div>
              </div>
            </div>
            {activeExecution?.errorMessage && (
              <div className="flex-1 max-w-sm ml-6 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2.5 flex items-start space-x-2 text-rose-400 text-[11px] leading-snug">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="font-semibold line-clamp-2" title={activeExecution.errorMessage}>{activeExecution.errorMessage}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass flex flex-col justify-between overflow-hidden">
          <CardContent className="p-3 pb-0 flex-1 flex flex-col justify-end">
            <MinimalDurationChart steps={execution.stepLogs} />
          </CardContent>
          <div className="bg-secondary/20 border-t border-border/20 py-1.5 px-3 text-[9px] font-mono text-muted-foreground text-center">
            Step Performance Trace Map
          </div>
        </Card>
      </div>

      {/* Split Panels: Steps Navigation Left vs Details Content Right */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[calc(100vh-210px)] min-h-[620px]">
        {/* Left column (2/5): Step Card Navigator */}
        <div className="lg:col-span-2 flex flex-col bg-card/15 border border-border/40 rounded-xl overflow-hidden h-full">
          {/* Controls Header */}
          <div className="p-4 border-b border-border/30 bg-secondary/5 flex items-center justify-between shrink-0">
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Execution Flow</span>
              {!isAutoTracking && isRunning && (
                <button
                  onClick={() => setIsAutoTracking(true)}
                  className="text-[9px] text-blue-400 font-bold hover:underline mt-0.5 flex items-center gap-1 cursor-pointer animate-pulse"
                >
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                  Resume auto follow
                </button>
              )}
            </div>
            
            <div className="flex bg-secondary/30 p-0.5 rounded-lg border border-border/40 shrink-0">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1 text-[10px] font-bold rounded transition-all cursor-pointer ${statusFilter === 'ALL' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('FAILED')}
                className={`px-3 py-1 text-[10px] font-bold rounded transition-all cursor-pointer ${statusFilter === 'FAILED' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Failed
              </button>
            </div>
          </div>

          {/* Steps Scroll Lists */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin">
            {filteredStepLogs.length === 0 ? (
              <div className="text-center py-16 text-xs text-muted-foreground">
                No step logs match the filters.
              </div>
            ) : (
              filteredStepLogs.map((log, idx) => {
                const isSelected = selectedLogId === log.id;
                return (
                  <div key={log.id} className="relative flex items-stretch pb-6 last:pb-0">
                    {/* Visual pipeline connection line segment */}
                    {idx !== filteredStepLogs.length - 1 && getLineComponent(log.status, idx)}
                    
                    {/* Left Column: Icon node frame */}
                    <div className="flex flex-col items-center mr-4 shrink-0 relative z-10">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center border-2 shadow-xs transition-all duration-200 ${
                        isSelected 
                          ? 'border-primary bg-primary/10 shadow-[0_0_10px_rgba(var(--primary),0.2)]'
                          : log.status === 'FAILED'
                            ? 'border-rose-500 bg-rose-500/10'
                            : log.status === 'PASSED'
                              ? 'border-emerald-500/60 bg-emerald-500/5'
                              : 'border-border bg-secondary/20'
                      }`}>
                        {getStepIcon(log.stepType)}
                        {getStepStatusOverlay(log.status)}
                      </div>
                    </div>

                    {/* Right Column: Premium connected card container */}
                    <button
                      id={`step-card-${log.id}`}
                      onClick={() => {
                        setSelectedLogId(log.id);
                        if (log.status !== 'RUNNING') {
                          setIsAutoTracking(false);
                        }
                      }}
                      className={`flex-1 rounded-xl border p-3.5 text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                        isSelected 
                          ? 'border-primary bg-primary/5 shadow-[0_4px_16px_-4px_rgba(var(--primary),0.1)] ring-1 ring-primary/20 scale-[1.01]' 
                          : log.status === 'FAILED'
                            ? 'border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500/40'
                            : log.status === 'PASSED'
                              ? 'border-border/60 hover:bg-secondary/10 hover:border-border'
                              : 'border-border/40 opacity-70 hover:opacity-100 hover:bg-secondary/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 w-full">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-xs text-foreground tracking-tight">{log.stepName}</span>
                            {getStepTypeBadge(log.stepType)}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-1 font-mono">
                            Step {log.sequenceOrder} {log.durationMs !== null && `• ${log.durationMs}ms`}
                          </div>
                        </div>
                        <ChevronRight className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isSelected ? 'translate-x-0.5 text-primary' : ''}`} />
                      </div>

                      {/* Display error message snippet directly on the card if failed */}
                      {log.status === 'FAILED' && log.errorMessage && (
                        <div className="mt-2.5 p-2 rounded-lg bg-rose-500/10 border border-rose-500/15 text-[10px] text-rose-400 font-mono line-clamp-1 w-full">
                          {log.errorMessage}
                        </div>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right column (3/5): Details Panel tabs */}
        <div className="lg:col-span-3 flex flex-col bg-card/15 border border-border/40 rounded-xl overflow-hidden h-full">
          {selectedLog ? (
            <>
              {/* Tab Header Selector */}
              <div className="border-b border-border/30 bg-secondary/5 p-1 flex items-center justify-start space-x-1 shrink-0">
                <button
                  onClick={() => setDetailTab('payload')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded transition-all cursor-pointer ${detailTab === 'payload' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <FileJson className="h-3.5 w-3.5" />
                  <span>Payload Config</span>
                </button>
                <button
                  onClick={() => setDetailTab('logs')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded transition-all cursor-pointer ${detailTab === 'logs' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Terminal className="h-3.5 w-3.5" />
                  <span>Logs & Errors</span>
                </button>
                {selectedLog.stepType === 'BROWSER_AUTOMATION' && hasScreenshots && (
                  <button
                    onClick={() => setDetailTab('screenshot')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded transition-all cursor-pointer ${detailTab === 'screenshot' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    <span>Screenshots ({selectedLog.outputPayload.screenshots.length})</span>
                  </button>
                )}
                {hasAssertions && (
                  <button
                    onClick={() => setDetailTab('assertions')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded transition-all cursor-pointer ${detailTab === 'assertions' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Assertions ({selectedLog.outputPayload.assertions.length})</span>
                  </button>
                )}
              </div>

              {/* Tab Details Content Area */}
              <div className="flex-1 p-4 overflow-y-auto scrollbar-thin">
                {detailTab === 'payload' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    {/* Database format view inside Payload config if output contains rows */}
                    {((selectedLog.stepType === 'DB_TABLE_VIEW' || selectedLog.stepType === 'DATABASE_QUERY') && selectedLog.outputPayload?.rows) ? (
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
                          <div className="overflow-x-auto rounded border border-border/50 max-h-64 scrollbar-thin">
                            <table className="w-full text-[11px] border-collapse">
                              <thead>
                                <tr className="border-b border-border bg-secondary/35 text-left text-muted-foreground font-semibold">
                                  {Object.keys(selectedLog.outputPayload.rows[0]).map((col: string) => (
                                    <th key={col} className="p-2 border-r border-border last:border-r-0 tracking-wider text-[10px] whitespace-nowrap">
                                      {col}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {selectedLog.outputPayload.rows.map((row: Record<string, any>, rIdx: number) => (
                                  <tr key={rIdx} className={`border-b border-border/20 last:border-b-0 ${rIdx % 2 === 0 ? 'bg-background/50' : 'bg-secondary/10'}`}>
                                    {Object.values(row).map((val: any, cIdx: number) => (
                                      <td key={cIdx} className="p-2 border-r border-border/20 last:border-r-0 truncate max-w-xs text-foreground/90">
                                        {val === null || val === undefined ? <span className="text-muted-foreground italic">NULL</span> : String(val)}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase font-sans tracking-wider">SQL Query</span>
                          <pre className="p-4 rounded-xl bg-[#0d1117] text-[#c9d1d9] border border-[#21262d] overflow-x-auto text-[13px] font-mono leading-relaxed shadow-inner w-full">
                            {selectedLog.outputPayload.query}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6 flex flex-col">
                        <div className="space-y-2.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Input Payload Parameters</span>
                          <JsonViewer data={selectedLog.inputPayload} />
                        </div>
                        <div className="space-y-2.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Execution Output Response</span>
                          <JsonViewer data={selectedLog.outputPayload} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {detailTab === 'logs' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between pb-2 border-b border-border/20">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Console Trace</h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Runtime output and execution log results</p>
                      </div>
                    </div>
                    {selectedLog.errorMessage || selectedLog.outputPayload?.logMessage ? (
                      <pre className="p-4 rounded-xl bg-[#0d1117] text-[#e1e4e8] border border-[#21262d] font-mono text-[12px] leading-relaxed whitespace-pre-wrap max-h-[550px] overflow-y-auto scrollbar-thin w-full">
                        {selectedLog.errorMessage ? <span className="text-[#ff7b72] font-semibold">{`Error Trace:\n${selectedLog.errorMessage}\n\n`}</span> : ''}
                        {selectedLog.outputPayload?.logMessage ? <span className="text-[#7ee787]">{`Execution Log:\n${selectedLog.outputPayload.logMessage}`}</span> : ''}
                      </pre>
                    ) : (
                      <div className="text-center py-12 text-xs text-muted-foreground font-mono">No trace logs recorded for this step.</div>
                    )}
                  </div>
                )}

                {detailTab === 'screenshot' && hasScreenshots && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between pb-2 border-b border-border/20">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Screenshots Gallery</h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Visual screenshots captured by browser automation</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedLog.outputPayload.screenshots.map((s: any, sIdx: number) => {
                        const imgPath = `/executions/${execId}/steps/${selectedLog.id}/screenshots/${s.filename}`;
                        return (
                          <div 
                            key={sIdx} 
                            className="border border-border/60 rounded-md overflow-hidden bg-card/40 shadow-sm hover:border-primary transition-all cursor-zoom-in group"
                            onClick={() => setActiveScreenshotUrl(s.filename)}
                          >
                            <div className="w-full h-36 bg-secondary/15 flex items-center justify-center overflow-hidden">
                              <SecureImage 
                                src={imgPath} 
                                alt={s.name} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>
                            <div className="p-2 text-center text-[10px] font-semibold truncate text-muted-foreground border-t border-border/30">
                              {s.name}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {detailTab === 'assertions' && hasAssertions && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between pb-2 border-b border-border/20">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Assertion Checks</h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Validations verified during step runs</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {selectedLog.outputPayload.assertions.map((assertion: any, idx: number) => {
                        const passed = assertion.passed;
                        return (
                          <div 
                            key={idx} 
                            className={`p-3 rounded-lg border flex items-center justify-between ${passed ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-rose-500/20 bg-rose-500/5'}`}
                          >
                            <div className="space-y-0.5 min-w-0 mr-4">
                              <span className="font-semibold text-xs text-foreground block truncate">{assertion.assertionExpression || 'Expression Validate'}</span>
                              <div className="text-[10px] text-muted-foreground font-mono flex items-center flex-wrap gap-1">
                                <span>Expected: {assertion.expectedValue || 'Any'}</span>
                                <span className="text-muted-foreground/40">•</span>
                                <span>Actual: {assertion.actualValue || 'Null'}</span>
                              </div>
                            </div>
                            <Badge variant={passed ? 'success' : 'destructive'} className="text-[9px] uppercase font-black shrink-0 px-2 py-0.5">
                              {passed ? 'Passed' : 'Failed'}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/60 space-y-2">
              <Activity className="h-12 w-12 text-muted-foreground/15" />
              <span className="text-xs">Select any execution step card on the left list to view diagnostics</span>
            </div>
          )}
        </div>
      </div>

      {/* Screenshot Dialog zoom modal */}
      {activeScreenshotUrl && selectedLog && (
        <Dialog isOpen={true} onClose={() => setActiveScreenshotUrl(null)}>
          <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-card border border-border/80 rounded-xl overflow-hidden shadow-2xl max-w-5xl w-full flex flex-col">
              <DialogHeader className="p-4 border-b border-border/30 flex items-center justify-between">
                <div>
                  <DialogTitle className="text-sm font-bold flex items-center">
                    <ImageIcon className="mr-2 h-4 w-4 text-primary" />
                    Fullscreen Capture — {selectedLog.stepName}
                  </DialogTitle>
                </div>
              </DialogHeader>
              <div className="p-4 overflow-auto max-h-[75vh] flex justify-center bg-black/40">
                <SecureImage 
                  src={`/executions/${execId}/steps/${selectedLog.id}/screenshots/${activeScreenshotUrl}`} 
                  className="max-w-full h-auto object-contain rounded border border-border/40"
                />
              </div>
              <DialogFooter className="p-3 bg-secondary/5 border-t border-border/30 flex justify-end">
                <Button onClick={() => setActiveScreenshotUrl(null)} size="sm">Close</Button>
              </DialogFooter>
            </div>
          </div>
        </Dialog>
      )}

      {/* Email Report Dialog */}
      {isEmailDialogOpen && (
        <Dialog isOpen={true} onClose={() => setIsEmailDialogOpen(false)}>
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-card border border-border/80 rounded-xl max-w-md w-full shadow-2xl p-6 space-y-4">
              <DialogHeader>
                <DialogTitle className="text-base font-bold flex items-center">
                  <Mail className="mr-2 h-5 w-5 text-primary" />
                  Email Test Execution Report
                </DialogTitle>
                <p className="text-xs text-muted-foreground">Provide recipient email to dispatch report details</p>
              </DialogHeader>
              <div className="space-y-1.5 pt-2">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Recipient Email Address</label>
                <Input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="h-10 text-xs"
                />
              </div>
              <DialogFooter className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setIsEmailDialogOpen(false)} disabled={emailMutation.isPending}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => emailMutation.mutate(recipientEmail)} disabled={emailMutation.isPending || !recipientEmail.trim()}>
                  {emailMutation.isPending ? 'Sending...' : 'Send Report'}
                </Button>
              </DialogFooter>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};

export default ExecutionDetailPageV2;
