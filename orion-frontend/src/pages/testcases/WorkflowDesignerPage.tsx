import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import JSZip from 'jszip';
import api from '../../lib/api';
import { useWorkflowStore } from '../../stores/workflow-store';
import StepToolbar from '../../components/workflow/StepToolbar';
import WorkflowCanvas from '../../components/workflow/WorkflowCanvas';
import { YamlEditor } from '../../components/workflow/YamlEditor';
import StepConfigPanel from '../../components/workflow/StepConfigPanel';
import StepTypeSelector from '../../components/workflow/StepTypeSelector';
import GlobalStepPicker from '../../components/workflow/GlobalStepPicker';
import { TestCaseRunHistoryPanel } from '../../components/workflow/TestCaseRunHistoryPanel';
import { RunTestDialog } from '../../components/shared/RunTestDialog';
import { VariableLookupModal } from '../../components/workflow/VariableLookupModal';
import { TestCaseDetailDto, GlobalTestStepDto, TestStepDto, EnvironmentDto } from '../../types/api';
import { Button } from '../../components/ui';
import { Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/auth-store';

export const WorkflowDesignerPage: React.FC = () => {
  const { appId, tcId } = useParams<{ appId: string; tcId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { 
    steps, 
    setSteps, 
    addStep, 
    isDirty, 
    getNodesAndEdges, 
    selectedStepId,
    clearCheckedSteps,
    checkedStepIds,
    runningExecutionId,
    setRunningExecutionId,
    updateStepPosition,
    updateStepRunStatus,
    clearStepRunStatuses
  } = useWorkflowStore();

  const { accessToken } = useAuthStore();

  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false);
  const [isGlobalPickerOpen, setIsGlobalPickerOpen] = useState(false);
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isVariableLookupOpen, setIsVariableLookupOpen] = useState(false);
  const [runStepIds, setRunStepIds] = useState<string[] | undefined>(undefined);

  const [viewMode, setViewMode] = useState<'visual' | 'yaml'>('visual');
  const [yamlText, setYamlText] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  const debounceRef = useRef<any>(null);

  // Fetch test case details with steps
  const { data: testCase, isLoading } = useQuery<TestCaseDetailDto>({
    queryKey: ['testcase-detail', tcId],
    queryFn: async () => {
      const res = await api.get(`/applications/${appId}/testcases/${tcId}`);
      return res.data;
    },
    enabled: !!appId && !!tcId,
  });

  // Fetch app summary details to get hasEditAccess flag
  const { data: appSummary } = useQuery({
    queryKey: ['application-summary', appId],
    queryFn: async () => {
      const res = await api.get(`/applications/${appId}/summary`);
      return res.data;
    },
    enabled: !!appId,
  });

  // Fetch environments list to identify the default environment
  const { data: environments } = useQuery<EnvironmentDto[]>({
    queryKey: ['environments', appId],
    queryFn: async () => {
      const res = await api.get(`/applications/${appId}/environments`);
      return res.data;
    },
    enabled: !!appId,
  });

  const defaultEnvName = environments?.find(e => e.isDefault)?.name;

  const hasEditAccess = appSummary?.hasEditAccess ?? false;

  // Sync test case steps with Zustand store on load
  useEffect(() => {
    if (testCase) {
      const currentDirty = useWorkflowStore.getState().isDirty;
      // Only overwrite local store if user has no unsaved changes
      if (!currentDirty) {
        const currentSelectedId = useWorkflowStore.getState().selectedStepId;
        const currentSteps = useWorkflowStore.getState().steps;
        const selectedIndex = currentSelectedId ? currentSteps.findIndex(s => s.id === currentSelectedId) : -1;

        setSteps(testCase.steps);
        clearCheckedSteps();

        // If a step was selected, re-select the step at the same index in the updated list
        if (selectedIndex !== -1 && testCase.steps && testCase.steps[selectedIndex]) {
          useWorkflowStore.setState({ selectedStepId: testCase.steps[selectedIndex].id });
        }
      }
    }
    return () => {
      clearCheckedSteps();
    };
  }, [testCase?.id, setSteps, clearCheckedSteps]);

  // Listen to execution progress via Server-Sent Events stream from the canvas
  useEffect(() => {
    if (!runningExecutionId) {
      return;
    }

    clearStepRunStatuses();
    toast.loading('Execution started. Watching execution progress live on canvas...', { id: 'run-toast' });
    const tokenParam = accessToken ? `?token=${encodeURIComponent(accessToken)}` : '';
    const eventSource = new EventSource(`/api/executions/${runningExecutionId}/stream${tokenParam}`);

    eventSource.addEventListener('execution-update', (event: MessageEvent) => {
      try {
        const update = JSON.parse(event.data);
        
        if (update.stepLogs && Array.isArray(update.stepLogs)) {
          update.stepLogs.forEach((log: any) => {
            if (log.testStepId) {
              updateStepRunStatus(log.testStepId, log.status, log.errorMessage);
            }
          });
        }

        if (update.status === 'PASSED') {
          toast.success('Execution completed successfully!', { id: 'run-toast' });
          setRunningExecutionId(null);
          eventSource.close();
        } else if (update.status === 'FAILED' || update.status === 'CANCELLED') {
          toast.error(`Execution finished with status: ${update.status}`, { id: 'run-toast' });
          setRunningExecutionId(null);
          eventSource.close();
        }
      } catch (err) {
        // parsing error
      }
    });

    eventSource.onerror = () => {
      toast.dismiss('run-toast');
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [runningExecutionId, updateStepRunStatus, clearStepRunStatuses, setRunningExecutionId]);

  const handleValidateYamlLocal = async (text: string) => {
    setIsValidating(true);
    setValidationResult(null);
    setValidationErrors([]);
    setValidationWarnings([]);
    try {
      const file = new File([text], 'testcase.yaml', { type: 'application/x-yaml' });
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post(`/applications/${appId}/testcases/validate-yaml-import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setValidationResult(res.data);
      if (res.data.errors && res.data.errors.length > 0) {
        setValidationErrors(res.data.errors);
      }
      if (res.data.warnings && res.data.warnings.length > 0) {
        setValidationWarnings(res.data.warnings);
      }
    } catch (err: any) {
      setValidationErrors([err.response?.data?.message || err.message || 'Validation failed']);
    } finally {
      setIsValidating(false);
    }
  };

  const debouncedValidate = (text: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      handleValidateYamlLocal(text);
    }, 1000);
  };

  const handleYamlChange = (val: string) => {
    setYamlText(val);
    useWorkflowStore.setState({ isDirty: true });
    debouncedValidate(val);
  };

  const handleViewModeChange = async (mode: 'visual' | 'yaml') => {
    if (mode === 'yaml') {
      if (isDirty) {
        if (!window.confirm('You have unsaved visual progress. Would you like to save changes first?')) {
          return;
        }
        await saveMutation.mutateAsync();
      }
      try {
        toast.loading('Fetching YAML representation...', { id: 'yaml-fetch' });
        const res = await api.get(`/applications/${appId}/testcases/${tcId}/export`, {
          params: { format: 'yaml' },
          responseType: 'text'
        });
        setYamlText(res.data);
        toast.success('YAML loaded', { id: 'yaml-fetch' });
        setViewMode('yaml');
        handleValidateYamlLocal(res.data);
      } catch (err: any) {
        toast.error('Failed to load YAML: ' + (err.response?.data?.message || err.message), { id: 'yaml-fetch' });
      }
    } else {
      if (isDirty) {
        if (!window.confirm('You have unsaved changes in the YAML editor. Switching to Visual Canvas will discard them. Proceed?')) {
          return;
        }
      }
      queryClient.invalidateQueries({ queryKey: ['testcase-detail', tcId] });
      useWorkflowStore.setState({ isDirty: false });
      setViewMode('visual');
    }
  };

  const saveYamlMutation = useMutation({
    mutationFn: async () => {
      const file = new File([yamlText], 'testcase.yaml', { type: 'application/x-yaml' });
      const formData = new FormData();
      formData.append('file', file);
      await api.put(`/applications/${appId}/testcases/${tcId}/yaml`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testcase-detail', tcId] });
      useWorkflowStore.setState({ isDirty: false });
      toast.success('YAML changes saved successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to save YAML updates');
    }
  });

  const [versionConflict, setVersionConflict] = useState<string | null>(null);

  // Bulk save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      setVersionConflict(null);
      if (testCase) {
        await api.put(`/applications/${appId}/testcases/${tcId}`, {
          name: testCase.name,
          version: testCase.version
        });
      }
      const payload = {
        steps: steps.map((s) => {
          const config = { ...s.config };
          if (s.stepType === 'DELAY') {
            const ms = parseInt(String(config.durationMs));
            config.durationMs = isNaN(ms) ? 1000 : ms;
          }
          return {
            name: s.name,
            description: s.description,
            stepType: s.stepType,
            actionType: s.actionType,
            config: config,
            expectedResult: s.expectedResult,
            isGlobalRef: s.isGlobalRef,
            globalStepId: s.globalStepId,
            enabled: s.enabled !== false,
          };
        }),
      };
      await api.post(`/testcases/${tcId}/steps/bulk`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testcase-detail', tcId] });
      useWorkflowStore.setState({ isDirty: false });
      toast.success('Workflow saved successfully');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Failed to save workflow';
      if (msg.includes('Conflict') || err.response?.status === 409) {
        setVersionConflict(msg);
      }
      toast.error(msg);
    },
  });

  const cloneTestCaseMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/applications/${appId}/testcases/${tcId}/clone`);
      return res.data;
    },
    onSuccess: (newCase) => {
      toast.success('Test case cloned successfully! Opening the clone...');
      navigate(`/applications/${appId}/testcases/${newCase.id}/designer`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to clone test case');
    }
  });

  const handleSelectStepType = (type: string, isGlobalRef = false) => {
    setIsTypeSelectorOpen(false);
    
    if (isGlobalRef) {
      setIsGlobalPickerOpen(true);
    } else {
      const newStep: TestStepDto = {
        id: `step-${Date.now()}`,
        testCaseId: tcId!,
        sequenceOrder: steps.length + 1,
        name: `New ${type.replace('_', ' ').toLowerCase()}`,
        description: '',
        stepType: type,
        actionType: 'NONE',
        config: {},
        expectedResult: '',
        isGlobalRef: false,
        globalStepId: null,
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addStep(newStep);
      toast.info('Step added. Configure properties in the right sidebar panel.');
    }
  };

  const handleSelectGlobalStep = (globalStep: GlobalTestStepDto) => {
    setIsGlobalPickerOpen(false);
    
    const newStep: TestStepDto = {
      id: `step-${Date.now()}`,
      testCaseId: tcId!,
      sequenceOrder: steps.length + 1,
      name: globalStep.name,
      description: globalStep.description,
      stepType: 'GLOBAL_REF',
      actionType: globalStep.actionType,
      config: globalStep.config,
      expectedResult: '',
      isGlobalRef: true,
      globalStepId: globalStep.id,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addStep(newStep);
    toast.success('Global step template added');
  };

  const handleValidate = () => {
    let errors = [];
    steps.forEach((step, idx) => {
      if (step.stepType === 'HTTP_REQUEST' && !step.config.url) {
        errors.push(`Step ${idx + 1} (HTTP Request): URL must not be blank`);
      }
      if (step.stepType === 'GRAPHQL_REQUEST') {
        if (!step.config.url) {
          errors.push(`Step ${idx + 1} (GraphQL Request): URL must not be blank`);
        }
        if (!step.config.query) {
          errors.push(`Step ${idx + 1} (GraphQL Request): Query/Mutation must not be blank`);
        }
      }
      if (step.stepType === 'ASSERTION' && !step.config.expectedValue) {
        errors.push(`Step ${idx + 1} (Assertion): Expected value must not be blank`);
      }
      if (step.stepType === 'SET_VARIABLE' && !step.config.variableName) {
        errors.push(`Step ${idx + 1} (Extract Variable): Variable name is required`);
      }
    });

    if (errors.length > 0) {
      errors.forEach((err) => toast.error(err));
    } else {
      toast.success('Workflow validation passed. All steps have completed configuration.');
    }
  };

  const handleDownloadCsvTemplates = async () => {
    const csvExtractSteps = steps.filter(
      (s) => s.stepType === 'CSV_EXTRACT' && s.config?.rawCsv
    );

    if (csvExtractSteps.length === 0) {
      const varNames = new Set<string>(['usecase_name', 'expected_status_code']);
      steps.forEach((step) => {
        const rawJson = JSON.stringify(step.config || {});
        const matches = rawJson.match(/\{\{\s*(?:dataset\.|csv\.)?([a-zA-Z0-9_]+)\s*\}\}/g);
        if (matches) {
          matches.forEach((m) => {
            const cleanVar = m.replace(/[\{\}\s]/g, '').replace(/^(dataset|csv)\./, '');
            if (cleanVar && !['appName', 'envName', 'baseUrl'].includes(cleanVar)) {
              varNames.add(cleanVar);
            }
          });
        }
      });

      const headers = Array.from(varNames);
      const sampleRow = headers.map((h) => (h === 'usecase_name' ? 'sample_scenario_1' : h === 'expected_status_code' ? '200' : 'sample_value'));
      const templateCsv = `${headers.join(',')}\n${sampleRow.join(',')}\n`;

      const blob = new Blob([templateCsv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = `${(testCase?.name || 'workflow').replace(/[^a-zA-Z0-9]/g, '_')}_dataset_template.csv`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Exported CSV dataset template: ${filename}`);
      return;
    }

    if (csvExtractSteps.length === 1) {
      const step = csvExtractSteps[0];
      const rawCsv = step.config.rawCsv;
      const blob = new Blob([rawCsv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = `${(testCase?.name || 'workflow').replace(/[^a-zA-Z0-9]/g, '_')}_${(step.name || 'dataset').replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Exported CSV dataset template: ${filename}`);
    } else {
      const zip = new JSZip();
      csvExtractSteps.forEach((step, idx) => {
        const stepName = (step.name || `csv_step_${idx + 1}`).replace(/[^a-zA-Z0-9]/g, '_');
        zip.file(`${stepName}.csv`, step.config.rawCsv);
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      const zipName = `${(testCase?.name || 'workflow').replace(/[^a-zA-Z0-9]/g, '_')}_csv_templates.zip`;
      link.setAttribute('download', zipName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Downloaded ${csvExtractSteps.length} CSV dataset templates in ${zipName}`);
    }
  };

  const handleBack = () => {
    if (isDirty) {
      if (window.confirm('You have unsaved changes. Are you sure you want to discard them?')) {
        navigate(`/applications/${appId}`);
      }
    } else {
      navigate(`/applications/${appId}`);
    }
  };

  const handleNodeDragStop = (event: React.MouseEvent, node: any) => {
    updateStepPosition(node.id, Math.round(node.position.x), Math.round(node.position.y));
  };

  const { nodes, edges } = getNodesAndEdges();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading visual workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col h-screen overflow-hidden bg-background text-foreground z-50">
      {/* Designer topbar */}
      <StepToolbar
        appName={testCase?.appId || ''}
        testCaseName={testCase?.name || ''}
        version={testCase?.version}
        onClone={() => cloneTestCaseMutation.mutate()}
        isDirty={isDirty}
        isSaving={saveMutation.isPending || saveYamlMutation.isPending || cloneTestCaseMutation.isPending}
        defaultEnvName={defaultEnvName}
        onSave={() => {
          if (viewMode === 'yaml') {
            saveYamlMutation.mutate();
          } else {
            saveMutation.mutate();
          }
        }}
        onAddStep={() => setIsTypeSelectorOpen(true)}
        onValidate={handleValidate}
        onRun={() => {
          setRunStepIds(undefined);
          setIsRunModalOpen(true);
        }}
        onRunChecked={() => {
          setRunStepIds(checkedStepIds);
          setIsRunModalOpen(true);
        }}
        onBack={handleBack}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenVariableLookup={() => setIsVariableLookupOpen(true)}
        onDownloadCsvTemplates={handleDownloadCsvTemplates}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        readOnly={!hasEditAccess}
      />

      {/* Optimistic Version Conflict Banner */}
      {versionConflict && (
        <div className="bg-rose-500/10 border-b border-rose-500/30 px-4 py-2 flex items-center justify-between text-xs text-rose-400 z-10 shrink-0">
          <div className="flex items-center space-x-2 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{versionConflict}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-rose-500/40 text-rose-400 hover:bg-rose-500/20"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['testcase-detail', tcId] });
              setVersionConflict(null);
              useWorkflowStore.setState({ isDirty: false });
            }}
          >
            Reload Latest Changes
          </Button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {viewMode === 'yaml' ? (
          <YamlEditor
            yamlText={yamlText}
            onChange={handleYamlChange}
            isValidating={isValidating}
            validationErrors={validationErrors}
            validationWarnings={validationWarnings}
            validationResult={validationResult}
            // Pass readOnly option if YamlEditor needs to block editing!
          />
        ) : (
          <>
            {/* React Flow canvas */}
            <WorkflowCanvas 
              nodes={nodes} 
              edges={edges} 
              onNodeDragStop={handleNodeDragStop}
              readOnly={!hasEditAccess}
            />

            {/* Configuration Right Sidebar Drawer */}
            {selectedStepId && (
              <StepConfigPanel 
                onRunSingleStep={(stepId) => {
                  setRunStepIds([stepId]);
                  setIsRunModalOpen(true);
                }} 
                readOnly={!hasEditAccess}
              />
            )}
          </>
        )}
      </div>

      {/* STEP TYPE SELECTOR DIALOG */}
      <StepTypeSelector
        isOpen={isTypeSelectorOpen}
        onClose={() => setIsTypeSelectorOpen(false)}
        onSelect={handleSelectStepType}
      />

      {/* GLOBAL TEMPLATE PICKER */}
      <GlobalStepPicker
        isOpen={isGlobalPickerOpen}
        onClose={() => setIsGlobalPickerOpen(false)}
        onSelect={handleSelectGlobalStep}
      />

      {/* RUN TEST DIALOG */}
      {testCase && (
        <RunTestDialog
          isOpen={isRunModalOpen}
          onClose={() => setIsRunModalOpen(false)}
          appId={appId!}
          testCaseId={tcId!}
          testCaseName={testCase.name}
          stepIds={runStepIds}
        />
      )}

      {/* RECENT RUN HISTORY PANEL */}
      {tcId && (
        <TestCaseRunHistoryPanel
          testCaseId={tcId}
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}

      {/* VARIABLE LOOKUP & AUDIT INSPECTOR MODAL */}
      {appId && (
        <VariableLookupModal
          isOpen={isVariableLookupOpen}
          onClose={() => setIsVariableLookupOpen(false)}
          appId={appId}
          steps={steps}
        />
      )}
    </div>
  );
};
export default WorkflowDesignerPage;
