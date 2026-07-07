import { create } from 'zustand';
import { TestStepDto } from '../types/api';
import { Edge, Node } from '@xyflow/react';

interface WorkflowState {
  steps: TestStepDto[];
  selectedStepId: string | null;
  isDirty: boolean;
  checkedStepIds: string[];
  runningExecutionId: string | null;
  stepRunStatusMap: Record<string, { status: 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED'; errorMessage?: string }>;
  setSteps: (steps: TestStepDto[]) => void;
  addStep: (step: TestStepDto) => void;
  updateStep: (stepId: string, updates: Partial<TestStepDto>) => void;
  deleteStep: (stepId: string) => void;
  selectStep: (stepId: string | null) => void;
  reorderSteps: (stepIds: string[]) => void;
  moveStepUp: (stepId: string) => void;
  moveStepDown: (stepId: string) => void;
  setDirty: (dirty: boolean) => void;
  toggleCheckStep: (stepId: string) => void;
  clearCheckedSteps: () => void;
  bulkSetEnabled: (enabled: boolean) => void;
  getNodesAndEdges: () => { nodes: Node[]; edges: Edge[] };
  setRunningExecutionId: (id: string | null) => void;
  updateStepPosition: (stepId: string, x: number, y: number) => void;
  updateStepRunStatus: (stepId: string, status: 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED', errorMessage?: string) => void;
  clearStepRunStatuses: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  steps: [],
  selectedStepId: null,
  isDirty: false,
  checkedStepIds: [],
  runningExecutionId: null,
  stepRunStatusMap: {},

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
    let steps = [...get().steps];
    const index = steps.findIndex((s) => s.id === stepId);
    if (index !== -1) {
      steps[index] = { ...steps[index], ...updates, updatedAt: new Date().toISOString() };
      
      // If toggling the enabled state of a step
      if (updates.enabled !== undefined) {
        const isSupportStep = (type: string) => type === 'ASSERTION' || type === 'SET_VARIABLE';
        const isPrimaryOrTechnical = !isSupportStep(steps[index].stepType);

        if (isPrimaryOrTechnical) {
          const targetEnabled = updates.enabled;
          // Apply same enabled state to all succeeding support steps until a non-support step is encountered
          for (let i = index + 1; i < steps.length; i++) {
            if (isSupportStep(steps[i].stepType)) {
              steps[i] = { ...steps[i], enabled: targetEnabled, updatedAt: new Date().toISOString() };
            } else {
              break;
            }
          }
        }
      }
    }
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
      const mainX = mainStep.config?.x !== undefined ? Number(mainStep.config.x) : 150;
      const mainY = mainStep.config?.y !== undefined ? Number(mainStep.config.y) : currentY;

      nodes.push({
        id: mainId,
        type: 'stepNode',
        position: { x: mainX, y: mainY },
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

          const subX = subStep.config?.x !== undefined ? Number(subStep.config.x) : startX + sIdx * colWidth;
          const subY = subStep.config?.y !== undefined ? Number(subStep.config.y) : currentY;

          nodes.push({
            id: subId,
            type: 'stepNode',
            position: { x: subX, y: subY },
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

          const supX = supportStep.config?.x !== undefined ? Number(supportStep.config.x) : 150 + (sIdx + 1) * 360;
          const supY = supportStep.config?.y !== undefined ? Number(supportStep.config.y) : currentY;

          nodes.push({
            id: supportId,
            type: 'stepNode',
            position: { x: supX, y: supY },
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

  toggleCheckStep: (stepId) => {
    const checked = get().checkedStepIds;
    if (checked.includes(stepId)) {
      set({ checkedStepIds: checked.filter((id) => id !== stepId) });
    } else {
      set({ checkedStepIds: [...checked, stepId] });
    }
  },

  clearCheckedSteps: () => {
    set({ checkedStepIds: [] });
  },

  bulkSetEnabled: (enabled) => {
    const checked = get().checkedStepIds;
    if (checked.length === 0) return;
    
    let steps = [...get().steps];
    const isSupportStep = (type: string) => type === 'ASSERTION' || type === 'SET_VARIABLE';

    steps = steps.map((s) => {
      if (checked.includes(s.id)) {
        return { ...s, enabled, updatedAt: new Date().toISOString() };
      }
      return s;
    });

    // Handle cascading enabled state to support steps
    checked.forEach((stepId) => {
      const index = steps.findIndex((s) => s.id === stepId);
      if (index !== -1 && !isSupportStep(steps[index].stepType)) {
        // Disable or enable succeeding support steps
        for (let i = index + 1; i < steps.length; i++) {
          if (isSupportStep(steps[i].stepType)) {
            steps[i] = { ...steps[i], enabled, updatedAt: new Date().toISOString() };
          } else {
            break;
          }
        }
      }
    });

    set({ steps, isDirty: true, checkedStepIds: [] });
  },

  setRunningExecutionId: (id) => {
    set({ runningExecutionId: id });
  },

  updateStepPosition: (stepId, x, y) => {
    const { nodes } = get().getNodesAndEdges();
    
    // Map steps to their laid out Y coordinate or the new drop Y coordinate
    const stepsWithY = get().steps.map((step) => {
      if (step.id === stepId) {
        return { step, y };
      }
      const node = nodes.find(n => n.id === step.id);
      return { step, y: node ? node.position.y : 0 };
    });

    // Sort steps by Y coordinate (fallback to sequenceOrder if identical Y)
    stepsWithY.sort((a, b) => {
      if (a.y === b.y) {
        return a.step.sequenceOrder - b.step.sequenceOrder;
      }
      return a.y - b.y;
    });

    // Clean up drag coordinates from configs so they snap to default layout
    const newSteps = stepsWithY.map((item, idx) => {
      const cleanConfig = { ...item.step.config };
      delete cleanConfig.x;
      delete cleanConfig.y;
      return {
        ...item.step,
        sequenceOrder: idx + 1,
        config: cleanConfig,
        updatedAt: new Date().toISOString()
      };
    });

    set({ steps: newSteps, isDirty: true });
  },

  updateStepRunStatus: (stepId, status, errorMessage) => {
    set((state) => ({
      stepRunStatusMap: {
        ...state.stepRunStatusMap,
        [stepId]: { status, errorMessage }
      }
    }));
  },

  clearStepRunStatuses: () => {
    set({ stepRunStatusMap: {} });
  }
}));
