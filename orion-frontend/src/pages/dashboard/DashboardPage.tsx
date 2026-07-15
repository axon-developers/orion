import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button, Skeleton } from '../../components/ui';
import { 
  PlayCircle, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  Clock, 
  ExternalLink,
  Boxes,
  Activity,
  Globe,
  Users
} from 'lucide-react';
import { ExecutionDto, ExecutionStatsDto, ExecutionTrendDto } from '../../types/api';
import { useAuthStore } from '../../stores/auth-store';
import { useSystemSettingsStore } from '../../stores/system-settings-store';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { getSettingInt } = useSystemSettingsStore();
  const pollInterval = getSettingInt('ui.dashboard_poll_interval_ms', 5000);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PASSED' | 'FAILED' | 'RUNNING'>('ALL');

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery<ExecutionStatsDto>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await api.get('/dashboard/execution-stats');
      return res.data;
    },
    refetchInterval: pollInterval,
  });

  // Fetch trend
  const { data: trend, isLoading: trendLoading } = useQuery<ExecutionTrendDto[]>({
    queryKey: ['dashboard-trend'],
    queryFn: async () => {
      const res = await api.get('/dashboard/execution-trend?days=7');
      return res.data;
    },
    refetchInterval: pollInterval,
  });

  // Fetch recent executions
  const { data: recentExecs, isLoading: execsLoading } = useQuery<{ content: ExecutionDto[] }>({
    queryKey: ['recent-executions'],
    queryFn: async () => {
      const res = await api.get('/executions?page=0&size=5');
      return res.data;
    },
    refetchInterval: pollInterval,
  });

  // Process trend data from backend for chart
  const trendData = useMemo(() => {
    if (!trend) return [];
    return trend.map((t) => ({
      name: t.date,
      Passed: t.passed,
      Failed: t.failed,
    }));
  }, [trend]);

  const filteredExecs = useMemo(() => {
    if (!recentExecs?.content) return [];
    if (statusFilter === 'ALL') return recentExecs.content;
    return recentExecs.content.filter(e => e.status === statusFilter);
  }, [recentExecs?.content, statusFilter]);

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
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Platform Overview</h1>
          <p className="text-muted-foreground mt-1">Design step-by-step test workflows, configure variables, and monitor executions in real time</p>
        </div>
      </div>

      {/* Quick Actions Panel */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Button 
          variant="outline" 
          onClick={() => navigate('/applications')}
          className="glass-panel hover:bg-primary/10 hover:border-primary/30 h-14 flex items-center justify-start px-4 space-x-3 text-xs font-bold transition-all cursor-pointer border border-border"
        >
          <Boxes className="h-5 w-5 text-primary shrink-0" />
          <div className="text-left min-w-0">
            <div className="text-foreground truncate text-xs font-bold">Build Test Cases</div>
            <div className="text-[10px] text-muted-foreground font-normal truncate">Create workflow steps</div>
          </div>
        </Button>
        <Button 
          variant="outline" 
          onClick={() => navigate('/executions')}
          className="glass-panel hover:bg-cyan-500/10 hover:border-cyan-500/30 h-14 flex items-center justify-start px-4 space-x-3 text-xs font-bold transition-all cursor-pointer border border-border"
        >
          <Activity className="h-5 w-5 text-cyan-400 shrink-0" />
          <div className="text-left min-w-0">
            <div className="text-foreground truncate text-xs font-bold">View Executions</div>
            <div className="text-[10px] text-muted-foreground font-normal truncate">Check run history & logs</div>
          </div>
        </Button>
        {user?.role === 'ADMIN' && (
          <>
            <Button 
              variant="outline" 
              onClick={() => navigate('/global/env-configs')}
              className="glass-panel hover:bg-lime-500/10 hover:border-lime-500/30 h-14 flex items-center justify-start px-4 space-x-3 text-xs font-bold transition-all cursor-pointer border border-border"
            >
              <Globe className="h-5 w-5 text-lime-400 shrink-0" />
              <div className="text-left min-w-0">
                <div className="text-foreground truncate text-xs font-bold">Global Configs</div>
                <div className="text-[10px] text-muted-foreground font-normal truncate">Environments & variables</div>
              </div>
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/admin/users')}
              className="glass-panel hover:bg-indigo-500/10 hover:border-indigo-500/30 h-14 flex items-center justify-start px-4 space-x-3 text-xs font-bold transition-all cursor-pointer border border-border"
            >
              <Users className="h-5 w-5 text-indigo-400 shrink-0" />
              <div className="text-left min-w-0">
                <div className="text-foreground truncate text-xs font-bold">User Management</div>
                <div className="text-[10px] text-muted-foreground font-normal truncate">Manage roles & access</div>
              </div>
            </Button>
          </>
        )}
      </div>

      {/* Stats row */}
      {statsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          <Card className="glass relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300 cursor-default">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Executions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-foreground">{stats?.totalExecutions || 0}</div>
              <div className="absolute right-4 bottom-4 h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Activity className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300 cursor-default">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Passed Runs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-emerald-400">{stats?.passedExecutions || 0}</div>
              <div className="absolute right-4 bottom-4 h-12 w-12 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                <CheckCircle className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300 cursor-default">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-rose-400">Failed Runs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-rose-400">{stats?.failedExecutions || 0}</div>
              <div className="absolute right-4 bottom-4 h-12 w-12 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400 group-hover:bg-rose-500 group-hover:text-white transition-colors">
                <XCircle className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300 cursor-default">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Pass Rate</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-cyan-400">
                {stats?.passRate ? `${stats.passRate.toFixed(1)}%` : '0%'}
              </div>
              <div className="absolute right-4 bottom-4 h-12 w-12 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white transition-colors">
                <TrendingUp className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300 cursor-default">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-yellow-400">Avg Duration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-yellow-400">
                {stats?.avgDurationMs ? `${(stats.avgDurationMs / 1000).toFixed(2)}s` : '0.00s'}
              </div>
              <div className="absolute right-4 bottom-4 h-12 w-12 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-400 group-hover:bg-yellow-500 group-hover:text-white transition-colors">
                <Clock className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Trend Chart */}
        <Card className="lg:col-span-2 glass">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Execution Trend (7 Days)</CardTitle>
            <CardDescription>Pass and failure rate over the last week</CardDescription>
          </CardHeader>
          <CardContent>
            {trendLoading ? (
               <Skeleton className="w-full h-[300px] rounded-lg" />
            ) : (
              <div className="h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPassed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Area type="monotone" dataKey="Passed" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorPassed)" />
                    <Area type="monotone" dataKey="Failed" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorFailed)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Executions */}
        <Card className="glass">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg font-bold">Recent Test Runs</CardTitle>
                <CardDescription>Latest test executions</CardDescription>
              </div>
              <div className="flex bg-secondary/30 p-0.5 rounded-lg border border-border/40 shrink-0">
                {(['ALL', 'PASSED', 'FAILED', 'RUNNING'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-2 py-0.5 text-[9px] font-bold rounded transition-all cursor-pointer ${statusFilter === filter ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {filter === 'ALL' ? 'All' : filter === 'PASSED' ? 'Passed' : filter === 'FAILED' ? 'Failed' : 'Running'}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {execsLoading ? (
              <div className="space-y-4">
                 {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="w-full h-16 rounded-md" />
                 ))}
              </div>
            ) : filteredExecs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <PlayCircle className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <h3 className="text-sm font-semibold text-foreground">No matching runs</h3>
                <p className="text-xs text-muted-foreground mt-1">No executions found with status: {statusFilter.toLowerCase()}</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {filteredExecs.map((exec) => (
                  <div key={exec.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-2 group">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <Link 
                          to={`/executions/${exec.id}`} 
                          className="font-semibold text-sm hover:text-primary transition-colors truncate block"
                        >
                          {exec.testCaseName || `Run #${exec.id.substring(0, 8)}`}
                        </Link>
                      </div>
                      <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                        <span className="flex items-center">
                          <Clock className="mr-1 h-3 w-3" />
                          {exec.durationMs ? `${(exec.durationMs / 1000).toFixed(2)}s` : '--'}
                        </span>
                        <span>{exec.passedSteps}/{exec.totalSteps}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                       {getStatusBadge(exec.status)}
                       <Link 
                          to={`/executions/${exec.id}`} 
                          className="text-[10px] uppercase font-bold text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100 flex items-center"
                       >
                         Logs <ExternalLink className="ml-1 h-3 w-3" />
                       </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
export default DashboardPage;
