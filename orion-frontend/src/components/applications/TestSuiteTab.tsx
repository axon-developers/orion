import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { cn } from '../../lib/utils';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Button, Input, Textarea, Badge, Dialog, DialogHeader, DialogTitle, DialogFooter, Select
} from '../ui';
import {
  Play, Trash2, Edit2, Plus, Loader2, Calendar, Clock,
  CheckCircle, XCircle, ChevronDown, ChevronUp, ArrowRight, Layers, List
} from 'lucide-react';
import { EnvironmentDto, TestCaseDto, TestSuiteDto, SuiteExecutionDto } from '../../types/api';
import { toast } from 'sonner';

interface TestSuiteTabProps {
  appId: string;
  hasEditAccess: boolean;
}

export const TestSuiteTab: React.FC<TestSuiteTabProps> = ({ appId, hasEditAccess }) => {
  const queryClient = useQueryClient();
  const [isSuiteModalOpen, setIsSuiteModalOpen] = useState(false);
  const [isExecutionsModalOpen, setIsExecutionsModalOpen] = useState(false);
  const [selectedSuite, setSelectedSuite] = useState<TestSuiteDto | null>(null);
  const [activeExecId, setActiveExecId] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cronExpression, setCronExpression] = useState('');
  const [environmentId, setEnvironmentId] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [selectedTestCaseIds, setSelectedTestCaseIds] = useState<string[]>([]);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: suites = [], isLoading: isSuitesLoading } = useQuery<TestSuiteDto[]>({
    queryKey: ['test-suites', appId],
    queryFn: async () => {
      const res = await api.get(`/applications/${appId}/suites`);
      return res.data;
    }
  });

  const { data: environments = [] } = useQuery<EnvironmentDto[]>({
    queryKey: ['environments', appId],
    queryFn: async () => {
      const res = await api.get(`/applications/${appId}/environments`);
      return res.data;
    }
  });

  const { data: testCases } = useQuery<{ content: TestCaseDto[] }>({
    queryKey: ['testcases-list', appId],
    queryFn: async () => {
      const res = await api.get(`/applications/${appId}/testcases?page=0&size=100`);
      return res.data;
    }
  });

  const { data: suiteExecutions = [], refetch: refetchExecs } = useQuery<SuiteExecutionDto[]>({
    queryKey: ['suite-executions', selectedSuite?.id],
    queryFn: async () => {
      const res = await api.get(`/applications/${appId}/suites/${selectedSuite?.id}/executions`);
      return res.data;
    },
    enabled: !!selectedSuite?.id
  });

  const { data: executionDetail } = useQuery<SuiteExecutionDto>({
    queryKey: ['suite-execution-detail', activeExecId],
    queryFn: async () => {
      const res = await api.get(`/applications/${appId}/suites/executions/${activeExecId}`);
      return res.data;
    },
    enabled: !!activeExecId,
    refetchInterval: (query) => {
      // Poll execution status if running
      const data = query.state.data as SuiteExecutionDto | undefined;
      return (data?.status === 'RUNNING' || data?.status === 'QUEUED') ? 1000 : false;
    }
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createOrUpdateSuiteMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        description,
        cronExpression: cronExpression || null,
        environmentId: environmentId || null,
        enabled,
        testCaseIds: selectedTestCaseIds
      };
      if (selectedSuite) {
        await api.put(`/applications/${appId}/suites/${selectedSuite.id}`, payload);
      } else {
        await api.post(`/applications/${appId}/suites`, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-suites', appId] });
      toast.success(selectedSuite ? 'Test Suite updated' : 'Test Suite created');
      setIsSuiteModalOpen(false);
      resetForm();
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message || 'Failed to save Test Suite');
    }
  });

  const deleteSuiteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/applications/${appId}/suites/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-suites', appId] });
      toast.success('Test Suite deleted');
    }
  });

  const runSuiteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/applications/${appId}/suites/${id}/run`);
    },
    onSuccess: () => {
      toast.success('Test Suite run triggered');
      queryClient.invalidateQueries({ queryKey: ['test-suites', appId] });
    }
  });

  // ── Form helpers ───────────────────────────────────────────────────────────
  const resetForm = () => {
    setName('');
    setDescription('');
    setCronExpression('');
    setEnvironmentId(environments[0]?.id || '');
    setEnabled(true);
    setSelectedTestCaseIds([]);
    setSelectedSuite(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsSuiteModalOpen(true);
  };

  const handleOpenEdit = (suite: TestSuiteDto) => {
    setSelectedSuite(suite);
    setName(suite.name);
    setDescription(suite.description || '');
    setCronExpression(suite.cronExpression || '');
    setEnvironmentId(suite.environmentId || '');
    setEnabled(suite.enabled);
    setSelectedTestCaseIds(suite.testCaseIds || []);
    setIsSuiteModalOpen(true);
  };

  const toggleTestCaseSelection = (id: string) => {
    if (selectedTestCaseIds.includes(id)) {
      setSelectedTestCaseIds(selectedTestCaseIds.filter(x => x !== id));
    } else {
      setSelectedTestCaseIds([...selectedTestCaseIds, id]);
    }
  };

  const moveTestCaseOrder = (index: number, direction: 'up' | 'down') => {
    const nextIds = [...selectedTestCaseIds];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= nextIds.length) return;

    const temp = nextIds[index];
    nextIds[index] = nextIds[targetIdx];
    nextIds[targetIdx] = temp;
    setSelectedTestCaseIds(nextIds);
  };

  const getEnvName = (envId?: string) => {
    const env = environments.find(e => e.id === envId);
    return env ? env.name : 'None / Default';
  };

  const getTestCaseName = (tcId: string) => {
    const tc = testCases?.content?.find(t => t.id === tcId);
    return tc ? tc.name : 'Unknown Test Case';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-foreground">Regression Test Suites</h3>
          <p className="text-xs text-muted-foreground">Orchestrate multiple test cases in ordered execution sequences with cron schedules.</p>
        </div>
        {hasEditAccess && (
          <Button size="sm" onClick={handleOpenCreate} className="gap-1.5">
            <Plus className="h-4 w-4" /> Create Suite
          </Button>
        )}
      </div>

      {isSuitesLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : suites.length === 0 ? (
        <Card className="text-center py-12 border-dashed bg-card/20">
          <Layers className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h4 className="font-semibold text-foreground">No test suites found</h4>
          <p className="text-xs text-muted-foreground mt-1">Group your test cases together for regular regression runs.</p>
          {hasEditAccess && (
            <Button size="sm" onClick={handleOpenCreate} className="mt-4">
              Create Test Suite
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {suites.map((suite) => (
            <Card key={suite.id} className="border border-border/50 bg-card/20 hover:border-primary/30 transition-all flex flex-col justify-between group">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <CardTitle className="text-sm font-bold truncate group-hover:text-primary transition-colors">{suite.name}</CardTitle>
                    <CardDescription className="text-xs line-clamp-2 mt-1 min-h-[32px]">{suite.description || 'No description'}</CardDescription>
                  </div>
                  <Badge variant={suite.enabled ? 'success' : 'secondary'}>
                    {suite.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="py-2 flex-1 space-y-3">
                <div className="flex items-center text-xs text-muted-foreground gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Schedule: </span>
                  <span className="font-semibold text-foreground font-mono">{suite.cronExpression || 'Manual Only'}</span>
                </div>
                <div className="flex items-center text-xs text-muted-foreground gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Environment: </span>
                  <span className="font-semibold text-foreground">{getEnvName(suite.environmentId)}</span>
                </div>
                <div className="border-t border-border/10 pt-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Sequence ({suite.testCaseIds?.length || 0} cases)</span>
                  <div className="space-y-1 max-h-[85px] overflow-y-auto pr-1">
                    {suite.testCaseIds?.map((tcId, idx) => (
                      <div key={idx} className="text-[11px] truncate flex items-center gap-1.5 bg-secondary/15 rounded px-2 py-0.5 border border-border/10">
                        <span className="text-primary font-bold">{idx + 1}.</span>
                        <span className="text-foreground/80 font-medium">{getTestCaseName(tcId)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
              <CardContent className="border-t border-border/20 py-2.5 px-6 flex items-center justify-between bg-secondary/10 rounded-b-lg">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setSelectedSuite(suite); setIsExecutionsModalOpen(true); }}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground h-8 px-2"
                >
                  View Runs
                </Button>
                <div className="flex items-center space-x-1">
                  {hasEditAccess && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-emerald-400 hover:bg-emerald-500/10"
                        onClick={() => runSuiteMutation.mutate(suite.id)}
                        disabled={runSuiteMutation.isPending}
                        title="Run Suite Now"
                      >
                        <Play className="h-4 w-4 fill-emerald-400/20" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleOpenEdit(suite)}
                        title="Edit Suite"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteSuiteMutation.mutate(suite.id)}
                        disabled={deleteSuiteMutation.isPending}
                        title="Delete Suite"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── CREATE / EDIT MODAL ──────────────────────────────────────────────── */}
      <Dialog isOpen={isSuiteModalOpen} onClose={() => setIsSuiteModalOpen(false)} size="2xl">
        <DialogHeader>
          <DialogTitle>{selectedSuite ? 'Edit Test Suite' : 'Create Test Suite'}</DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto pr-2">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Suite Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Daily Core Integration Suite" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Enter test scope or notes..." rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Cron Expression (Optional)</label>
              <Input value={cronExpression} onChange={(e) => setCronExpression(e.target.value)} placeholder="e.g. 0 0 12 * * ?" />
              <p className="text-[10px] text-muted-foreground">Spring Cron. Leave blank for manual triggers only.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Target Environment</label>
              <Select
                options={[
                  { value: '', label: 'Default / None' },
                  ...environments.map(e => ({ value: e.id, label: e.name }))
                ]}
                value={environmentId}
                onChange={(e) => setEnvironmentId(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 py-2">
            <input
              type="checkbox"
              id="suiteEnabled"
              className="rounded border-slate-700 h-4 w-4 bg-slate-900 checked:bg-indigo-600 checked:border-indigo-600 text-indigo-600 focus:ring-indigo-500"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <label htmlFor="suiteEnabled" className="text-sm font-semibold text-foreground cursor-pointer select-none">
              Enabled (Runs on schedule if configured)
            </label>
          </div>

          <div className="border-t border-border/20 pt-4 space-y-3">
            <h4 className="text-sm font-bold text-foreground">Select & Sequence Test Cases</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Test Case Pool */}
              <div className="border border-border/30 rounded-lg p-3 bg-secondary/5 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">Available Test Cases</span>
                <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                  {testCases?.content?.map(tc => {
                    const isSelected = selectedTestCaseIds.includes(tc.id);
                    return (
                      <div
                        key={tc.id}
                        onClick={() => toggleTestCaseSelection(tc.id)}
                        className={cn(
                          "text-xs px-3 py-2 rounded-md border cursor-pointer select-none transition-colors flex justify-between items-center",
                          isSelected 
                            ? "bg-primary/10 border-primary/40 text-primary-foreground font-semibold" 
                            : "bg-background/40 border-border/40 hover:border-border"
                        )}
                      >
                        <span>{tc.name}</span>
                        {isSelected && <Badge variant="default" className="text-[9px] py-0 px-1">Selected</Badge>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sorted Selection */}
              <div className="border border-border/30 rounded-lg p-3 bg-secondary/5 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">Execution Order (Top to Bottom)</span>
                <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                  {selectedTestCaseIds.length === 0 ? (
                    <div className="text-center py-12 text-xs text-muted-foreground">Select test cases from the pool to order them.</div>
                  ) : (
                    selectedTestCaseIds.map((tcId, idx) => (
                      <div key={tcId} className="text-xs bg-background border border-border/30 rounded px-3 py-1.5 flex justify-between items-center group/order animate-in fade-in slide-in-from-bottom-1 duration-100">
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-primary font-bold">{idx + 1}.</span>
                          <span className="truncate">{getTestCaseName(tcId)}</span>
                        </div>
                        <div className="flex items-center space-x-0.5 shrink-0 opacity-80 group-hover/order:opacity-100 transition-opacity">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveTestCaseOrder(idx, 'up')}
                            className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === selectedTestCaseIds.length - 1}
                            onClick={() => moveTestCaseOrder(idx, 'down')}
                            className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsSuiteModalOpen(false)}>Cancel</Button>
          <Button onClick={() => createOrUpdateSuiteMutation.mutate()} disabled={createOrUpdateSuiteMutation.isPending || !name.trim() || selectedTestCaseIds.length === 0}>
            {createOrUpdateSuiteMutation.isPending ? 'Saving...' : 'Save Suite'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ── EXECUTIONS MODAL ─────────────────────────────────────────────────── */}
      <Dialog isOpen={isExecutionsModalOpen} onClose={() => { setIsExecutionsModalOpen(false); setActiveExecId(null); }} size="4xl">
        <DialogHeader>
          <DialogTitle>{selectedSuite?.name} - Execution History</DialogTitle>
        </DialogHeader>
        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-h-[70vh] overflow-hidden">
          {/* Runs list */}
          <div className="lg:col-span-5 border-r border-border/10 pr-4 overflow-y-auto space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Execution Runs</span>
            {suiteExecutions.length === 0 ? (
              <div className="text-center py-12 text-xs text-muted-foreground">No execution history available. Run the suite to get started.</div>
            ) : (
              suiteExecutions.map(exec => {
                const isActive = activeExecId === exec.id;
                return (
                  <div
                    key={exec.id}
                    onClick={() => setActiveExecId(exec.id)}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-colors relative space-y-2",
                      isActive 
                        ? "bg-primary/10 border-primary/40 text-primary-foreground font-semibold" 
                        : "bg-secondary/10 border-border/30 hover:border-border/60"
                    )}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono">{exec.createdAt.slice(0, 19).replace('T', ' ')}</span>
                      <Badge variant={
                        exec.status === 'PASSED' ? 'success' :
                        exec.status === 'FAILED' ? 'destructive' :
                        exec.status === 'RUNNING' ? 'outline' : 'secondary'
                      }>
                        {exec.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-muted-foreground font-medium">
                      <span>Cases: {exec.passedCases}/{exec.totalCases} Passed</span>
                      <span>{exec.durationMs ? `${(exec.durationMs / 1000).toFixed(2)}s` : '--'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Run Details */}
          <div className="lg:col-span-7 overflow-y-auto space-y-4">
            {activeExecId && executionDetail ? (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div>
                  <h4 className="text-sm font-bold text-foreground flex items-center justify-between">
                    <span>Execution Run Detail</span>
                    <Badge variant={
                      executionDetail.status === 'PASSED' ? 'success' :
                      executionDetail.status === 'FAILED' ? 'destructive' : 'secondary'
                    }>
                      {executionDetail.status}
                    </Badge>
                  </h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">ID: {executionDetail.id}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs bg-secondary/15 rounded-md p-3 border border-border/10">
                  <div>
                    <span className="text-[10px] text-muted-foreground block uppercase">Triggered By</span>
                    <span className="font-semibold">{executionDetail.triggeredBy}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block uppercase">Duration</span>
                    <span className="font-semibold">{executionDetail.durationMs ? `${(executionDetail.durationMs / 1000).toFixed(2)}s` : '--'}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Test Cases Run List</span>
                  <div className="space-y-2">
                    {executionDetail.cases?.map((c, idx) => (
                      <div key={c.id || idx} className="flex justify-between items-center p-2.5 rounded border border-border/25 bg-background/40">
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-foreground truncate block">{c.testCaseName || 'Unknown TestCase'}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">ID: {c.testCaseId}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={
                            c.status === 'PASSED' ? 'success' :
                            c.status === 'FAILED' ? 'destructive' :
                            c.status === 'RUNNING' ? 'outline' : 'secondary'
                          }>
                            {c.status}
                          </Badge>
                          {c.executionId && (
                            <a
                              href={`/executions/${c.executionId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-primary font-bold hover:underline shrink-0"
                            >
                              Logs
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-24 text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                <List className="h-8 w-8 text-muted-foreground/30" />
                Select an execution run from the left panel to inspect its detail.
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setIsExecutionsModalOpen(false); setActiveExecId(null); }}>Close</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
};
