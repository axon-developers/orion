import React from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  Node, 
  Edge,
  BackgroundVariant 
} from 'reactflow';
import 'reactflow/dist/style.css';
import StepNode from './StepNode';

// Custom node registry
const nodeTypes = {
  stepNode: StepNode,
};

interface WorkflowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange?: any;
  onEdgesChange?: any;
}

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange
}) => {
  return (
    <div className="flex-1 h-full bg-background relative overflow-hidden select-none">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="hsl(var(--border))" />
        <Controls showInteractive={false} className="!bg-card !border-border !text-foreground" />
      </ReactFlow>
    </div>
  );
};
export default WorkflowCanvas;
