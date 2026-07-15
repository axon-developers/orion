import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface JsonTreeViewerProps {
  data: any;
  onSelectPath: (path: string) => void;
  path?: string;
  depth?: number;
}

export const JsonTreeViewer: React.FC<JsonTreeViewerProps> = ({
  data,
  onSelectPath,
  path = '$',
  depth = 0
}) => {
  const [isExpanded, setIsExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (key: string) => {
    setIsExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isObject = (val: any) => val !== null && typeof val === 'object';

  if (data === null) {
    return (
      <span 
        onClick={() => onSelectPath(path)}
        className="text-slate-500 font-mono text-xs cursor-pointer hover:bg-secondary/40 px-1 rounded"
      >
        null
      </span>
    );
  }

  if (Array.isArray(data)) {
    return (
      <div className="font-mono text-xs select-none">
        <span 
          onClick={() => onSelectPath(path)} 
          className="text-amber-400 cursor-pointer hover:bg-secondary/40 px-1 rounded font-bold"
        >
          Array[{data.length}]
        </span>
        <div className="pl-4 border-l border-border/40 mt-1 space-y-1">
          {data.map((item, idx) => {
            const currentPath = `${path}[${idx}]`;
            const hasChildren = isObject(item);
            const key = `[${idx}]`;

            return (
              <div key={idx} className="flex flex-col">
                <div className="flex items-center space-x-1 py-0.5">
                  {hasChildren && (
                    <button 
                      onClick={() => toggleExpand(key)}
                      className="p-0.5 hover:bg-secondary rounded cursor-pointer text-muted-foreground shrink-0"
                    >
                      {isExpanded[key] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                  )}
                  <span 
                    onClick={() => onSelectPath(currentPath)}
                    className="text-violet-400 cursor-pointer hover:underline font-semibold"
                  >
                    {idx}
                  </span>
                  <span>:</span>
                  {!hasChildren && (
                    <span 
                      onClick={() => onSelectPath(currentPath)}
                      className="text-emerald-400 cursor-pointer truncate max-w-[200px]"
                    >
                      {JSON.stringify(item)}
                    </span>
                  )}
                </div>
                {hasChildren && isExpanded[key] && (
                  <div className="pl-2">
                    <JsonTreeViewer data={item} onSelectPath={onSelectPath} path={currentPath} depth={depth + 1} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (typeof data === 'object') {
    return (
      <div className="font-mono text-xs select-none">
        <span 
          onClick={() => onSelectPath(path)}
          className="text-amber-400 cursor-pointer hover:bg-secondary/40 px-1 rounded font-bold"
        >
          Object
        </span>
        <div className="pl-4 border-l border-border/40 mt-1 space-y-1">
          {Object.entries(data).map(([key, val]) => {
            const currentPath = path === '$' ? `$.${key}` : `${path}.${key}`;
            const hasChildren = isObject(val);

            return (
              <div key={key} className="flex flex-col">
                <div className="flex items-center space-x-1 py-0.5">
                  {hasChildren && (
                    <button 
                      onClick={() => toggleExpand(key)}
                      className="p-0.5 hover:bg-secondary rounded cursor-pointer text-muted-foreground shrink-0"
                    >
                      {isExpanded[key] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                  )}
                  <span 
                    onClick={() => onSelectPath(currentPath)}
                    className="text-violet-400 cursor-pointer hover:underline font-semibold"
                  >
                    {key}
                  </span>
                  <span>:</span>
                  {!hasChildren && (
                    <span 
                      onClick={() => onSelectPath(currentPath)}
                      className="text-emerald-400 cursor-pointer truncate max-w-[200px] hover:underline"
                    >
                      {JSON.stringify(val)}
                    </span>
                  )}
                </div>
                {hasChildren && isExpanded[key] && (
                  <div className="pl-2">
                    <JsonTreeViewer data={val} onSelectPath={onSelectPath} path={currentPath} depth={depth + 1} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <span 
      onClick={() => onSelectPath(path)}
      className="text-emerald-400 cursor-pointer hover:bg-secondary/40 font-mono text-xs px-1 rounded hover:underline"
    >
      {JSON.stringify(data)}
    </span>
  );
};
export default JsonTreeViewer;
