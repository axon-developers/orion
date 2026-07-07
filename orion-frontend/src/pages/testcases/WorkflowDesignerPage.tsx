import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { useWorkflowStore } from '../../stores/workflow-store';
import StepToolbar from '../../components/workflow/StepToolbar';
import WorkflowCanvas from '../../components/workflow/WorkflowCanvas';
import { YamlEditor } from '../../components/workflow/YamlEditor';
import StepConfigPanel from '../../components/workflow/StepConfigPanel';
import StepTypeSelector from '../../components/workflow/StepTypeSelector';
import GlobalStepPicker from '../../components/workflow/GlobalStepPicker';
import { RunTestDialog } from '../../components/shared/RunTestDialog';
import { TestCaseDetailDto, GlobalTestStepDto, TestStepDto } from '../../types/api';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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

  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false);
  const [isGlobalPickerOpen, setIsGlobalPickerOpen] = useState(false);
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
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

  // Sync test case steps with Zustand store on load
  useEffect(() => {
    if (testCase) {
      setSteps(testCase.steps);
      clearCheckedSteps();
    }
    return () => {
      clearCheckedSteps();
    };
  }, [testCase, setSteps, clearCheckedSteps]);

  // Listen to execution progress via Server-Sent Events stream from the canvas
  useEffect(() => {
    if (!runningExecutionId) {
      return;
    }

    clearStepRunStatuses();
    toast.loading('Execution started. Watching execution progress live on canvas...', { id: 'run-toast' });
    const eventSource = new EventSource(`/api/executions/${runningExecutionId}/stream`);

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

  // Bulk save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        steps: steps.map((s) => ({
          name: s.name,
          description: s.description,
          stepType: s.stepType,
          actionType: s.actionType,
          config: s.config,
          expectedResult: s.expectedResult,
          isGlobalRef: s.isGlobalRef,
          globalStepId: s.globalStepId,
          enabled: s.enabled !== false,
        })),
      };
      await api.post(`/testcases/${tcId}/steps/bulk`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testcase-detail', tcId] });
      useWorkflowStore.setState({ isDirty: false });
      toast.success('Workflow saved successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to save workflow');
    },
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
        isDirty={isDirty}
        isSaving={saveMutation.isPending || saveYamlMutation.isPending}
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
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
      />

      <div className="flex-1 flex overflow-hidden">
        {viewMode === 'yaml' ? (
          <YamlEditor
            yamlText={yamlText}
            onChange={handleYamlChange}
            isValidating={isValidating}
            validationErrors={validationErrors}
            validationWarnings={validationWarnings}
            validationResult={validationResult}
          />
        ) : (
          <>
            {/* React Flow canvas */}
            <WorkflowCanvas 
              nodes={nodes} 
              edges={edges} 
              onNodeDragStop={handleNodeDragStop}
            />

            {/* Configuration Right Sidebar Drawer */}
            {selectedStepId && (
              <StepConfigPanel 
                onRunSingleStep={(stepId) => {
                  setRunStepIds([stepId]);
                  setIsRunModalOpen(true);
                }} 
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
    </div>
  );
};
export default WorkflowDesignerPage;
