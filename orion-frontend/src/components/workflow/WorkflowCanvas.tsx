import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls,
  MiniMap, 
  Node, 
  Edge,
  BackgroundVariant 
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import StepNode from './StepNode';
import { useWorkflowStore } from '../../stores/workflow-store';
import { useThemeStore } from '../../stores/theme-store';
import { Copy, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

const nodeTypes = {
  stepNode: StepNode,
};

interface WorkflowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodeDragStop: (event: any, node: Node) => void;
  readOnly?: boolean;
}

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  nodes,
  edges,
  onNodeDragStop,
  readOnly = false
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ id: string; top: number; left: number } | null>(null);
  const { steps, addStep, deleteStep } = useWorkflowStore();
  const { theme } = useThemeStore();

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (readOnly) return;
      event.preventDefault();
      
      const pane = ref.current?.getBoundingClientRect();
      if (!pane) return;
      
      setMenu({
        id: node.id,
        top: event.clientY - pane.top,
        left: event.clientX - pane.left,
      });
    },
    [setMenu, readOnly]
  );

  const onPaneClick = useCallback(() => setMenu(null), [setMenu]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleDuplicate = () => {
    if (readOnly || !menu) return;
    const stepToDuplicate = steps.find(s => s.id === menu.id);
    if (stepToDuplicate) {
      const newStep = {
        ...stepToDuplicate,
        id: `step-${Date.now()}`,
        name: `${stepToDuplicate.name} (Copy)`,
        sequenceOrder: steps.length + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Attempt to place it slightly offset from the original node if x,y are stored in config
      if (newStep.config && newStep.config.x !== undefined && newStep.config.y !== undefined) {
         newStep.config = {
           ...newStep.config,
           x: Number(newStep.config.x) + 50,
           y: Number(newStep.config.y) + 50
         };
      }

      addStep(newStep);
      toast.success('Step duplicated');
    }
    setMenu(null);
  };

  const handleDelete = () => {
    if (readOnly || !menu) return;
    deleteStep(menu.id);
    toast.success('Step deleted');
    setMenu(null);
  };

  return (
    <div className="flex-1 h-full bg-background relative overflow-hidden select-none" ref={ref}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeDragStop={readOnly ? undefined : onNodeDragStop}
        onNodeContextMenu={readOnly ? undefined : onNodeContextMenu}
        onPaneClick={onPaneClick}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={true}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        snapToGrid={true}
        snapGrid={[16, 16]}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="hsl(var(--border))" />
        <Controls showInteractive={false} className="!bg-card !border-border !text-foreground" />
        <MiniMap 
          nodeColor={theme === 'dark' ? '#818cf8' : '#4f46e5'} 
          maskColor={theme === 'dark' ? 'rgba(15, 23, 42, 0.6)' : 'rgba(241, 245, 249, 0.6)'} 
          className="!bg-card !border-border !rounded-lg overflow-hidden" 
        />
      </ReactFlow>

      {menu && !readOnly && (
        <div 
          style={{ top: menu.top, left: menu.left }} 
          className="absolute z-50 min-w-[160px] bg-card/80 backdrop-blur-xl border border-border shadow-2xl rounded-md py-1 animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b border-border/50 mb-1 flex justify-between items-center">
            Actions
            <button onClick={() => setMenu(null)} className="hover:text-foreground"><X className="h-3 w-3" /></button>
          </div>
          <button 
            onClick={handleDuplicate}
            className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer"
          >
            <Copy className="h-4 w-4" /> Duplicate
          </button>
          <button 
            onClick={handleDelete}
            className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-destructive/20 hover:text-destructive transition-colors cursor-pointer text-destructive"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default WorkflowCanvas;
