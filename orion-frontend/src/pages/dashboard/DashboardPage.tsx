import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button } from '../../components/ui';
import { 
  PlayCircle, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  TrendingUp, 
  Clock, 
  ExternalLink,
  Boxes,
  Activity
} from 'lucide-react';
import { ExecutionDto, ExecutionStatsDto } from '../../types/api';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery<ExecutionStatsDto>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await api.get('/dashboard/execution-stats');
      return res.data;
    },
    refetchInterval: 5000, // Poll stats every 5s
  });

  // Fetch recent executions
  const { data: recentExecs, isLoading: execsLoading } = useQuery<{ content: ExecutionDto[] }>({
    queryKey: ['recent-executions'],
    queryFn: async () => {
      const res = await api.get('/executions?page=0&size=5');
      return res.data;
    },
    refetchInterval: 5000, // Poll executions
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
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-primary/30 via-cyan-500/5 to-transparent border border-primary/20 rounded-xl p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
            Platform Overview
          </h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            Design step-by-step test workflows, configure variables, and monitor executions in real time.
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => navigate('/applications')} size="lg" className="shrink-0">
            <Boxes className="mr-2 h-5 w-5" />
            Build Test Cases
          </Button>
        </div>
      </div>

      {/* Stats row */}
      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="h-32 flex items-center justify-center border border-border/50">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          <Card className="border border-border/50 relative overflow-hidden bg-card/40 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Executions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-foreground">{stats?.totalExecutions || 0}</div>
              <div className="absolute right-4 bottom-4 h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Activity className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/50 relative overflow-hidden bg-card/40 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Passed Runs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-emerald-400">{stats?.passedExecutions || 0}</div>
              <div className="absolute right-4 bottom-4 h-12 w-12 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <CheckCircle className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/50 relative overflow-hidden bg-card/40 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-rose-400">Failed Runs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-rose-400">{stats?.failedExecutions || 0}</div>
              <div className="absolute right-4 bottom-4 h-12 w-12 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
                <XCircle className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/50 relative overflow-hidden bg-card/40 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Pass Rate</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-cyan-400">
                {stats?.passRate ? `${stats.passRate.toFixed(1)}%` : '0%'}
              </div>
              <div className="absolute right-4 bottom-4 h-12 w-12 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                <TrendingUp className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Executions */}
        <Card className="lg:col-span-2 border border-border/50 bg-card/20 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center justify-between">
              <span>Recent Test Runs</span>
              <span className="text-xs text-muted-foreground font-normal">Real-time status</span>
            </CardTitle>
            <CardDescription>The latest test case execution records</CardDescription>
          </CardHeader>
          <CardContent>
            {execsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !recentExecs?.content || recentExecs.content.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <PlayCircle className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <h3 className="text-sm font-semibold text-foreground">No execution history</h3>
                <p className="text-xs text-muted-foreground mt-1">Start by triggering test runs inside an application.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {recentExecs.content.map((exec) => (
                  <div key={exec.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <Link 
                          to={`/executions/${exec.id}`} 
                          className="font-semibold text-sm hover:text-primary transition-colors truncate block"
                        >
                          {exec.testCaseName || `Run #${exec.id.substring(0, 8)}`}
                        </Link>
                        {getStatusBadge(exec.status)}
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        <span className="flex items-center">
                          <Clock className="mr-1 h-3.5 w-3.5" />
                          {exec.durationMs ? `${(exec.durationMs / 1000).toFixed(2)}s` : '--'}
                        </span>
                        <span>Env: <span className="text-foreground font-medium">{exec.environmentName || 'Default'}</span></span>
                        <span>Steps: {exec.passedSteps}/{exec.totalSteps}</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/executions/${exec.id}`)}>
                      Logs
                      <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Help / Activity Panel */}
        <Card className="border border-border/50 bg-card/20 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Quick Guide</CardTitle>
            <CardDescription>How to design and run test cases</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="flex space-x-3">
              <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">1</div>
              <p>Create an <strong>Application</strong> container to represent your microservice or system under test.</p>
            </div>
            <div className="flex space-x-3">
              <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">2</div>
              <p>Set up one or more <strong>Environments</strong> (e.g. staging, sandbox) holding variables like URLs and secrets.</p>
            </div>
            <div className="flex space-x-3">
              <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">3</div>
              <p>Design a <strong>Test Case</strong> workflow by layering HTTP requests, extraction variables, and status validations.</p>
            </div>
            <div className="flex space-x-3">
              <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">4</div>
              <p>Trigger the execution and watch step outputs resolve with real-time logs.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
export default DashboardPage;
