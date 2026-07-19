import React, { useState } from 'react';
import { Card, Button, Input, Select, Switch } from '../../ui';
import { Trash2, Plus, ArrowUp, ArrowDown, ChevronDown, ChevronRight, Monitor, KeyRound } from 'lucide-react';
import { TestStepDto, MainframeAction } from '../../../types/api';

interface MainframeTerminalConfigProps {
  step: TestStepDto;
  handleConfigChange: (key: string, value: any) => void;
}

export const MainframeTerminalConfig: React.FC<MainframeTerminalConfigProps> = ({
  step,
  handleConfigChange
}) => {
  const mainframeHost = step.config.mainframeHost || '';
  const mainframePort = step.config.mainframePort || 23;
  const useSsl = step.config.useSsl || false;
  const terminalType = step.config.terminalType || 'IBM-3278-2';
  const codePage = step.config.codePage || 'CP037';
  const connectTimeoutMs = step.config.connectTimeoutMs || 10000;
  const actions = step.config.mainframeActions || [];
  
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const handleAddAction = () => {
    const newAction: MainframeAction = {
      type: 'waitForField',
      timeout: 10000
    };
    const updated = [...actions, newAction];
    handleConfigChange('mainframeActions', updated);
    setExpandedIndex(updated.length - 1);
  };

  const handleRemoveAction = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = actions.filter((_, aIdx) => aIdx !== idx);
    handleConfigChange('mainframeActions', updated);
    if (expandedIndex === idx) {
      setExpandedIndex(null);
    } else if (expandedIndex !== null && expandedIndex > idx) {
      setExpandedIndex(expandedIndex - 1);
    }
  };

  const handleActionChange = (idx: number, field: keyof MainframeAction, value: any) => {
    const updated = actions.map((a, aIdx) => {
      if (aIdx === idx) {
        return { ...a, [field]: value };
      }
      return a;
    });
    handleConfigChange('mainframeActions', updated);
  };

  const handleMoveUp = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (idx === 0) return;
    const updated = [...actions];
    const temp = updated[idx];
    updated[idx] = updated[idx - 1];
    updated[idx - 1] = temp;
    handleConfigChange('mainframeActions', updated);
    if (expandedIndex === idx) setExpandedIndex(idx - 1);
    else if (expandedIndex === idx - 1) setExpandedIndex(idx);
  };

  const handleMoveDown = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (idx === actions.length - 1) return;
    const updated = [...actions];
    const temp = updated[idx];
    updated[idx] = updated[idx + 1];
    updated[idx + 1] = temp;
    handleConfigChange('mainframeActions', updated);
    if (expandedIndex === idx) setExpandedIndex(idx + 1);
    else if (expandedIndex === idx + 1) setExpandedIndex(idx);
  };

  const keyOptions = [
    { value: 'ENTER', label: 'ENTER' },
    { value: 'CLEAR', label: 'CLEAR' },
    { value: 'PA1', label: 'PA1' },
    { value: 'PA2', label: 'PA2' },
    { value: 'PA3', label: 'PA3' },
    { value: 'PF1', label: 'PF1' },
    { value: 'PF2', label: 'PF2' },
    { value: 'PF3', label: 'PF3' },
    { value: 'PF4', label: 'PF4' },
    { value: 'PF5', label: 'PF5' },
    { value: 'PF6', label: 'PF6' },
    { value: 'PF7', label: 'PF7' },
    { value: 'PF8', label: 'PF8' },
    { value: 'PF9', label: 'PF9' },
    { value: 'PF10', label: 'PF10' },
    { value: 'PF11', label: 'PF11' },
    { value: 'PF12', label: 'PF12' },
    { value: 'PF13', label: 'PF13' },
    { value: 'PF14', label: 'PF14' },
    { value: 'PF15', label: 'PF15' },
    { value: 'PF16', label: 'PF16' },
    { value: 'PF17', label: 'PF17' },
    { value: 'PF18', label: 'PF18' },
    { value: 'PF19', label: 'PF19' },
    { value: 'PF20', label: 'PF20' },
    { value: 'PF21', label: 'PF21' },
    { value: 'PF22', label: 'PF22' },
    { value: 'PF23', label: 'PF23' },
    { value: 'PF24', label: 'PF24' }
  ];

  return (
    <div className="space-y-6">
      {/* Connection Info */}
      <Card className="p-4 bg-secondary/10 border-border/60">
        <h3 className="text-xs font-bold text-foreground mb-4 flex items-center space-x-1.5 uppercase tracking-wider">
          <Monitor className="h-4 w-4 text-lime-400" />
          <span>Connection Settings</span>
        </h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Host Address</label>
              <Input
                value={mainframeHost}
                onChange={(e) => handleConfigChange('mainframeHost', e.target.value)}
                placeholder="mainframe.example.com"
                className="h-8 text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Port</label>
              <Input
                type="number"
                value={mainframePort}
                onChange={(e) => handleConfigChange('mainframePort', parseInt(e.target.value) || 23)}
                placeholder="23"
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Terminal Type</label>
              <Select
                value={terminalType}
                onChange={(val) => handleConfigChange('terminalType', val)}
                options={[
                  { value: 'IBM-3278-2', label: 'IBM-3278-2 (24x80)' },
                  { value: 'IBM-3278-3', label: 'IBM-3278-3 (32x80)' },
                  { value: 'IBM-3278-4', label: 'IBM-3278-4 (43x80)' },
                  { value: 'IBM-3278-5', label: 'IBM-3278-5 (27x132)' }
                ]}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Code Page</label>
              <Select
                value={codePage}
                onChange={(val) => handleConfigChange('codePage', val)}
                options={[
                  { value: 'CP037', label: 'CP037 (US/Canada EBCDIC)' },
                  { value: 'CP273', label: 'CP273 (Germany EBCDIC)' },
                  { value: 'CP500', label: 'CP500 (International EBCDIC)' },
                  { value: 'CP1047', label: 'CP1047 (IBM Open Systems)' }
                ]}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border/40 pt-3">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-foreground">Secure Connection (SSL/TLS)</span>
              <span className="text-[10px] text-muted-foreground">Encrypt terminal packets</span>
            </div>
            <Switch
              checked={useSsl}
              onChange={(e) => handleConfigChange('useSsl', e.target.checked)}
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Connection Timeout (ms)</label>
            <Input
              type="number"
              value={connectTimeoutMs}
              onChange={(e) => handleConfigChange('connectTimeoutMs', parseInt(e.target.value) || 10000)}
              className="h-8 text-xs font-mono"
            />
          </div>
        </div>
      </Card>

      {/* Mainframe Actions list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-foreground flex items-center space-x-1.5 uppercase tracking-wider">
            <KeyRound className="h-4 w-4 text-lime-400" />
            <span>Interactive Actions ({actions.length})</span>
          </h3>
          <Button
            size="sm"
            onClick={handleAddAction}
            className="h-7 text-[10px] bg-lime-600 hover:bg-lime-700 text-white font-bold"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Action
          </Button>
        </div>

        {actions.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-border/60 rounded-lg text-muted-foreground text-xs">
            No terminal actions configured yet. Add actions to navigate the mainframe screen.
          </div>
        ) : (
          <div className="space-y-2">
            {actions.map((act, idx) => {
              const isExpanded = expandedIndex === idx;
              return (
                <div
                  key={idx}
                  className={`border rounded-lg bg-card overflow-hidden transition-all duration-150 ${
                    isExpanded ? 'border-lime-500/40 shadow-sm' : 'border-border/60'
                  }`}
                >
                  {/* Action Header */}
                  <div
                    onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                    className="flex items-center justify-between p-2.5 cursor-pointer bg-secondary/15 hover:bg-secondary/30 select-none text-xs"
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-foreground uppercase text-[10px] tracking-wider">
                        {act.type}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate font-mono">
                        {act.type === 'input' && `-> [${act.row}:${act.col}] = "${act.value || ''}"`}
                        {act.type === 'sendKey' && `-> KEY: ${act.key || 'ENTER'}`}
                        {act.type === 'waitForText' && `-> TEXT: "${act.text || ''}"`}
                        {act.type === 'readField' && `-> [${act.row}:${act.col}] len ${act.length} to ${act.variableName || '?'}`}
                        {act.type === 'screenshot' && `-> "${act.name || ''}"`}
                        {act.type === 'sleep' && `-> ${act.duration || 1000}ms`}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => handleMoveUp(idx, e)}
                        disabled={idx === 0}
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => handleMoveDown(idx, e)}
                        disabled={idx === actions.length - 1}
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => handleRemoveAction(idx, e)}
                        className="h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Action Content */}
                  {isExpanded && (
                    <div className="p-3 border-t border-border/40 bg-secondary/5 space-y-3">
                      <div>
                        <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Action Type</label>
                        <Select
                          value={act.type}
                          onChange={(val) => handleActionChange(idx, 'type', val)}
                          options={[
                            { value: 'waitForField', label: 'Wait for Keyboard Unlock' },
                            { value: 'waitForText', label: 'Wait for Specific Text' },
                            { value: 'input', label: 'Input Text at Coordinates' },
                            { value: 'sendKey', label: 'Send Terminal Key (AID)' },
                            { value: 'readField', label: 'Read Text Field' },
                            { value: 'screenshot', label: 'Capture Screenshot' },
                            { value: 'sleep', label: 'Sleep / Pause' }
                          ]}
                          className="h-8 text-xs font-bold"
                        />
                      </div>

                      {/* WaitForField Config */}
                      {act.type === 'waitForField' && (
                        <div>
                          <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Timeout (ms)</label>
                          <Input
                            type="number"
                            value={act.timeout || 10000}
                            onChange={(e) => handleActionChange(idx, 'timeout', parseInt(e.target.value) || 10000)}
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                      )}

                      {/* WaitForText Config */}
                      {act.type === 'waitForText' && (
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2">
                            <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Wait Target Text</label>
                            <Input
                              value={act.text || ''}
                              onChange={(e) => handleActionChange(idx, 'text', e.target.value)}
                              placeholder="READY"
                              className="h-8 text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Timeout (ms)</label>
                            <Input
                              type="number"
                              value={act.timeout || 10000}
                              onChange={(e) => handleActionChange(idx, 'timeout', parseInt(e.target.value) || 10000)}
                              className="h-8 text-xs font-mono"
                            />
                          </div>
                        </div>
                      )}

                      {/* Input Config */}
                      {act.type === 'input' && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Row (1-based)</label>
                              <Input
                                type="number"
                                value={act.row || 1}
                                onChange={(e) => handleActionChange(idx, 'row', parseInt(e.target.value) || 1)}
                                className="h-8 text-xs font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Col (1-based)</label>
                              <Input
                                type="number"
                                value={act.col || 1}
                                onChange={(e) => handleActionChange(idx, 'col', parseInt(e.target.value) || 1)}
                                className="h-8 text-xs font-mono"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Text Value (Variables allowed)</label>
                            <Input
                              value={act.value || ''}
                              onChange={(e) => handleActionChange(idx, 'value', e.target.value)}
                              placeholder="e.g. {{username}}"
                              className="h-8 text-xs font-mono"
                            />
                          </div>
                        </div>
                      )}

                      {/* SendKey Config */}
                      {act.type === 'sendKey' && (
                        <div>
                          <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Key Name</label>
                          <Select
                            value={act.key || 'ENTER'}
                            onChange={(val) => handleActionChange(idx, 'key', val)}
                            options={keyOptions}
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                      )}

                      {/* ReadField Config */}
                      {act.type === 'readField' && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Row (1-based)</label>
                              <Input
                                type="number"
                                value={act.row || 1}
                                onChange={(e) => handleActionChange(idx, 'row', parseInt(e.target.value) || 1)}
                                className="h-8 text-xs font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Col (1-based)</label>
                              <Input
                                type="number"
                                value={act.col || 1}
                                onChange={(e) => handleActionChange(idx, 'col', parseInt(e.target.value) || 1)}
                                className="h-8 text-xs font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Length</label>
                              <Input
                                type="number"
                                value={act.length || 1}
                                onChange={(e) => handleActionChange(idx, 'length', parseInt(e.target.value) || 1)}
                                className="h-8 text-xs font-mono"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Extract to Variable Name</label>
                            <Input
                              value={act.variableName || ''}
                              onChange={(e) => handleActionChange(idx, 'variableName', e.target.value)}
                              placeholder="e.g. systemId"
                              className="h-8 text-xs font-mono"
                            />
                          </div>
                        </div>
                      )}

                      {/* Screenshot Config */}
                      {act.type === 'screenshot' && (
                        <div>
                          <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Screenshot Identifier</label>
                          <Input
                            value={act.name || ''}
                            onChange={(e) => handleActionChange(idx, 'name', e.target.value)}
                            placeholder="e.g. welcome_screen"
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                      )}

                      {/* Sleep Config */}
                      {act.type === 'sleep' && (
                        <div>
                          <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Duration (ms)</label>
                          <Input
                            type="number"
                            value={act.duration || 1000}
                            onChange={(e) => handleActionChange(idx, 'duration', parseInt(e.target.value) || 1000)}
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MainframeTerminalConfig;
