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

    steps.forEach((step, idx) => {
      // Position nodes vertically
      nodes.push({
        id: step.id,
        type: 'stepNode',
        position: { x: 150, y: idx * 140 + 50 },
        data: { step },
      });

      if (idx > 0) {
        edges.push({
          id: `e-${steps[idx - 1].id}-${step.id}`,
          source: steps[idx - 1].id,
          target: step.id,
          animated: true,
          style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
        });
      }
    });

    return { nodes, edges };
  },
}));
