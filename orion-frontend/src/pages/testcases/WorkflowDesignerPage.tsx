import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { useWorkflowStore } from '../../stores/workflow-store';
import StepToolbar from '../../components/workflow/StepToolbar';
import WorkflowCanvas from '../../components/workflow/WorkflowCanvas';
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
    selectedStepId 
  } = useWorkflowStore();

  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false);
  const [isGlobalPickerOpen, setIsGlobalPickerOpen] = useState(false);
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);

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
    }
  }, [testCase, setSteps]);

  // Bulk save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Map Zustand steps back to request schema
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
      // Generate unique temp id
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addStep(newStep);
    toast.success('Global step template added');
  };

  const handleValidate = () => {
    // Simple frontend validations
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
        isSaving={saveMutation.isPending}
        onSave={() => saveMutation.mutate()}
        onAddStep={() => setIsTypeSelectorOpen(true)}
        onValidate={handleValidate}
        onRun={() => setIsRunModalOpen(true)}
        onBack={handleBack}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* React Flow canvas */}
        <WorkflowCanvas 
          nodes={nodes} 
          edges={edges} 
        />

        {/* Configuration Right Sidebar Drawer */}
        {selectedStepId && <StepConfigPanel />}
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
        />
      )}
    </div>
  );
};
export default WorkflowDesignerPage;
