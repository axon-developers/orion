import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { RefreshCcw } from 'lucide-react';

interface LoopCloseNodeProps {
  data: {
    loopName: string;
    loopType?: string;
    count?: number;
    dataSource?: string;
  };
}

const LoopCloseNode: React.FC<LoopCloseNodeProps> = ({ data }) => {
  const { loopName, loopType, count, dataSource } = data;

  const iterLabel =
    loopType === 'FOR_EACH'
      ? `For each in ${dataSource || 'array'}`
      : count
      ? `× ${count} iterations`
      : '';

  return (
    <div className="relative" style={{ width: 340 }}>
      {/* invisible target handle for incoming edge from last body step */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        style={{ opacity: 0, pointerEvents: 'none' }}
      />

      {/* Closing bracket bar */}
      <div className="flex items-center justify-between px-3 py-2 rounded-b-md border border-t-0 border-dashed border-purple-500/50 bg-purple-950/20">
        <div className="flex items-center gap-2">
          <RefreshCcw className="h-3.5 w-3.5 text-purple-400 shrink-0" />
          <span className="text-[10px] font-bold text-purple-300 uppercase tracking-widest truncate max-w-[160px]">
            ↩ End Loop
          </span>
          {loopName && (
            <span className="text-[9px] text-purple-500 font-mono truncate max-w-[100px]">
              {loopName}
            </span>
          )}
        </div>
        {iterLabel && (
          <span className="text-[9px] text-purple-400/80 font-mono shrink-0 ml-2">
            {iterLabel}
          </span>
        )}
      </div>

      {/* invisible source handle for outgoing edge to next outer step */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={{ opacity: 0, pointerEvents: 'none' }}
      />
    </div>
  );
};

export default LoopCloseNode;
