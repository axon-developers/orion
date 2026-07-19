import React, { useState, useMemo } from 'react';
import { 
  Button, Input, Badge, Tabs, TabsList, TabsTrigger, TabsContent, Card, CardHeader, CardTitle, CardContent 
} from '../ui';
import { 
  CheckCircle, XCircle, AlertTriangle, Download, Sparkles, Layers, List, Table, 
  Code, RefreshCw, Plus, Edit2, Check, X, Search, ChevronRight, CornerDownRight, ArrowRight, ShieldCheck
} from 'lucide-react';
import { GeneratorPreviewPayload, OperationPreview, UseCaseRow } from '../../types/api';
import api from '../../lib/api';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface GeneratorPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  payload: GeneratorPreviewPayload;
  appId: string;
}

export const GeneratorPreviewModal: React.FC<GeneratorPreviewModalProps> = ({
  isOpen,
  onClose,
  payload: initialPayload,
  appId,
}) => {
  const navigate = useNavigate();
  const [payload, setPayload] = useState<GeneratorPreviewPayload>(initialPayload);
  const [selectedOpIndex, setSelectedOpIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'usecases' | 'csv' | 'variables' | 'steps'>('usecases');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [editingRowIdx, setEditingRowIdx] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<string>('');

  if (!isOpen || !payload || !payload.operations) return null;

  const currentOp = payload.operations[selectedOpIndex] || payload.operations[0];

  // ── Computed Summary Stats ────────────────────────────────────────────────
  const summaryStats = useMemo(() => {
    let totalSelectedUseCases = 0;
    let includedOps = 0;
    const activeTags = new Set<string>();

    payload.operations.forEach((op) => {
      if (op.included) {
        const selectedUseCases = op.useCases.filter((uc) => uc.selected);
        if (selectedUseCases.length > 0) {
          includedOps++;
          totalSelectedUseCases += selectedUseCases.length;
          (op.tags || ['Untagged']).forEach((t) => activeTags.add(t));
        }
      }
    });

    const groupBy = payload.options?.groupBy || 'TAG';
    let estimatedTCs = 1;
    if (groupBy === 'OPERATION') {
      estimatedTCs = includedOps;
    } else if (groupBy === 'TAG') {
      estimatedTCs = Math.max(1, activeTags.size);
    } else {
      estimatedTCs = 1;
    }

    return {
      includedOps,
      totalSelectedUseCases,
      totalStepsToCreate: includedOps * 4,
      estimatedTCs,
    };
  }, [payload]);

  // ── Operations Grouped by Tag for Left Sidebar ───────────────────────────
  const groupedOperations = useMemo(() => {
    const map = new Map<string, { op: OperationPreview; originalIndex: number }[]>();

    payload.operations.forEach((op, index) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const match = op.path.toLowerCase().includes(query) || 
                      op.summary.toLowerCase().includes(query) ||
                      op.method.toLowerCase().includes(query);
        if (!match) return;
      }

      const primaryTag = op.tags && op.tags.length > 0 ? op.tags[0] : 'Untagged';
      if (!map.has(primaryTag)) map.set(primaryTag, []);
      map.get(primaryTag)!.push({ op, originalIndex: index });
    });

    return map;
  }, [payload.operations, searchQuery]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const toggleOperationIncluded = (index: number) => {
    setPayload((prev) => {
      const nextOps = [...prev.operations];
      nextOps[index] = { ...nextOps[index], included: !nextOps[index].included };
      return { ...prev, operations: nextOps };
    });
  };

  const toggleUseCaseSelected = (opIndex: number, ucIndex: number) => {
    setPayload((prev) => {
      const nextOps = [...prev.operations];
      const targetOp = { ...nextOps[opIndex] };
      const nextUseCases = [...targetOp.useCases];

      nextUseCases[ucIndex] = {
        ...nextUseCases[ucIndex],
        selected: !nextUseCases[ucIndex].selected,
      };

      targetOp.useCases = nextUseCases;
      targetOp.selectedCount = nextUseCases.filter((u) => u.selected).length;
      nextOps[opIndex] = targetOp;

      return { ...prev, operations: nextOps };
    });
  };

  const handleStartRename = (ucIndex: number, currentName: string) => {
    setEditingRowIdx(ucIndex);
    setEditingName(currentName);
  };

  const handleSaveRename = (opIndex: number, ucIndex: number) => {
    if (!editingName.trim()) return;

    setPayload((prev) => {
      const nextOps = [...prev.operations];
      const targetOp = { ...nextOps[opIndex] };
      const nextUseCases = [...targetOp.useCases];

      const oldName = nextUseCases[ucIndex].usecaseName;
      const newName = editingName.trim();

      const updatedValues = { ...nextUseCases[ucIndex].values };
      updatedValues.usecase_name = newName;

      nextUseCases[ucIndex] = {
        ...nextUseCases[ucIndex],
        usecaseName: newName,
        values: updatedValues,
      };

      // Also update CSV template row if exists
      if (targetOp.csvTemplate && targetOp.csvTemplate.rows[ucIndex]) {
        const nextCsvRows = [...targetOp.csvTemplate.rows];
        nextCsvRows[ucIndex] = {
          ...nextCsvRows[ucIndex],
          usecaseName: newName,
          values: updatedValues,
        };
        targetOp.csvTemplate = { ...targetOp.csvTemplate, rows: nextCsvRows };
      }

      targetOp.useCases = nextUseCases;
      nextOps[opIndex] = targetOp;

      return { ...prev, operations: nextOps };
    });

    setEditingRowIdx(null);
  };

  const handleCellEdit = (opIndex: number, ucIndex: number, headerKey: string, newValue: string) => {
    setPayload((prev) => {
      const nextOps = [...prev.operations];
      const targetOp = { ...nextOps[opIndex] };
      const nextUseCases = [...targetOp.useCases];

      const updatedValues = { ...nextUseCases[ucIndex].values, [headerKey]: newValue };
      nextUseCases[ucIndex] = { ...nextUseCases[ucIndex], values: updatedValues };

      if (headerKey === 'usecase_name') {
        nextUseCases[ucIndex].usecaseName = newValue;
      }

      targetOp.useCases = nextUseCases;
      nextOps[opIndex] = targetOp;

      return { ...prev, operations: nextOps };
    });
  };

  const handleAddCustomRow = (opIndex: number) => {
    setPayload((prev) => {
      const nextOps = [...prev.operations];
      const targetOp = { ...nextOps[opIndex] };
      const headers = targetOp.csvTemplate?.headers || ['usecase_name', 'expected_status_code'];

      const newValues: Record<string, string> = {};
      headers.forEach((h) => {
        if (h === 'usecase_name') newValues[h] = `custom_case_${targetOp.useCases.length + 1}`;
        else if (h === 'expected_status_code') newValues[h] = '200';
        else newValues[h] = 'test_value';
      });

      const newRow: UseCaseRow = {
        usecaseName: newValues.usecase_name,
        usecaseType: 'BASE',
        expectedStatusCode: '200',
        isNegativeCase: false,
        values: newValues,
        selected: true,
        notes: 'User-added custom scenario',
      };

      const nextUseCases = [...targetOp.useCases, newRow];
      targetOp.useCases = nextUseCases;
      targetOp.selectedCount = nextUseCases.filter((u) => u.selected).length;
      nextOps[opIndex] = targetOp;

      return { ...prev, operations: nextOps };
    });

    toast.success('Custom use-case scenario added');
  };

  const handleDownloadCsv = (op: OperationPreview) => {
    if (!op.csvTemplate || !op.csvTemplate.headers) return;

    const headers = op.csvTemplate.headers;
    const selectedRows = op.useCases.filter((u) => u.selected);

    let csvContent = headers.join(',') + '\n';
    selectedRows.forEach((row) => {
      const line = headers.map((h) => {
        const val = row.values[h] || '';
        return val.includes(',') ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(',');
      csvContent += line + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${op.method.toLowerCase()}_${op.path.replace(/[^a-zA-Z0-9]/g, '_')}_testdata.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAllCsvs = () => {
    let count = 0;
    payload.operations.forEach((op) => {
      if (op.included && op.useCases.some((u) => u.selected)) {
        setTimeout(() => {
          handleDownloadCsv(op);
        }, count * 300);
        count++;
      }
    });

    if (count > 0) {
      toast.success(`Downloading ${count} CSV dataset templates...`);
    } else {
      toast.error('No included operations with selected scenarios to download');
    }
  };

  const handleConfirmAndGenerate = async () => {
    if (summaryStats.includedOps === 0) {
      toast.error('No operations or use-cases are selected for generation');
      return;
    }

    setIsGenerating(true);
    try {
      const res = await api.post(`/applications/${appId}/testcases/generate-advanced/confirm`, payload);
      const result = res.data;

      toast.success(
        `Successfully generated ${result.testCasesCreated} test cases with ${result.totalStepsGenerated} steps across ${result.totalUseCasesGenerated} use cases!`
      );

      onClose();

      // Navigate to the first generated test case in designer if available
      if (result.testCases && result.testCases.length > 0) {
        navigate(`/applications/${appId}/testcases/${result.testCases[0].testCaseId}/designer`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to generate test cases');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur flex flex-col">
      {/* ── Top Summary Header Bar ─────────────────────────────────────────── */}
      <header className="px-6 py-4 border-b border-border bg-card flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">{payload.specTitle}</h2>
              <Badge variant="outline" className="text-xs">
                v{payload.specVersion}
              </Badge>
              <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-0 text-xs">
                {payload.options?.groupBy === 'TAG'
                  ? 'Grouped By Tag'
                  : payload.options?.groupBy === 'OPERATION'
                  ? 'Per Operation'
                  : 'Single Suite'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Preview & refine generated use-cases before creating actual workflow steps
            </p>
          </div>
        </div>

        {/* Real-time Summary Pills */}
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="bg-muted px-3 py-1.5 rounded-lg border border-border">
            <span className="text-muted-foreground">Included Operations:</span>{' '}
            <span className="font-bold text-foreground">{summaryStats.includedOps}</span> / {payload.totalOperationsFound}
          </div>

          <div className="bg-muted px-3 py-1.5 rounded-lg border border-border">
            <span className="text-muted-foreground">Total Loop Iterations:</span>{' '}
            <span className="font-bold text-primary">{summaryStats.totalSelectedUseCases}</span>
          </div>

          <div className="bg-muted px-3 py-1.5 rounded-lg border border-border">
            <span className="text-muted-foreground">Test Cases to Create:</span>{' '}
            <span className="font-bold text-foreground">{summaryStats.estimatedTCs}</span>
          </div>

          <div className="bg-muted px-3 py-1.5 rounded-lg border border-border">
            <span className="text-muted-foreground">Steps to Create:</span>{' '}
            <span className="font-bold text-foreground">{summaryStats.totalStepsToCreate}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadAllCsvs}
            className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
            title="Download CSV templates for all included operations"
          >
            <Download className="w-3.5 h-3.5" /> Download All CSVs
          </Button>
        </div>
      </header>

      {/* ── Main 2-Column Body ────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR: Endpoints & Tag Groups List (~30% Width) */}
        <aside className="w-80 border-r border-border bg-card/50 flex flex-col">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Filter endpoints..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-xs bg-background"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-4">
            {Array.from(groupedOperations.entries()).map(([tag, opList]) => (
              <div key={tag} className="space-y-1">
                <div className="px-2 py-1 flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30 rounded">
                  <span>{tag}</span>
                  <Badge variant="outline" className="text-[10px] h-4">
                    {opList.length} ops
                  </Badge>
                </div>

                {opList.map(({ op, originalIndex }) => {
                  const isSelected = selectedOpIndex === originalIndex;
                  const selectedCount = op.useCases.filter((u) => u.selected).length;

                  return (
                    <div
                      key={originalIndex}
                      onClick={() => setSelectedOpIndex(originalIndex)}
                      className={`group p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-primary bg-primary/10 shadow-sm'
                          : 'border-transparent hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <input
                          type="checkbox"
                          checked={op.included && selectedCount > 0}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleOperationIncluded(originalIndex);
                          }}
                          className="rounded accent-primary"
                        />
                        <Badge
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            op.method === 'GET'
                              ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                              : op.method === 'POST'
                              ? 'bg-green-500/10 text-green-500 border-green-500/20'
                              : op.method === 'PUT'
                              ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                              : 'bg-red-500/10 text-red-500 border-red-500/20'
                          }`}
                        >
                          {op.method}
                        </Badge>
                        <span className="font-mono text-foreground truncate" title={op.path}>
                          {op.path}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] font-semibold ${
                            selectedCount > 0 ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {selectedCount} cases
                        </Badge>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </aside>

        {/* RIGHT PANEL: Operation Detail View (~70% Width) */}
        <main className="flex-1 flex flex-col bg-background overflow-hidden">
          {currentOp ? (
            <>
              {/* Op Header Banner */}
              <div className="p-4 border-b border-border bg-card flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <Badge
                      className={`text-xs font-bold px-2 py-1 ${
                        currentOp.method === 'GET'
                          ? 'bg-blue-500 text-white'
                          : currentOp.method === 'POST'
                          ? 'bg-green-500 text-white'
                          : currentOp.method === 'PUT'
                          ? 'bg-amber-500 text-white'
                          : 'bg-red-500 text-white'
                      }`}
                    >
                      {currentOp.method}
                    </Badge>
                    <span className="text-base font-mono font-bold text-foreground">{currentOp.path}</span>
                    {currentOp.isMultipart && (
                      <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/40">
                        multipart/form-data
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{currentOp.summary}</p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadCsv(currentOp)}
                    className="gap-1.5 text-xs"
                  >
                    <Download className="w-3.5 h-3.5" /> Download CSV
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddCustomRow(selectedOpIndex)}
                    className="gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/10"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Use Case
                  </Button>
                </div>
              </div>

              {/* Tabs Control Bar */}
              <div className="border-b border-border px-4 bg-muted/20 flex items-center justify-between">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                  <TabsList className="bg-transparent h-11 p-0 gap-4">
                    <TabsTrigger
                      value="usecases"
                      className="data-[state=active]:border-primary data-[state=active]:bg-transparent border-b-2 border-transparent rounded-none px-2 text-xs font-semibold gap-2"
                    >
                      <List className="w-3.5 h-3.5" />
                      Use Cases Checklist ({currentOp.useCases.filter((u) => u.selected).length}/{currentOp.useCases.length})
                    </TabsTrigger>

                    <TabsTrigger
                      value="csv"
                      className="data-[state=active]:border-primary data-[state=active]:bg-transparent border-b-2 border-transparent rounded-none px-2 text-xs font-semibold gap-2"
                    >
                      <Table className="w-3.5 h-3.5" />
                      CSV Grid Preview ({currentOp.csvTemplate?.headers?.length || 0} cols)
                    </TabsTrigger>

                    <TabsTrigger
                      value="variables"
                      className="data-[state=active]:border-primary data-[state=active]:bg-transparent border-b-2 border-transparent rounded-none px-2 text-xs font-semibold gap-2"
                    >
                      <Code className="w-3.5 h-3.5" />
                      Variable Contract ({currentOp.columnVariables?.length || 0})
                    </TabsTrigger>

                    <TabsTrigger
                      value="steps"
                      className="data-[state=active]:border-primary data-[state=active]:bg-transparent border-b-2 border-transparent rounded-none px-2 text-xs font-semibold gap-2"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      4-Step Structure
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="text-xs text-muted-foreground font-mono">
                  Op ID: {currentOp.operationId}
                </div>
              </div>

              {/* Tab Content Panel */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* TAB 1: USE CASES CHECKLIST */}
                {activeTab === 'usecases' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b">
                      <span>Deselect any scenarios you do not wish to test. You can inline-rename use cases below.</span>
                      <span className="font-semibold text-foreground">
                        {currentOp.useCases.filter((u) => u.selected).length} selected → Loop will run{' '}
                        {currentOp.useCases.filter((u) => u.selected).length} iterations
                      </span>
                    </div>

                    <div className="space-y-2">
                      {currentOp.useCases.map((uc, ucIdx) => (
                        <div
                          key={ucIdx}
                          className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                            uc.selected
                              ? 'border-border bg-card shadow-sm'
                              : 'border-border/40 bg-muted/20 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={uc.selected}
                              onChange={() => toggleUseCaseSelected(selectedOpIndex, ucIdx)}
                              className="rounded accent-primary w-4 h-4"
                            />

                            {editingRowIdx === ucIdx ? (
                              <div className="flex items-center gap-1.5">
                                <Input
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  className="h-7 text-xs font-mono w-64"
                                  autoFocus
                                />
                                <Button
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={() => handleSaveRename(selectedOpIndex, ucIdx)}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  onClick={() => setEditingRowIdx(null)}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-semibold text-foreground">
                                  {uc.usecaseName}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                  onClick={() => handleStartRename(ucIdx, uc.usecaseName)}
                                  title="Rename iteration label"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            {uc.notes && (
                              <span className="text-xs text-muted-foreground hidden lg:inline truncate max-w-xs">
                                {uc.notes}
                              </span>
                            )}

                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                uc.usecaseType === 'NEGATIVE'
                                  ? 'border-red-500/40 text-red-500 bg-red-500/10'
                                  : uc.usecaseType === 'ENUM_VARIANT'
                                  ? 'border-primary/40 text-primary bg-primary/10'
                                  : 'border-border text-muted-foreground'
                              }`}
                            >
                              {uc.usecaseType}
                            </Badge>

                            <Badge
                              className={`text-xs font-bold ${
                                uc.expectedStatusCode.startsWith('2')
                                  ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30'
                                  : 'bg-red-500/20 text-red-500 hover:bg-red-500/30'
                              }`}
                            >
                              Exp: {uc.expectedStatusCode}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 2: EDITABLE CSV GRID PREVIEW */}
                {activeTab === 'csv' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Click any cell to edit test data values directly in the template.</span>
                      <Button size="sm" variant="outline" onClick={() => handleDownloadCsv(currentOp)}>
                        <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
                      </Button>
                    </div>

                    <div className="border border-border rounded-xl overflow-x-auto bg-card shadow-sm">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                          <tr>
                            <th className="p-3 w-10">Use</th>
                            {currentOp.csvTemplate?.headers.map((h) => (
                              <th key={h} className="p-3 font-mono">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {currentOp.useCases.map((uc, ucIdx) => (
                            <tr
                              key={ucIdx}
                              className={!uc.selected ? 'opacity-40 bg-muted/20 line-through' : 'hover:bg-muted/30'}
                            >
                              <td className="p-3">
                                <input
                                  type="checkbox"
                                  checked={uc.selected}
                                  onChange={() => toggleUseCaseSelected(selectedOpIndex, ucIdx)}
                                  className="rounded accent-primary"
                                />
                              </td>

                              {currentOp.csvTemplate?.headers.map((h) => (
                                <td key={h} className="p-2">
                                  <input
                                    value={uc.values[h] || ''}
                                    onChange={(e) =>
                                      handleCellEdit(selectedOpIndex, ucIdx, h, e.target.value)
                                    }
                                    className="w-full bg-transparent border border-transparent hover:border-border focus:border-primary focus:bg-background rounded px-2 py-1 text-xs font-mono"
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* TAB 3: VARIABLE CONTRACT TABLE */}
                {activeTab === 'variables' && (
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      The generator binds these CSV column names directly to step parameter placeholders:
                    </p>

                    <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                          <tr>
                            <th className="p-3">CSV Column Name</th>
                            <th className="p-3">Placeholder Variable</th>
                            <th className="p-3">Mapped Location</th>
                            <th className="p-3">Data Type</th>
                            <th className="p-3">Required?</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {currentOp.columnVariables.map((v) => (
                            <tr key={v.columnName} className="hover:bg-muted/30">
                              <td className="p-3 font-mono font-semibold text-foreground">{v.columnName}</td>
                              <td className="p-3 font-mono text-primary">{v.placeholder}</td>
                              <td className="p-3 text-muted-foreground">{v.usedIn}</td>
                              <td className="p-3">
                                <Badge variant="outline" className="text-[10px]">
                                  {v.dataType}
                                </Badge>
                              </td>
                              <td className="p-3">
                                {v.required ? (
                                  <Badge className="bg-amber-500/20 text-amber-500 border-0 text-[10px]">Required</Badge>
                                ) : (
                                  <span className="text-muted-foreground">Optional</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* TAB 4: 5-STEP STRUCTURE DIAGRAM */}
                {activeTab === 'steps' && (
                  <div className="space-y-6">
                    <p className="text-xs text-muted-foreground">
                      The generator creates 1 single AUTH_TOKEN step at Sequence 1 per test case (with automatic background token refresh before expiration or on 401), followed by data-driven CSV, Loop, HTTP request, and assertion steps:
                    </p>

                    <div className="space-y-4">
                      {/* Step 1: AUTH_TOKEN */}
                      <Card className="border-border shadow-sm">
                        <CardHeader className="py-3 px-4 bg-muted/30 flex flex-row items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-cyan-500 text-white font-mono">Seq 1</Badge>
                            <CardTitle className="text-sm font-semibold">
                              AUTH_TOKEN — Generate Auth Token ({payload.options?.authHeaderVariable || 'authToken'})
                            </CardTitle>
                          </div>
                          <Badge variant="outline">OAuth2 / Client Credentials</Badge>
                        </CardHeader>
                        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
                          <p>• Obtains auth token and stores in variable: <code className="text-primary font-mono">{`{{${payload.options?.authHeaderVariable || 'authToken'}}}`}</code></p>
                          <p>• Token URL: <code className="font-mono">{'{{baseUrl}}'}/oauth/token</code></p>
                        </CardContent>
                      </Card>

                      {/* Step 2: CSV_EXTRACT */}
                      <Card className="border-border shadow-sm">
                        <CardHeader className="py-3 px-4 bg-muted/30 flex flex-row items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-blue-500 text-white font-mono">Seq 2</Badge>
                            <CardTitle className="text-sm font-semibold">
                              CSV_EXTRACT — {currentOp.stepStructure?.csvExtractStepName}
                            </CardTitle>
                          </div>
                          <Badge variant="outline">ITERATION_ROW Mode</Badge>
                        </CardHeader>
                        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
                          <p>
                            • Source: Inlined dataset with {currentOp.useCases.filter((u) => u.selected).length} rows
                          </p>
                          <p>• Extract mode: Reads current scenario row driven by loop index</p>
                        </CardContent>
                      </Card>

                      {/* Step 3: LOOP */}
                      <Card className="border-border shadow-sm">
                        <CardHeader className="py-3 px-4 bg-muted/30 flex flex-row items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-purple-500 text-white font-mono">Seq 3</Badge>
                            <CardTitle className="text-sm font-semibold">
                              LOOP — {currentOp.stepStructure?.loopStepName}
                            </CardTitle>
                          </div>
                          <Badge className="bg-purple-500/20 text-purple-400 border-0">
                            COUNT = {currentOp.useCases.filter((u) => u.selected).length}
                          </Badge>
                        </CardHeader>
                        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
                          <p>• Loops over inner steps Seq 4 (HTTP_REQUEST) & Seq 5 (ASSERTION)</p>
                          <p>• Continue on failure: ENABLED (reports per-iteration results without halting suite)</p>
                        </CardContent>
                      </Card>

                      {/* Step 4: HTTP_REQUEST */}
                      <Card className="border-border shadow-sm pl-4 border-l-4 border-l-green-500">
                        <CardHeader className="py-3 px-4 bg-muted/30 flex flex-row items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-green-500 text-white font-mono">Seq 4 (in loop)</Badge>
                            <CardTitle className="text-sm font-semibold font-mono">
                              HTTP_REQUEST — {currentOp.stepStructure?.httpRequestStepNameTemplate}
                            </CardTitle>
                          </div>
                          <Badge variant="outline">{currentOp.method}</Badge>
                        </CardHeader>
                        <CardContent className="p-4 text-xs space-y-2">
                          <div>
                            <span className="text-muted-foreground block mb-1 font-semibold">URL Template:</span>
                            <code className="bg-muted p-2 rounded block font-mono text-primary">
                              {'{{baseUrl}}'}
                              {currentOp.path}
                            </code>
                          </div>

                          <div>
                            <span className="text-muted-foreground block mb-1 font-semibold">Headers:</span>
                            <code className="bg-muted p-2 rounded block font-mono text-xs text-foreground">
                              Authorization: {`{{${payload.options?.authHeaderVariable || 'authToken'}}}`}<br />
                              Content-Type: {currentOp.isMultipart ? 'multipart/form-data' : 'application/json'}
                            </code>
                          </div>

                          {currentOp.stepStructure?.bodyTemplate && (
                            <div>
                              <span className="text-muted-foreground block mb-1 font-semibold">Request Body Template:</span>
                              <pre className="bg-muted p-3 rounded font-mono text-xs overflow-x-auto text-foreground max-h-40">
                                {currentOp.stepStructure.bodyTemplate}
                              </pre>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Step 5: ASSERTION */}
                      <Card className="border-border shadow-sm pl-4 border-l-4 border-l-amber-500">
                        <CardHeader className="py-3 px-4 bg-muted/30 flex flex-row items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-amber-500 text-white font-mono">Seq 5 (in loop)</Badge>
                            <CardTitle className="text-sm font-semibold">
                              ASSERTION — {currentOp.stepStructure?.assertionStepNameTemplate}
                            </CardTitle>
                          </div>
                          <Badge variant="outline">STATUS_CODE</Badge>
                        </CardHeader>
                        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
                          <p>
                            • Operator:{' '}
                            <span className="font-semibold text-foreground">
                              {payload.options?.strictStatusCode ? 'EQUALS (Exact match)' : '2XX Range Check (200-299)'}
                            </span>
                          </p>
                          <p>• Expected Value: {'{{expected_status_code}}'}</p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select an endpoint from the left list to preview
            </div>
          )}
        </main>
      </div>

      {/* ── Sticky Bottom Action Footer Bar ───────────────────────────────── */}
      <footer className="px-6 py-4 border-t border-border bg-card flex items-center justify-between shadow-lg">
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <span>
            Ready to generate <strong className="text-foreground">{summaryStats.estimatedTCs}</strong> test case(s) with{' '}
            <strong className="text-foreground">{summaryStats.totalStepsToCreate}</strong> steps across{' '}
            <strong className="text-foreground">{summaryStats.totalSelectedUseCases}</strong> use-case scenarios.
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onClose} disabled={isGenerating}>
            Cancel
          </Button>

          <Button
            onClick={handleConfirmAndGenerate}
            disabled={isGenerating || summaryStats.includedOps === 0}
            className="gap-2 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Generating Test Cases...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Confirm & Generate Test Cases →
              </>
            )}
          </Button>
        </div>
      </footer>
    </div>
  );
};
