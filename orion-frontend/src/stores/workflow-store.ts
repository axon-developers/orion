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

  setDirty: (dirty) => {
    set({ isDirty: dirty });
  },

  // Helper method to convert step list into React Flow nodes and edges!
  getNodesAndEdges: () => {
    const steps = get().steps;
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    let currentY = 50;
    let previousNodeIds: string[] = [];

    steps.forEach((step, idx) => {
      const parentId = step.id;

      // 1. Render the main step node
      nodes.push({
        id: parentId,
        type: 'stepNode',
        position: { x: 150, y: currentY },
        data: { step },
      });

      // 2. Connect from previous nodes
      previousNodeIds.forEach((prevId) => {
        edges.push({
          id: `e-${prevId}-${parentId}`,
          source: prevId,
          target: parentId,
          animated: true,
          style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
        });
      });

      if (step.stepType === 'PARALLEL' && step.config?.steps && step.config.steps.length > 0) {
        const subSteps = step.config.steps;
        const numSubSteps = subSteps.length;
        
        currentY += 140;

        const colWidth = 350; // node width + spacing
        const startX = 150 - ((numSubSteps - 1) * colWidth) / 2;
        const subNodeIds: string[] = [];

        subSteps.forEach((subStep: any, sIdx: number) => {
          const subId = `${parentId}-sub-${sIdx}`;
          subNodeIds.push(subId);

          const mockSubStep = {
            id: subId,
            testCaseId: step.testCaseId,
            sequenceOrder: Number((step.sequenceOrder + (sIdx + 1) / 10.0).toFixed(1)),
            name: subStep.name || `Sub-step ${sIdx + 1}`,
            description: subStep.config?.url || subStep.config?.message || 'Parallel execution step',
            stepType: subStep.stepType,
            actionType: subStep.config?.method || 'NONE',
            config: subStep.config || {},
            isGlobalRef: false,
            globalStepId: null,
          };

          nodes.push({
            id: subId,
            type: 'stepNode',
            position: { x: startX + sIdx * colWidth, y: currentY },
            data: { step: mockSubStep },
          });

          edges.push({
            id: `e-${parentId}-${subId}`,
            source: parentId,
            target: subId,
            animated: true,
            style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
          });
        });

        previousNodeIds = subNodeIds;
        currentY += 140;
      } else {
        previousNodeIds = [parentId];
        currentY += 140;
      }
    });

    return { nodes, edges };
  },
}));
