import React, { useState, useEffect } from 'react';
import { Button, Input, Textarea } from '../../ui';
import { Plus, Trash2, Code2, ListStart, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface HeaderRow {
  id: string;
  key: string;
  value: string;
}

interface HeaderTableEditorProps {
  headers: any; // Can be a Record<string, string> or a JSON string
  onChange: (value: Record<string, string>) => void;
}

export const HeaderTableEditor: React.FC<HeaderTableEditorProps> = ({
  headers,
  onChange
}) => {
  const [editorMode, setEditorMode] = useState<'table' | 'json'>('table');
  const [rows, setRows] = useState<HeaderRow[]>([]);
  const [rawJson, setRawJson] = useState<string>('');

  // Helper to compare current rows structures against external headers
  const isSameHeaders = (incoming: any, currentRows: HeaderRow[]) => {
    let parsed: Record<string, string> = {};
    if (incoming) {
      if (typeof incoming === 'object') {
        parsed = incoming;
      } else if (typeof incoming === 'string' && incoming.trim() !== '') {
        try {
          parsed = JSON.parse(incoming);
        } catch {
          return false;
        }
      }
    }

    const activeRows = currentRows.filter(r => r.key.trim() !== '');
    const incomingEntries = Object.entries(parsed).filter(([k]) => k.trim() !== '');

    if (activeRows.length !== incomingEntries.length) return false;

    for (const [key, value] of incomingEntries) {
      const matched = activeRows.find(r => r.key.trim() === key.trim());
      if (!matched || matched.value !== String(value)) {
        return false;
      }
    }
    return true;
  };

  // Synchronize incoming headers to internal state only if structurally changed
  useEffect(() => {
    if (isSameHeaders(headers, rows)) {
      return;
    }

    let parsed: Record<string, string> = {};
    if (headers) {
      if (typeof headers === 'object') {
        parsed = headers;
      } else if (typeof headers === 'string' && headers.trim() !== '') {
        try {
          parsed = JSON.parse(headers);
        } catch {
          // Keep it as raw text if parsing fails
        }
      }
    }

    // Convert object to row arrays with stable index mapping
    const newRows = Object.entries(parsed).map(([key, value], idx) => ({
      id: `row-${idx}`,
      key,
      value: String(value)
    }));
    
    // Add one empty row if list is empty
    if (newRows.length === 0) {
      newRows.push({ id: `row-0`, key: '', value: '' });
    }
    
    setRows(newRows);
    setRawJson(JSON.stringify(parsed, null, 2));
  }, [headers]);

  // Push updates back to the parent component
  const propagateChanges = (updatedRows: HeaderRow[]) => {
    const obj: Record<string, string> = {};
    updatedRows.forEach((r) => {
      if (r.key.trim() !== '') {
        obj[r.key.trim()] = r.value;
      }
    });
    onChange(obj);
  };

  const handleRowChange = (id: string, field: 'key' | 'value', val: string) => {
    const updated = rows.map((r) => {
      if (r.id === id) {
        return { ...r, [field]: val };
      }
      return r;
    });
    setRows(updated);
    propagateChanges(updated);
  };

  const addRow = () => {
    const newRows = [...rows, { id: `row-${rows.length}`, key: '', value: '' }];
    setRows(newRows);
  };

  const removeRow = (id: string) => {
    let updated = rows.filter((r) => r.id !== id);
    if (updated.length === 0) {
      updated = [{ id: `row-0`, key: '', value: '' }];
    } else {
      updated = updated.map((r, idx) => ({ ...r, id: `row-${idx}` }));
    }
    setRows(updated);
    propagateChanges(updated);
  };

  const handleJsonChange = (val: string) => {
    setRawJson(val);
    try {
      if (val.trim() === '') {
        onChange({});
        return;
      }
      const parsed = JSON.parse(val);
      if (typeof parsed === 'object' && parsed !== null) {
        onChange(parsed);
      }
    } catch {
      // Don't update parent if JSON is currently invalid/incomplete
    }
  };

  const formatJson = () => {
    try {
      if (rawJson.trim() === '') return;
      const parsed = JSON.parse(rawJson);
      setRawJson(JSON.stringify(parsed, null, 2));
      toast.success('Formatted JSON successfully!');
    } catch (err: any) {
      toast.error('Invalid JSON: ' + err.message);
    }
  };

  return (
    <div className="space-y-2 border border-border/85 rounded-lg p-3 bg-card/40 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">HTTP Headers</span>
        <div className="flex items-center space-x-1.5 bg-secondary/40 p-1 rounded-md border border-border/30">
          <button
            type="button"
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
              editorMode === 'table' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setEditorMode('table')}
          >
            <ListStart className="h-3 w-3 inline mr-1" />
            Table
          </button>
          <button
            type="button"
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
              editorMode === 'json' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setEditorMode('json')}
          >
            <Code2 className="h-3 w-3 inline mr-1" />
            JSON
          </button>
        </div>
      </div>

      {editorMode === 'table' ? (
        <div className="space-y-2">
          <div className="max-h-[220px] overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
            {rows.map((row) => (
              <div key={row.id} className="flex items-center space-x-2">
                <Input
                  placeholder="Key"
                  value={row.key}
                  onChange={(e) => handleRowChange(row.id, 'key', e.target.value)}
                  className="h-8 text-xs font-mono"
                />
                <Input
                  placeholder="Value"
                  value={row.value}
                  onChange={(e) => handleRowChange(row.id, 'value', e.target.value)}
                  className="h-8 text-xs font-mono"
                />
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors hover:bg-destructive/10 cursor-pointer"
                  onClick={() => removeRow(row.id)}
                  title="Remove Header"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRow}
            className="w-full h-8 text-xs border-dashed hover:border-primary/50 text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Header Row
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="relative">
            <Textarea
              placeholder='e.g. { "Accept": "application/json", "Authorization": "Bearer {{token}}" }'
              value={rawJson}
              onChange={(e) => handleJsonChange(e.target.value)}
              rows={5}
              className="font-mono text-xs pr-12 bg-background/50"
            />
            <button
              type="button"
              onClick={formatJson}
              className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-1.5 bg-secondary/80 hover:bg-secondary rounded border border-border/60 transition-all flex items-center justify-center cursor-pointer"
              title="Format JSON"
            >
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">Specify request headers as a JSON object. Supports variable interpolation.</p>
        </div>
      )}
    </div>
  );
};
