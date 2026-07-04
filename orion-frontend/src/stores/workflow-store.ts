import { create } from 'zustand';
import { TestStepDto } from '../types/api';
import { Edge, Node } from 'reactflow';

interface WorkflowState {
  steps: TestStepDto[];
  selectedStepId: string | null;
  isDirty: boolean;
  setSteps: (steps: TestStepDto[]) => void;
  addStep: (step: TestStepDto) => void;
  updateStep: (stepId: string, updates: Partial<TestStepDto>) => void;
  deleteStep: (stepId: string) => void;
  selectStep: (stepId: string | null) => void;
  reorderSteps: (stepIds: string[]) => void;
  moveStepUp: (stepId: string) => void;
  moveStepDown: (stepId: string) => void;
  setDirty: (dirty: boolean) => void;
  getNodesAndEdges: () => { nodes: Node[]; edges: Edge[] };
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  steps: [],
  selectedStepId: null,
  isDirty: false,

  setSteps: (steps) => {
    // Sort by sequence order to be safe
    const sorted = [...steps].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    set({ steps: sorted, isDirty: false });
  },

  addStep: (step) => {
    const steps = [...get().steps, step];
    set({ steps, isDirty: true, selectedStepId: step.id });
  },

  updateStep: (stepId, updates) => {
    const steps = get().steps.map((s) => {
      if (s.id === stepId) {
        return { ...s, ...updates, updatedAt: new Date().toISOString() };
      }
      return s;
    });
    set({ steps, isDirty: true });
  },

  deleteStep: (stepId) => {
    const remaining = get().steps.filter((s) => s.id !== stepId);
    // Re-sequence sequenceOrder
    const resequenced = remaining.map((s, idx) => ({
      ...s,
      sequenceOrder: idx + 1,
    }));
    set({ 
      steps: resequenced, 
      isDirty: true, 
      selectedStepId: get().selectedStepId === stepId ? null : get().selectedStepId 
    });
  },

  selectStep: (stepId) => {
    set({ selectedStepId: stepId });
  },

  reorderSteps: (stepIds) => {
    const stepsMap = new Map(get().steps.map((s) => [s.id, s]));
    const reordered: TestStepDto[] = [];
    stepIds.forEach((id, idx) => {
      const step = stepsMap.get(id);
      if (step) {
        reordered.push({ ...step, sequenceOrder: idx + 1 });
      }
    });
    set({ steps: reordered, isDirty: true });
  },

  moveStepUp: (stepId) => {
    const steps = [...get().steps];
    const index = steps.findIndex((s) => s.id === stepId);
    if (index > 0) {
      const temp = steps[index];
      steps[index] = steps[index - 1];
      steps[index - 1] = temp;
      
      const resequenced = steps.map((s, idx) => ({
        ...s,
        sequenceOrder: idx + 1
      }));
      set({ steps: resequenced, isDirty: true });
    }
  },

  moveStepDown: (stepId) => {
    const steps = [...get().steps];
    const index = steps.findIndex((s) => s.id === stepId);
    if (index !== -1 && index < steps.length - 1) {
      const temp = steps[index];
      steps[index] = steps[index + 1];
      steps[index + 1] = temp;
      
      const resequenced = steps.map((s, idx) => ({
        ...s,
        sequenceOrder: idx + 1
      }));
      set({ steps: resequenced, isDirty: true });
    }
  },

  setDirty: (dirty) => {
    set({ isDirty: dirty });
  },

  // Helper method to convert step list into React Flow nodes and edges
  getNodesAndEdges: () => {
    const steps = get().steps;
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const isSupportStep = (type: string) => {
      return type === 'ASSERTION' || type === 'SET_VARIABLE';
    };

    const rows: { verticalStep: TestStepDto; supportSteps: TestStepDto[] }[] = [];
    steps.forEach((step) => {
      const isSupport = isSupportStep(step.stepType);
      if (isSupport && rows.length > 0) {
        rows[rows.length - 1].supportSteps.push(step);
      } else {
        rows.push({
          verticalStep: step,
          supportSteps: [],
        });
      }
    });

    let currentY = 50;
    let previousNodeIds: { id: string; handle: string }[] = [];

    rows.forEach((row) => {
      const mainStep = row.verticalStep;
      const mainId = mainStep.id;

      // 1. Position and push the main node
      nodes.push({
        id: mainId,
        type: 'stepNode',
        position: { x: 150, y: currentY },
        data: { step: mainStep },
      });

      // 2. Connect from previous row's output nodes
      previousNodeIds.forEach((prev) => {
        edges.push({
          id: `e-${prev.id}-${mainId}`,
          source: prev.id,
          sourceHandle: prev.handle,
          target: mainId,
          targetHandle: 'top',
          animated: true,
          style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
        });
      });

      // 3. Process support steps or parallel sub-steps
      const isParallel = mainStep.stepType === 'PARALLEL' && mainStep.config?.steps && mainStep.config.steps.length > 0;

      if (isParallel) {
        // Render parallel sub-steps below
        const subSteps = mainStep.config.steps;
        const numSubSteps = subSteps.length;
        
        currentY += 160;

        const colWidth = 350; // node width + spacing
        const startX = 150 - ((numSubSteps - 1) * colWidth) / 2;
        const subNodeIds: { id: string; handle: string }[] = [];

        subSteps.forEach((subStep: any, sIdx: number) => {
          const subId = `${mainId}-sub-${sIdx}`;
          subNodeIds.push({ id: subId, handle: 'bottom' });

          const mockSubStep = {
            id: subId,
            testCaseId: mainStep.testCaseId,
            sequenceOrder: Number((mainStep.sequenceOrder + (sIdx + 1) / 10.0).toFixed(1)),
            name: subStep.name || `Sub-step ${sIdx + 1}`,
            description: subStep.config?.url || subStep.config?.message || 'Parallel execution step',
            stepType: subStep.stepType,
            actionType: subStep.config?.method || 'NONE',
            config: subStep.config || {},
            isGlobalRef: false,
            globalStepId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          nodes.push({
            id: subId,
            type: 'stepNode',
            position: { x: startX + sIdx * colWidth, y: currentY },
            data: { step: mockSubStep },
          });

          edges.push({
            id: `e-${mainId}-${subId}`,
            source: mainId,
            sourceHandle: 'bottom',
            target: subId,
            targetHandle: 'top',
            animated: true,
            style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
          });
        });

        previousNodeIds = subNodeIds;
        currentY += 160;
      } else if (row.supportSteps.length > 0) {
        // Render support steps horizontally to the right
        let lastId = mainId;
        let lastHandle = 'right';

        row.supportSteps.forEach((supportStep, sIdx) => {
          const supportId = supportStep.id;

          nodes.push({
            id: supportId,
            type: 'stepNode',
            position: { x: 150 + (sIdx + 1) * 360, y: currentY }, // 360px spacing horizontally
            data: { step: supportStep },
          });

          // Connect from the previous node in the horizontal chain
          edges.push({
            id: `e-${lastId}-${supportId}`,
            source: lastId,
            sourceHandle: lastHandle,
            target: supportId,
            targetHandle: 'left',
            animated: true,
            style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
          });

          lastId = supportId;
          lastHandle = (sIdx === row.supportSteps.length - 1) ? 'bottom' : 'right';
        });

        previousNodeIds = [{ id: lastId, handle: lastHandle }];
        currentY += 160;
      } else {
        // Standard single step row
        previousNodeIds = [{ id: mainId, handle: 'bottom' }];
        currentY += 160;
      }
    });

    return { nodes, edges };
  },
}));
