import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls,
  Node, 
  Edge,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import StepNode from './StepNode';
import { useWorkflowStore } from '../../stores/workflow-store';
import { useThemeStore } from '../../stores/theme-store';
import { Copy, Trash2, X, Search, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { toPng } from 'html-to-image';

const nodeTypes = {
  stepNode: StepNode,
};

interface WorkflowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodeDragStop: (event: any, node: Node) => void;
  readOnly?: boolean;
}

export const WorkflowCanvasInner: React.FC<WorkflowCanvasProps> = ({
  nodes,
  edges,
  onNodeDragStop,
  readOnly = false
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ id: string; top: number; left: number } | null>(null);
  const { steps, addStep, deleteStep, selectedStepId, selectStep, undo, redo } = useWorkflowStore();
  const { theme } = useThemeStore();
  const { setCenter, getViewport } = useReactFlow();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Focus and center step node in the remaining canvas space when step config panel opens / step is selected
  useEffect(() => {
    if (!selectedStepId) return;

    const timer = setTimeout(() => {
      const targetId = selectedStepId.includes('-sub-')
        ? selectedStepId.split('-sub-')[0]
        : selectedStepId;

      const targetNode = nodes.find((n) => n.id === targetId);
      if (!targetNode) return;

      const nodeWidth = targetNode.measured?.width || (targetNode.width ?? 320);
      const nodeHeight = targetNode.measured?.height || (targetNode.height ?? 90);
      const nodeCenterX = targetNode.position.x + nodeWidth / 2;
      const nodeCenterY = targetNode.position.y + nodeHeight / 2;

      const currentZoom = getViewport()?.zoom || 1;
      const targetZoom = Math.min(Math.max(currentZoom, 1.0), 1.2);

      // Center the node directly in the workflow canvas space (flexbox container)
      setCenter(nodeCenterX, nodeCenterY, {
        zoom: targetZoom,
        duration: 500,
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [selectedStepId, nodes, setCenter, getViewport]);

  // Node context menu handler
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (readOnly) return;
      event.preventDefault();
      
      const pane = ref.current?.getBoundingClientRect();
      if (!pane) return;

      const actualStepId = (node.data?.step as any)?.id || node.id;
      
      setMenu({
        id: actualStepId,
        top: event.clientY - pane.top,
        left: event.clientX - pane.left,
      });
    },
    [setMenu, readOnly]
  );

  const onPaneClick = useCallback(() => setMenu(null), [setMenu]);

  // Handle Search Input Filter
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const filtered = steps.filter(s => 
      s.name.toLowerCase().includes(query.toLowerCase()) || 
      s.stepType.toLowerCase().includes(query.toLowerCase()) ||
      (s.description && s.description.toLowerCase().includes(query.toLowerCase()))
    );
    setSearchResults(filtered);
  };

  // Center canvas viewport on matching search result step
  const handleSearchResultClick = (stepId: string) => {
    const targetNode = nodes.find(n => n.id === stepId);
    if (targetNode) {
      setCenter(targetNode.position.x + 170, targetNode.position.y + 50, { zoom: 1.15, duration: 800 });
      selectStep(stepId);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSnapshot = () => {
    if (!ref.current) return;
    
    const element = ref.current;
    toast.loading('Generating high-resolution canvas snapshot...', { id: 'snapshot-loader' });
    
    toPng(element, {
      backgroundColor: theme === 'dark' ? '#0c0d12' : '#f8fafc',
      style: {
        transform: 'scale(1)',
        transformOrigin: 'top left',
        width: element.offsetWidth.toString() + 'px',
        height: element.offsetHeight.toString() + 'px'
      },
      filter: (node: any) => {
        if (
          node.classList?.contains('react-flow__controls') || 
          node.classList?.contains('pointer-events-auto') ||
          node.tagName?.toLowerCase() === 'button'
        ) {
          return false;
        }
        return true;
      }
    })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = `orion-workflow-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
        toast.success('Snapshot downloaded successfully!', { id: 'snapshot-loader' });
      })
      .catch((err) => {
        console.error(err);
        toast.error('Failed to capture canvas snapshot: ' + err.message, { id: 'snapshot-loader' });
      });
  };

  // Keyboard Event Listeners for shortcuts (Ctrl+C / Ctrl+V / Copy / Paste)
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (
        activeTag === 'input' || 
        activeTag === 'textarea' || 
        activeTag === 'select' || 
        document.activeElement?.getAttribute('contenteditable') === 'true'
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifierPressed = isMac ? e.metaKey : e.ctrlKey;

      // Undo Action (Ctrl+Z / Cmd+Z)
      if (modifierPressed && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }

      // Redo Action (Ctrl+Y / Cmd+Y)
      if (modifierPressed && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      // Delete selected step (Delete / Backspace)
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedStepId) {
        e.preventDefault();
        if (readOnly) return;
        const targetStep = steps.find(s => s.id === selectedStepId);
        if (targetStep) {
          deleteStep(selectedStepId);
          toast.success(`Deleted step "${targetStep.name}"`);
        }
        return;
      }

      // Deselect (Escape)
      if (e.key === 'Escape' && selectedStepId) {
        e.preventDefault();
        selectStep(null);
        return;
      }

      // Copy Action (Ctrl+C / Cmd+C)
      if (modifierPressed && e.key.toLowerCase() === 'c') {
        if (!selectedStepId) return;
        const stepToCopy = steps.find(s => s.id === selectedStepId);
        if (stepToCopy) {
          e.preventDefault();
          try {
            const payload = { ...stepToCopy, isOrionStepCopy: true };
            await navigator.clipboard.writeText(JSON.stringify(payload));
            toast.success(`Copied step "${stepToCopy.name}" to clipboard`);
          } catch (err) {
            localStorage.setItem('orion_copied_step_fallback', JSON.stringify(stepToCopy));
            toast.success(`Copied step "${stepToCopy.name}" (local fallback)`);
          }
        }
      }

      // Paste Action (Ctrl+V / Cmd+V)
      if (modifierPressed && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        if (readOnly) return;
        try {
          const text = await navigator.clipboard.readText();
          let stepData: any = null;
          try {
            stepData = JSON.parse(text);
          } catch (err) {
            const fallback = localStorage.getItem('orion_copied_step_fallback');
            if (fallback) stepData = JSON.parse(fallback);
          }

          if (stepData && (stepData.isOrionStepCopy || stepData.stepType)) {
            const newStep = {
              ...stepData,
              id: `step-${Date.now()}`,
              name: `${stepData.name.replace(' (Copy)', '')} (Copy)`,
              sequenceOrder: steps.length + 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };

            // Remove flag and offset visual placement slightly
            delete newStep.isOrionStepCopy;
            const cleanConfig = { ...newStep.config };
            if (cleanConfig.x !== undefined && cleanConfig.y !== undefined) {
              cleanConfig.x = Number(cleanConfig.x) + 50;
              cleanConfig.y = Number(cleanConfig.y) + 50;
            }
            newStep.config = cleanConfig;

            addStep(newStep);
            toast.success(`Pasted step "${newStep.name}"`);
          }
        } catch (err) {
          const fallback = localStorage.getItem('orion_copied_step_fallback');
          if (fallback) {
            const stepData = JSON.parse(fallback);
            const newStep = {
              ...stepData,
              id: `step-${Date.now()}`,
              name: `${stepData.name.replace(' (Copy)', '')} (Copy)`,
              sequenceOrder: steps.length + 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            addStep(newStep);
            toast.success(`Pasted step "${newStep.name}" (local fallback)`);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedStepId, steps, addStep, readOnly]);

  // Context menu Escape key listener
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(null);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
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
      
      {/* Floating Canvas Toolbar for Step Search */}
      <div className="absolute top-4 left-4 z-10 flex items-start gap-2 pointer-events-auto">
        <div className="w-72 flex flex-col">
          <div className="relative flex items-center bg-card/85 backdrop-blur-xl border border-border/80 shadow-lg rounded-lg p-1.5 px-3">
            <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search and zoom to step..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full bg-transparent border-0 text-xs focus:outline-none text-foreground py-0.5 placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button 
                onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                className="p-0.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          
          {/* Results dropdown */}
          {searchResults.length > 0 && (
            <div className="mt-1 max-h-60 overflow-y-auto bg-card border border-border rounded-lg shadow-2xl p-1 divide-y divide-border/30 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              {searchResults.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSearchResultClick(s.id)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-secondary transition-colors cursor-pointer rounded flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-foreground truncate">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{s.stepType}</p>
                  </div>
                  <span className="text-[9px] font-mono text-muted-foreground bg-secondary/50 px-1 py-0.5 rounded border border-border/20 shrink-0 ml-2">
                    #{s.sequenceOrder}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Snapshot / Camera Button */}
        <button
          onClick={handleSnapshot}
          className="p-2 bg-card/85 backdrop-blur-xl border border-border/80 hover:bg-secondary hover:text-primary transition-all shadow-lg rounded-lg cursor-pointer text-muted-foreground shrink-0 flex items-center justify-center h-[34px] w-[34px]"
          title="Take canvas PNG snapshot"
        >
          <Camera className="h-4 w-4" />
        </button>

        {/* 1-Click Quick Favorite Steps Bar */}
        {!readOnly && (
          <div className="flex items-center gap-1 bg-card/85 backdrop-blur-xl border border-border/80 shadow-lg rounded-lg p-1 px-2 h-[34px]">
            <span className="text-[9px] font-extrabold uppercase text-muted-foreground mr-1 shrink-0">Quick Add:</span>
            <button
              onClick={() => addStep({
                id: `step-${Date.now()}`,
                testCaseId: '',
                sequenceOrder: steps.length + 1,
                name: 'HTTP Request',
                description: 'REST API call',
                stepType: 'HTTP_REQUEST',
                actionType: 'NONE',
                config: { method: 'GET', url: 'https://httpbin.org/get' },
                expectedResult: '',
                isGlobalRef: false,
                globalStepId: null,
                enabled: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              })}
              className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all cursor-pointer"
            >
              + HTTP
            </button>
            <button
              onClick={() => addStep({
                id: `step-${Date.now()}`,
                testCaseId: '',
                sequenceOrder: steps.length + 1,
                name: 'Validate Assert',
                description: 'Check status code or body',
                stepType: 'ASSERTION',
                actionType: 'EQUALS',
                config: { source: 'STATUS_CODE', operator: 'EQUALS', expectedValue: '200' },
                expectedResult: '',
                isGlobalRef: false,
                globalStepId: null,
                enabled: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              })}
              className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all cursor-pointer"
            >
              + Assert
            </button>
            <button
              onClick={() => addStep({
                id: `step-${Date.now()}`,
                testCaseId: '',
                sequenceOrder: steps.length + 1,
                name: 'Set Variable',
                description: 'Extract and store variable',
                stepType: 'SET_VARIABLE',
                actionType: 'NONE',
                config: { variables: [{ variableName: 'token', value: '{{Step_1.token}}' }] },
                expectedResult: '',
                isGlobalRef: false,
                globalStepId: null,
                enabled: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              })}
              className="text-[10px] font-bold px-2 py-0.5 rounded bg-pink-500/10 text-pink-400 border border-pink-500/20 hover:bg-pink-500/20 transition-all cursor-pointer"
            >
              + Set Var
            </button>
            <button
              onClick={() => addStep({
                id: `step-${Date.now()}`,
                testCaseId: '',
                sequenceOrder: steps.length + 1,
                name: 'Wait Delay',
                description: 'Pause workflow execution',
                stepType: 'DELAY',
                actionType: 'NONE',
                config: { durationMs: 1000 },
                expectedResult: '',
                isGlobalRef: false,
                globalStepId: null,
                enabled: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              })}
              className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20 transition-all cursor-pointer"
            >
              + Delay
            </button>
            <button
              onClick={() => addStep({
                id: `step-${Date.now()}`,
                testCaseId: '',
                sequenceOrder: steps.length + 1,
                name: 'Loop Sequence',
                description: 'Repeat child steps N times',
                stepType: 'LOOP',
                actionType: 'NONE',
                config: { type: 'COUNT', count: 5, steps: [] },
                expectedResult: '',
                isGlobalRef: false,
                globalStepId: null,
                enabled: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              })}
              className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all cursor-pointer"
            >
              + Loop
            </button>
          </div>
        )}
      </div>

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

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = (props) => (
  <ReactFlowProvider>
    <WorkflowCanvasInner {...props} />
  </ReactFlowProvider>
);

export default WorkflowCanvas;
