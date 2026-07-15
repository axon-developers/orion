import { create } from 'zustand';
import { TestStepDto } from '../types/api';
import { Edge, Node } from '@xyflow/react';
import { toast } from 'sonner';

interface WorkflowState {
  steps: TestStepDto[];
  selectedStepId: string | null;
  isDirty: boolean;
  checkedStepIds: string[];
  runningExecutionId: string | null;
  stepRunStatusMap: Record<string, { status: 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED'; errorMessage?: string }>;
  past: TestStepDto[][];
  future: TestStepDto[][];
  undo: () => void;
  redo: () => void;
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
  bulkDeleteSteps: () => void;
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
  past: [],
  future: [],

  undo: () => {
    const past = get().past;
    if (past.length === 0) return;
    
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    const current = get().steps;
    
    set({
      past: newPast,
      steps: previous,
      future: [current, ...get().future],
      isDirty: true
    });
    toast.info('Reverted last action (Undo)');
  },
  
  redo: () => {
    const future = get().future;
    if (future.length === 0) return;
    
    const next = future[0];
    const newFuture = future.slice(1);
    const current = get().steps;
    
    set({
      past: [...get().past, current],
      steps: next,
      future: newFuture,
      isDirty: true
    });
    toast.info('Reapplied action (Redo)');
  },

  setSteps: (steps) => {
    // Sort by sequence order to be safe
    const sorted = [...steps].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    set({ steps: sorted, isDirty: false, past: [], future: [] });
  },

  addStep: (step) => {
    const current = get().steps;
    set({ 
      past: [...get().past, current],
      future: [],
      steps: [...current, step], 
      isDirty: true, 
      selectedStepId: step.id 
    });
  },

  updateStep: (stepId, updates) => {
    const current = get().steps;
    let steps = [...current];
    const index = steps.findIndex((s) => s.id === stepId);
    if (index !== -1) {
      steps[index] = { ...steps[index], ...updates, updatedAt: new Date().toISOString() };
      
      // If toggling the enabled state of a step
      if (updates.enabled !== undefined) {
        const isSupportStep = (type: string) => type === 'ASSERTION' || type === 'SET_VARIABLE' || type === 'RESPONSE_PROCESSOR' || type === 'CSV_EXTRACT';
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
    set({ 
      past: [...get().past, current],
      future: [],
      steps, 
      isDirty: true 
    });
  },

  deleteStep: (stepId) => {
    const current = get().steps;
    const remaining = current.filter((s) => s.id !== stepId);
    // Re-sequence sequenceOrder
    const resequenced = remaining.map((s, idx) => ({
      ...s,
      sequenceOrder: idx + 1,
    }));
    set({ 
      past: [...get().past, current],
      future: [],
      steps: resequenced, 
      isDirty: true, 
      selectedStepId: get().selectedStepId === stepId ? null : get().selectedStepId 
    });
  },

  selectStep: (stepId) => {
    set({ selectedStepId: stepId });
  },

  reorderSteps: (stepIds) => {
    const current = get().steps;
    const stepsMap = new Map(current.map((s) => [s.id, s]));
    const reordered: TestStepDto[] = [];
    stepIds.forEach((id, idx) => {
      const step = stepsMap.get(id);
      if (step) {
        reordered.push({ ...step, sequenceOrder: idx + 1 });
      }
    });
    set({ 
      past: [...get().past, current],
      future: [],
      steps: reordered, 
      isDirty: true 
    });
  },

  moveStepUp: (stepId) => {
    const current = get().steps;
    const steps = [...current];
    const index = steps.findIndex((s) => s.id === stepId);
    if (index > 0) {
      const temp = steps[index];
      steps[index] = steps[index - 1];
      steps[index - 1] = temp;
      
      const resequenced = steps.map((s, idx) => ({
        ...s,
        sequenceOrder: idx + 1
      }));
      set({ 
        past: [...get().past, current],
        future: [],
        steps: resequenced, 
        isDirty: true 
      });
    }
  },

  moveStepDown: (stepId) => {
    const current = get().steps;
    const steps = [...current];
    const index = steps.findIndex((s) => s.id === stepId);
    if (index !== -1 && index < steps.length - 1) {
      const temp = steps[index];
      steps[index] = steps[index + 1];
      steps[index + 1] = temp;
      
      const resequenced = steps.map((s, idx) => ({
        ...s,
        sequenceOrder: idx + 1
      }));
      set({ 
        past: [...get().past, current],
        future: [],
        steps: resequenced, 
        isDirty: true 
      });
    }
  },

  setDirty: (dirty) => {
    set({ isDirty: dirty });
  },

  toggleCheckStep: (stepId) => {
    set((state) => {
      const isChecked = state.checkedStepIds.includes(stepId);
      const checkedStepIds = isChecked
        ? state.checkedStepIds.filter((id) => id !== stepId)
        : [...state.checkedStepIds, stepId];
      return { checkedStepIds };
    });
  },

  clearCheckedSteps: () => {
    set({ checkedStepIds: [] });
  },

  bulkSetEnabled: (enabled) => {
    const checked = get().checkedStepIds;
    if (checked.length === 0) return;
    
    const current = get().steps;
    let steps = [...current];
    const isSupportStep = (type: string) => type === 'ASSERTION' || type === 'SET_VARIABLE';

    steps = steps.map((s) => {
      if (checked.includes(s.id)) {
        return { ...s, enabled, updatedAt: new Date().toISOString() };
      }
      return s;
    });

    // Mirror to support steps
    checked.forEach((stepId) => {
      const index = steps.findIndex((s) => s.id === stepId);
      if (index !== -1 && !isSupportStep(steps[index].stepType)) {
        for (let i = index + 1; i < steps.length; i++) {
          if (isSupportStep(steps[i].stepType)) {
            steps[i] = { ...steps[i], enabled, updatedAt: new Date().toISOString() };
          } else {
            break;
          }
        }
      }
    });

    set({ 
      past: [...get().past, current],
      future: [],
      steps, 
      isDirty: true, 
      checkedStepIds: [] 
    });
  },

  bulkDeleteSteps: () => {
    const checked = get().checkedStepIds;
    if (checked.length === 0) return;
    
    const current = get().steps;
    const remaining = current.filter((s) => !checked.includes(s.id));
    const resequenced = remaining.map((s, idx) => ({
      ...s,
      sequenceOrder: idx + 1,
    }));
    
    set({ 
      past: [...get().past, current],
      future: [],
      steps: resequenced, 
      isDirty: true, 
      checkedStepIds: [],
      selectedStepId: checked.includes(get().selectedStepId || '') ? null : get().selectedStepId
    });
  },

  // Helper method to convert step list into React Flow nodes and edges
  getNodesAndEdges: () => {
    const steps = get().steps;
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const isSupportStep = (type: string) => {
      return type === 'ASSERTION' || type === 'SET_VARIABLE' || type === 'RESPONSE_PROCESSOR' || type === 'CSV_EXTRACT';
    };

    const getEdgeStyle = (sourceId: string, targetId: string) => {
      const cleanSourceId = sourceId.split('-sub-')[0];
      const cleanTargetId = targetId.split('-sub-')[0];
      
      const sourceStatus = get().stepRunStatusMap[cleanSourceId];
      const targetStatus = get().stepRunStatusMap[cleanTargetId];
      
      let stroke = 'rgba(148, 163, 184, 0.45)'; // highly visible slate color by default
      let strokeWidth = 2.5; // thicker connector line for better visibility
      let animated = false;
      
      if (sourceStatus || targetStatus) {
        if (sourceStatus?.status === 'RUNNING' || targetStatus?.status === 'RUNNING') {
          stroke = '#06b6d4'; // Cyan
          strokeWidth = 3;
          animated = true;
        } else if (sourceStatus?.status === 'QUEUED' || targetStatus?.status === 'QUEUED') {
          stroke = '#eab308'; // Yellow
          strokeWidth = 2.5;
          animated = true;
        } else if (sourceStatus?.status === 'FAILED' || targetStatus?.status === 'FAILED') {
          stroke = '#f43f5e'; // Red
          strokeWidth = 3;
        } else if (sourceStatus?.status === 'PASSED' && targetStatus?.status === 'PASSED') {
          stroke = '#10b981'; // Green
          strokeWidth = 3;
        } else if (sourceStatus?.status === 'PASSED' || targetStatus?.status === 'PASSED') {
          stroke = '#10b981'; // Green
          strokeWidth = 2.5;
        }
      }
      
      return { stroke, strokeWidth, animated };
    };

    let currentY = 50;
    let lastPrimaryNodeId: string | null = null;
    let horizontalOffsetMap: Record<string, number> = {};

    steps.forEach((step, index) => {
      const isSupport = isSupportStep(step.stepType);
      
      if (!isSupport) {
        currentY += 160;
        const nodeX = 100;
        const nodeId = step.id;
        
        nodes.push({
          id: nodeId,
          type: 'stepNode',
          position: { x: nodeX, y: currentY },
          data: { step },
          draggable: true
        });

        if (lastPrimaryNodeId) {
          const edgeStyle = getEdgeStyle(lastPrimaryNodeId, nodeId);
          edges.push({
            id: `edge-${lastPrimaryNodeId}-${nodeId}`,
            source: lastPrimaryNodeId,
            target: nodeId,
            sourceHandle: 'bottom',
            targetHandle: 'top',
            animated: edgeStyle.animated,
            style: { stroke: edgeStyle.stroke, strokeWidth: edgeStyle.strokeWidth },
          });
        }
        
        lastPrimaryNodeId = nodeId;
        horizontalOffsetMap[nodeId] = 0;
      } else {
        if (lastPrimaryNodeId) {
          horizontalOffsetMap[lastPrimaryNodeId] = (horizontalOffsetMap[lastPrimaryNodeId] || 0) + 1;
          const offsetCount = horizontalOffsetMap[lastPrimaryNodeId];
          const nodeX = 100 + (offsetCount * 360);
          const nodeId = step.id;

          nodes.push({
            id: nodeId,
            type: 'stepNode',
            position: { x: nodeX, y: currentY },
            data: { step },
            draggable: false // Support steps are visually anchored to their parent
          });

          // Connect from the main parent or the previous support node in this sequence
          const sourceId = offsetCount === 1 
            ? lastPrimaryNodeId 
            : `${lastPrimaryNodeId}-sub-${offsetCount - 2}`; // link support steps in a chain

          // Rename actual ID mapped internally
          const mappedTargetId = `${lastPrimaryNodeId}-sub-${offsetCount - 1}`;
          
          // Modify React Flow ID mapping but preserve underlying step
          nodes[nodes.length - 1].id = mappedTargetId;

          const edgeStyle = getEdgeStyle(sourceId, mappedTargetId);
          edges.push({
            id: `edge-${sourceId}-${mappedTargetId}`,
            source: sourceId,
            target: mappedTargetId,
            sourceHandle: offsetCount === 1 ? 'right' : 'right',
            targetHandle: 'left',
            animated: edgeStyle.animated,
            style: { stroke: edgeStyle.stroke, strokeWidth: edgeStyle.strokeWidth },
          });
        }
      }
    });

    return { nodes, edges };
  },

  setRunningExecutionId: (id) => {
    set({ runningExecutionId: id });
  },

  updateStepPosition: (stepId, x, y) => {
    const current = get().steps;
    const { nodes } = get().getNodesAndEdges();

    const isSupportStep = (type: string) => {
      return type === 'ASSERTION' || type === 'SET_VARIABLE' || type === 'RESPONSE_PROCESSOR' || type === 'CSV_EXTRACT';
    };

    // 1. Group steps into logical blocks starting with their primary steps
    const blocks: { primary: TestStepDto; supports: TestStepDto[]; y: number }[] = [];
    let currentBlock: typeof blocks[0] | null = null;

    current.forEach((step) => {
      if (!isSupportStep(step.stepType)) {
        const node = nodes.find(n => n.id === step.id);
        const nodeY = node ? node.position.y : 0;
        
        currentBlock = {
          primary: step,
          supports: [],
          y: step.id === stepId ? y : nodeY
        };
        blocks.push(currentBlock);
      } else {
        if (currentBlock) {
          currentBlock.supports.push(step);
        } else {
          blocks.push({
            primary: step,
            supports: [],
            y: 0
          });
        }
      }
    });

    // 2. Sort primary blocks based on vertical layout Y position
    blocks.sort((a, b) => a.y - b.y);

    // 3. Flatten grouped blocks and update sequence orders accordingly
    const newSteps: TestStepDto[] = [];
    blocks.forEach((block) => {
      const cleanConfig = { ...block.primary.config };
      delete cleanConfig.x;
      delete cleanConfig.y;
      newSteps.push({
        ...block.primary,
        sequenceOrder: newSteps.length + 1,
        config: cleanConfig,
        updatedAt: new Date().toISOString()
      });

      block.supports.forEach((support) => {
        const cleanSupportConfig = { ...support.config };
        delete cleanSupportConfig.x;
        delete cleanSupportConfig.y;
        newSteps.push({
          ...support,
          sequenceOrder: newSteps.length + 1,
          config: cleanSupportConfig,
          updatedAt: new Date().toISOString()
        });
      });
    });

    set({ 
      past: [...get().past, current],
      future: [],
      steps: newSteps, 
      isDirty: true 
    });
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
