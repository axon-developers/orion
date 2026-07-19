import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { Dialog, DialogHeader, DialogTitle, DialogFooter, Button, Input, Badge, Card } from '../ui';
import { 
  Variable, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Layers, 
  Search, 
  ExternalLink, 
  Database, 
  Copy,
  Info
} from 'lucide-react';
import { TestStepDto, EnvironmentDto } from '../../types/api';
import { useWorkflowStore } from '../../stores/workflow-store';
import { toast } from 'sonner';

interface VariableLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  appId: string;
  steps: TestStepDto[];
}

export interface VariableAuditItem {
  key: string;
  rawExpression: string;
  category: 'FAKER' | 'ENV' | 'STEP_OUTPUT' | 'DATASET' | 'UNRESOLVED';
  status: 'RESOLVED' | 'AUTO_GENERATED' | 'STEP_ASSIGNED' | 'ORDER_WARNING' | 'DATASET_COL' | 'MISSING';
  sourceDescription: string;
  usedInSteps: { id: string; sequenceOrder: number; name: string; stepType: string }[];
  firstUsedSeq: number;
  assignedInStepSeq?: number;
}

export const VariableLookupModal: React.FC<VariableLookupModalProps> = ({
  isOpen,
  onClose,
  appId,
  steps = [],
}) => {
  const { selectStep } = useWorkflowStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'MISSING' | 'ENV' | 'STEP_OUTPUT' | 'FAKER'>('ALL');

  // Fetch application environments for variable resolution checking
  const { data: environments = [] } = useQuery<EnvironmentDto[]>({
    queryKey: ['environments', appId],
    queryFn: async () => {
      const res = await api.get(`/applications/${appId}/environments`);
      return res.data;
    },
    enabled: isOpen && !!appId,
  });

  // Extract all env variable names across all environments for this app
  const knownEnvKeys = useMemo(() => {
    const set = new Set<string>();
    environments.forEach((env) => {
      if (env.variables && Array.isArray(env.variables)) {
        env.variables.forEach((v) => set.add(v.key));
      }
      if (env.secrets && Array.isArray(env.secrets)) {
        env.secrets.forEach((s) => set.add(s.key));
      }
    });
    return set;
  }, [environments]);

  // Extract & analyze all variable references from workflow steps
  const auditItems = useMemo(() => {
    const map = new Map<string, VariableAuditItem>();

    // Step 1: Identify all steps that set variables & register runtime outputs
    const assignedVarMap = new Map<string, { seqOrder: number; stepName: string; stepId: string }>();

    steps.forEach((step) => {
      const cfg = step.config || {};

      const registerKey = (k?: string) => {
        if (k && k.trim()) {
          const varKey = k.trim();
          if (!assignedVarMap.has(varKey)) {
            assignedVarMap.set(varKey, { seqOrder: step.sequenceOrder, stepName: step.name, stepId: step.id });
          }
        }
      };

      // General single string properties across step types
      registerKey((cfg as any).targetVariable);
      registerKey((cfg as any).saveAsVariable);
      registerKey((cfg as any).variableName);
      registerKey((cfg as any).outputVariable);
      registerKey((cfg as any).tokenVariableName);
      registerKey((cfg as any).responseVariable);
      registerKey((cfg as any).sourceVariable);

      // AUTH_TOKEN step defaults
      if (step.stepType === 'AUTH_TOKEN') {
        registerKey('authToken');
        registerKey('accessToken');
        registerKey('token');
        registerKey('bearerToken');
      }

      // SET_VARIABLE step array
      if (Array.isArray((cfg as any).variables)) {
        (cfg as any).variables.forEach((item: any) => {
          registerKey(item?.variableName || item?.key || item?.name);
        });
      }

      // Extractors array
      if (Array.isArray((cfg as any).extractors)) {
        (cfg as any).extractors.forEach((item: any) => {
          registerKey(item?.variableName || item?.targetVariable || item?.key || item?.name);
        });
      }

      // Scan SCRIPT step body for context.put('var', ...) or context.set('var', ...)
      if (step.stepType === 'SCRIPT' && (cfg as any).script) {
        const scriptText = String((cfg as any).script);
        const scriptVarRegex = /context\.(?:put|set|save)\s*\(\s*['"]([^'"]+)['"]/g;
        let sMatch;
        while ((sMatch = scriptVarRegex.exec(scriptText)) !== null) {
          if (sMatch[1]) registerKey(sMatch[1]);
        }
      }
    });

    // Helper to extract {{var}} and ${var} tokens from string
    const extractTokens = (str: string): { key: string; rawExpression: string }[] => {
      if (!str || typeof str !== 'string') return [];
      const matches: { key: string; rawExpression: string }[] = [];

      // 1. Match Mustache {{variableName}} syntax
      const mustacheRegex = /\{\{([^}]+)\}\}/g;
      let mMatch;
      while ((mMatch = mustacheRegex.exec(str)) !== null) {
        if (mMatch[1]) {
          matches.push({ key: mMatch[1].trim(), rawExpression: mMatch[0] });
        }
      }

      // 2. Match Dollar ${variableName} syntax
      const dollarRegex = /\$\{([^}]+)\}/g;
      let dMatch;
      while ((dMatch = dollarRegex.exec(str)) !== null) {
        if (dMatch[1]) {
          matches.push({ key: dMatch[1].trim(), rawExpression: dMatch[0] });
        }
      }

      return matches;
    };

    // Step 2: Scan each step's name, description, expectedResult & config JSON for variable expressions
    steps.forEach((step) => {
      const fullTextToScan = [
        step.name || '',
        step.description || '',
        step.expectedResult || '',
        JSON.stringify(step.config || {})
      ].join(' ');

      const tokensInStep = extractTokens(fullTextToScan);

      tokensInStep.forEach(({ key, rawExpression }) => {
        if (!map.has(key)) {
          // Categorize and resolve status
          let category: VariableAuditItem['category'] = 'UNRESOLVED';
          let status: VariableAuditItem['status'] = 'MISSING';
          let sourceDesc = 'Not found in Environment or preceding steps';
          let assignedSeq: number | undefined = undefined;

          const cleanKey = key.startsWith('env.') || key.startsWith('global.') ? key.split('.')[1] : key;

          if (key.startsWith('faker.') || ['timestamp', 'now', 'uuid', 'randomInt', 'name', 'phone'].includes(key)) {
            category = 'FAKER';
            status = 'AUTO_GENERATED';
            sourceDesc = 'Built-in Faker Dynamic Generator (Evaluated dynamically at runtime)';
          } else if (key.startsWith('dataset.') || key.startsWith('csv.')) {
            category = 'DATASET';
            status = 'DATASET_COL';
            sourceDesc = `CSV Dataset Column "${key.replace(/^(dataset|csv)\./, '')}" (Provided per row iteration)`;
          } else {
            // Check environment keys (case-insensitive check)
            const envMatched = Array.from(knownEnvKeys).some(k => k.toLowerCase() === cleanKey.toLowerCase() || k.toLowerCase() === key.toLowerCase());

            // Check standard runtime / auth token / response context variables
            const isStandardRuntimeVar = [
              'authtoken', 'accesstoken', 'bearertoken', 'token', 'jwttoken', 'sessiontoken', 'sessionid',
              'auth_token', 'access_token', 'bearer_token', 'response', 'request', 'result', 'status',
              'durationms', 'iterationindex', 'loopindex', 'item', 'row', 'usecase_name', 'usecasename'
            ].includes(key.toLowerCase().replaceAll(/[^a-z0-9_]/g, '')) || key.toLowerCase().startsWith('response.') || key.toLowerCase().startsWith('step');

            if (key.startsWith('env.') || key.startsWith('global.') || envMatched) {
              category = 'ENV';
              status = 'RESOLVED';
              sourceDesc = `Environment Variable / Credential Secret ("${cleanKey}")`;
            } else if (assignedVarMap.has(key) || assignedVarMap.has(cleanKey)) {
              category = 'STEP_OUTPUT';
              const assignInfo = assignedVarMap.get(key) || assignedVarMap.get(cleanKey)!;
              assignedSeq = assignInfo.seqOrder;

              if (assignInfo.seqOrder < step.sequenceOrder) {
                status = 'STEP_ASSIGNED';
                sourceDesc = `Step Output: Created dynamically by Step ${assignInfo.seqOrder} ("${assignInfo.stepName}")`;
              } else {
                status = 'ORDER_WARNING';
                sourceDesc = `Sequence Misorder: Referenced at Step ${step.sequenceOrder} before Step ${assignInfo.seqOrder} creates it!`;
              }
            } else if (isStandardRuntimeVar) {
              category = 'STEP_OUTPUT';
              status = 'STEP_ASSIGNED';
              sourceDesc = `Runtime Context Variable: Assigned dynamically during workflow execution (${key})`;
            } else {
              category = 'UNRESOLVED';
              status = 'MISSING';
              sourceDesc = `Missing: Required by Step ${step.sequenceOrder} (${step.name}) but not found in Environment or earlier steps!`;
            }
          }

          map.set(key, {
            key,
            rawExpression: rawExpression,
            category,
            status,
            sourceDescription: sourceDesc,
            usedInSteps: [{ id: step.id, sequenceOrder: step.sequenceOrder, name: step.name, stepType: step.stepType }],
            firstUsedSeq: step.sequenceOrder,
            assignedInStepSeq: assignedSeq,
          });
        } else {
          const item = map.get(key)!;
          if (!item.usedInSteps.some((s) => s.id === step.id)) {
            item.usedInSteps.push({ id: step.id, sequenceOrder: step.sequenceOrder, name: step.name, stepType: step.stepType });
          }
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => {
      // Show MISSING items first, then by sequence order
      if (a.status === 'MISSING' && b.status !== 'MISSING') return -1;
      if (a.status !== 'MISSING' && b.status === 'MISSING') return 1;
      return a.firstUsedSeq - b.firstUsedSeq;
    });
  }, [steps, knownEnvKeys]);

  // Statistics summaries
  const stats = useMemo(() => {
    const total = auditItems.length;
    const missing = auditItems.filter((i) => i.status === 'MISSING').length;
    const resolved = auditItems.filter((i) => i.status === 'RESOLVED' || i.status === 'AUTO_GENERATED' || i.status === 'STEP_ASSIGNED').length;
    const envCount = auditItems.filter((i) => i.category === 'ENV').length;
    const stepOutputCount = auditItems.filter((i) => i.category === 'STEP_OUTPUT').length;
    const fakerCount = auditItems.filter((i) => i.category === 'FAKER').length;
    return { total, missing, resolved, envCount, stepOutputCount, fakerCount };
  }, [auditItems]);

  // Filtered list
  const filteredItems = useMemo(() => {
    return auditItems.filter((item) => {
      const matchesSearch = item.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            item.sourceDescription.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      if (activeFilter === 'MISSING') return item.status === 'MISSING' || item.status === 'ORDER_WARNING';
      if (activeFilter === 'ENV') return item.category === 'ENV';
      if (activeFilter === 'STEP_OUTPUT') return item.category === 'STEP_OUTPUT';
      if (activeFilter === 'FAKER') return item.category === 'FAKER';

      return true;
    });
  }, [auditItems, searchTerm, activeFilter]);

  const handleJumpToStep = (stepId: string) => {
    selectStep(stepId);
    onClose();
    toast.info('Navigated to step in Workflow Designer');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied "${text}" to clipboard`);
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} size="5xl" className="max-w-5xl xl:max-w-6xl w-full">
      <DialogHeader className="border-b border-border/40 pb-4">
        <DialogTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-indigo-400 shrink-0">
              <Variable className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-foreground">Workflow Variable Inspector & Audit</h3>
              <p className="text-xs text-muted-foreground font-normal">
                Inspect variable placeholders (e.g. <code className="text-primary font-mono text-[11px]">{"{{baseUrl}}"}</code> or <code className="text-primary font-mono text-[11px]">{"${var}"}</code>), resolution status, and sources.
              </p>
            </div>
          </div>
          {stats.missing > 0 ? (
            <Badge variant="destructive" className="flex items-center space-x-1.5 py-1 px-3 text-xs font-bold shrink-0 animate-pulse">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{stats.missing} Required Variable(s) Missing</span>
            </Badge>
          ) : (
            <Badge variant="success" className="flex items-center space-x-1.5 py-1 px-3 text-xs font-bold shrink-0">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>All {stats.total} Variables Resolved</span>
            </Badge>
          )}
        </DialogTitle>
      </DialogHeader>

      <div className="p-6 space-y-5 min-h-[480px] max-h-[75vh] overflow-y-auto">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-card/40 border-border/40 p-3 flex flex-col justify-between">
            <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Total Placeholders</span>
            <div className="text-xl font-extrabold text-foreground mt-1">{stats.total}</div>
          </Card>
          <Card className={`p-3 flex flex-col justify-between ${stats.missing > 0 ? 'bg-rose-500/10 border-rose-500/30' : 'bg-card/40 border-border/40'}`}>
            <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Unresolved / Missing</span>
            <div className={`text-xl font-extrabold mt-1 ${stats.missing > 0 ? 'text-rose-400' : 'text-foreground'}`}>{stats.missing}</div>
          </Card>
          <Card className="bg-card/40 border-border/40 p-3 flex flex-col justify-between">
            <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Environment Vars</span>
            <div className="text-xl font-extrabold text-foreground mt-1">{stats.envCount}</div>
          </Card>
          <Card className="bg-card/40 border-border/40 p-3 flex flex-col justify-between">
            <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Step Outputs</span>
            <div className="text-xl font-extrabold text-foreground mt-1">{stats.stepOutputCount}</div>
          </Card>
        </div>

        {/* Filter Controls & Search */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-secondary/20 p-2.5 rounded-lg border border-border/30">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search variable key or step..."
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 shrink-0">
            <button
              onClick={() => setActiveFilter('ALL')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                activeFilter === 'ALL' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              All ({stats.total})
            </button>
            <button
              onClick={() => setActiveFilter('MISSING')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center space-x-1 ${
                activeFilter === 'MISSING' ? 'bg-rose-500 text-white shadow' : 'text-rose-400 hover:bg-rose-500/10'
              }`}
            >
              <AlertTriangle className="h-3 w-3" />
              <span>Missing ({stats.missing})</span>
            </button>
            <button
              onClick={() => setActiveFilter('ENV')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                activeFilter === 'ENV' ? 'bg-indigo-600 text-white shadow' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              Environment ({stats.envCount})
            </button>
            <button
              onClick={() => setActiveFilter('STEP_OUTPUT')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                activeFilter === 'STEP_OUTPUT' ? 'bg-cyan-600 text-white shadow' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              Step Outputs ({stats.stepOutputCount})
            </button>
            <button
              onClick={() => setActiveFilter('FAKER')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                activeFilter === 'FAKER' ? 'bg-amber-600 text-white shadow' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              Faker ({stats.fakerCount})
            </button>
          </div>
        </div>

        {/* Variables Cards Grid */}
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12 min-h-[260px] border border-dashed border-border/40 rounded-xl bg-card/10">
            <Variable className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm font-semibold text-muted-foreground">No variables match your filter criteria.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => {
              let badgeVariant: 'success' | 'destructive' | 'secondary' | 'warning' = 'secondary';
              let badgeLabel = item.status as string;
              let badgeIcon = <CheckCircle2 className="h-3.5 w-3.5" />;

              if (item.status === 'RESOLVED') {
                badgeVariant = 'success';
                badgeLabel = 'RESOLVED IN ENV';
              } else if (item.status === 'AUTO_GENERATED') {
                badgeVariant = 'secondary';
                badgeLabel = 'FAKER DYNAMIC';
                badgeIcon = <Sparkles className="h-3.5 w-3.5 text-amber-400" />;
              } else if (item.status === 'STEP_ASSIGNED') {
                badgeVariant = 'secondary';
                badgeLabel = 'STEP ASSIGNED';
                badgeIcon = <Layers className="h-3.5 w-3.5 text-cyan-400" />;
              } else if (item.status === 'ORDER_WARNING') {
                badgeVariant = 'warning';
                badgeLabel = 'ORDER MISMATCH';
                badgeIcon = <AlertTriangle className="h-3.5 w-3.5" />;
              } else if (item.status === 'DATASET_COL') {
                badgeVariant = 'secondary';
                badgeLabel = 'DATASET COLUMN';
                badgeIcon = <Database className="h-3.5 w-3.5 text-purple-400" />;
              } else if (item.status === 'MISSING') {
                badgeVariant = 'destructive';
                badgeLabel = 'REQUIRED & MISSING';
                badgeIcon = <AlertTriangle className="h-3.5 w-3.5" />;
              }

              return (
                <Card 
                  key={item.key} 
                  className={`p-4 border transition-all ${
                    item.status === 'MISSING' 
                      ? 'border-rose-500/40 bg-rose-500/5 shadow-xs' 
                      : 'border-border/40 bg-card/20 hover:border-primary/30'
                  }`}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    {/* Left Section: Variable Name & Status */}
                    <div className="lg:col-span-7 space-y-2.5 min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1.5">
                        <code className="font-mono text-sm font-black text-foreground bg-secondary/50 px-2.5 py-1 rounded-md border border-border/60 flex items-center space-x-2 shrink-0">
                          <span>{item.rawExpression}</span>
                          <button
                            onClick={() => copyToClipboard(item.rawExpression)}
                            className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                            title="Copy variable expression"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </code>

                        <Badge variant={badgeVariant} className="text-[10px] font-extrabold flex items-center space-x-1 py-1 px-2.5 shrink-0">
                          {badgeIcon}
                          <span>{badgeLabel}</span>
                        </Badge>
                      </div>

                      {/* Source Details Box */}
                      <div className="bg-secondary/30 border border-border/40 rounded-lg p-2.5 text-xs">
                        <div className="flex items-center space-x-1.5 font-bold text-foreground mb-0.5">
                          <Info className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span>Resolution Source:</span>
                        </div>
                        <p className="text-muted-foreground font-medium leading-relaxed pl-5">
                          {item.sourceDescription}
                        </p>
                      </div>
                    </div>

                    {/* Right Section: Referencing Steps List */}
                    <div className="lg:col-span-5 space-y-1.5 border-t lg:border-t-0 lg:border-l border-border/40 pt-3 lg:pt-0 lg:pl-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider">
                          Referenced In ({item.usedInSteps.length} Step{item.usedInSteps.length > 1 ? 's' : ''}):
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                        {item.usedInSteps.map((stepRef) => (
                          <button
                            key={stepRef.id}
                            onClick={() => handleJumpToStep(stepRef.id)}
                            className="px-2.5 py-1 rounded-md bg-secondary/60 hover:bg-primary/20 hover:text-primary border border-border/40 text-xs font-bold text-foreground transition-all flex items-center space-x-1.5 cursor-pointer group shrink-0"
                            title={`Jump to Step ${stepRef.sequenceOrder}: ${stepRef.name}`}
                          >
                            <span>Step {stepRef.sequenceOrder}: {stepRef.name}</span>
                            <ExternalLink className="h-3 w-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <DialogFooter className="border-t border-border/40 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <p className="text-xs text-muted-foreground">
          Tip: Required variables can be configured in your Environment settings or produced dynamically by a preceding step.
        </p>
        <Button onClick={onClose} variant="outline" size="sm" className="shrink-0">
          Close Inspector
        </Button>
      </DialogFooter>
    </Dialog>
  );
};
