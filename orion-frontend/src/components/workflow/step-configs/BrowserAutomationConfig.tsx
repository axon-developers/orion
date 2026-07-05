import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Dialog, DialogHeader, DialogTitle, DialogFooter } from '../../ui';
import { Trash2, Plus, ArrowUp, ArrowDown, ChevronDown, ChevronRight, Eye, MonitorPlay, AlertCircle, Download, Check, Upload } from 'lucide-react';
import { TestStepDto } from '../../../types/api';
import api from '../../../lib/api';
import { toast } from 'sonner';

declare global {
  interface Window {
    __orion_extension_present__?: boolean;
  }
}

interface BrowserAutomationConfigProps {
  step: TestStepDto;
  handleConfigChange: (key: string, value: any) => void;
}

export const BrowserAutomationConfig: React.FC<BrowserAutomationConfigProps> = ({
  step,
  handleConfigChange
}) => {
  const actions = step.config.actions || [];
  const viewportWidth = step.config.viewportWidth || 1280;
  const viewportHeight = step.config.viewportHeight || 720;
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Extension states
  const [isExtensionInstalled, setIsExtensionInstalled] = useState<boolean>(false);
  const [isExtensionRecording, setIsExtensionRecording] = useState<boolean>(false);
  const [showExtensionUrlDialog, setShowExtensionUrlDialog] = useState<boolean>(false);
  const [recordingUrl, setRecordingUrl] = useState<string>('https://');

  // Sandbox states
  const [showSandboxDialog, setShowSandboxDialog] = useState<boolean>(false);
  const [sandboxUrlInput, setSandboxUrlInput] = useState<string>('https://');
  const [sandboxActiveUrl, setSandboxActiveUrl] = useState<string | null>(null);
  const [sandboxActions, setSandboxActions] = useState<any[]>([]);

  // Check extension presence on mount and check periodically
  useEffect(() => {
    const checkExtension = () => {
      setIsExtensionInstalled(!!window.__orion_extension_present__);
    };
    checkExtension();
    const interval = setInterval(checkExtension, 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen for extension complete message
  useEffect(() => {
    const handleExtensionComplete = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.actions) {
        handleConfigChange('actions', customEvent.detail.actions);
        setIsExtensionRecording(false);
      }
    };
    window.addEventListener('OrionRecordingComplete', handleExtensionComplete);
    return () => window.removeEventListener('OrionRecordingComplete', handleExtensionComplete);
  }, [handleConfigChange]);

  // Listen for sandbox postMessage recording actions
  useEffect(() => {
    const handleSandboxMessage = (e: MessageEvent) => {
      if (e.data && e.data.source === 'orion-proxy-recorder') {
        const newAction = e.data.action;
        setSandboxActions((prev) => [...prev, newAction]);
      }
    };
    window.addEventListener('message', handleSandboxMessage);
    return () => window.removeEventListener('message', handleSandboxMessage);
  }, []);

  const handleAddAction = () => {
    const newAction = {
      type: 'navigate',
      url: '',
      selector: '',
      value: '',
      name: '',
      timeout: 10000
    };
    const updated = [...actions, newAction];
    handleConfigChange('actions', updated);
    setExpandedIndex(updated.length - 1);
  };

  const handleRemoveAction = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = actions.filter((_: any, aIdx: number) => aIdx !== idx);
    handleConfigChange('actions', updated);
    if (expandedIndex === idx) {
      setExpandedIndex(null);
    } else if (expandedIndex !== null && expandedIndex > idx) {
      setExpandedIndex(expandedIndex - 1);
    }
  };

  const handleActionChange = (idx: number, field: string, value: any) => {
    const updated = actions.map((a: any, aIdx: number) => {
      if (aIdx === idx) {
        return { ...a, [field]: value };
      }
      return a;
    });
    handleConfigChange('actions', updated);
  };

  const handleMoveUp = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (idx === 0) return;
    const updated = [...actions];
    const temp = updated[idx];
    updated[idx] = updated[idx - 1];
    updated[idx - 1] = temp;
    handleConfigChange('actions', updated);
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
    handleConfigChange('actions', updated);
    if (expandedIndex === idx) setExpandedIndex(idx + 1);
    else if (expandedIndex === idx + 1) setExpandedIndex(idx);
  };

  // Extension Action triggers
  const startExtensionRecording = () => {
    if (!recordingUrl || recordingUrl === 'https://') return;
    setShowExtensionUrlDialog(false);
    setIsExtensionRecording(true);
    window.dispatchEvent(new CustomEvent('OrionStartRecording', {
      detail: { url: recordingUrl }
    }));
  };

  const stopExtensionRecording = () => {
    window.dispatchEvent(new CustomEvent('OrionStopRecording'));
  };

  // Sandbox triggers
  const startSandboxRecording = () => {
    if (!sandboxUrlInput || sandboxUrlInput === 'https://') return;
    setSandboxActions([
      {
        type: 'navigate',
        url: sandboxUrlInput
      }
    ]);
    // Point iframe to backend proxy route
    setSandboxActiveUrl(`${api.defaults.baseURL || ''}/record/proxy?url=${encodeURIComponent(sandboxUrlInput)}`);
  };

  const saveSandboxRecording = () => {
    handleConfigChange('actions', sandboxActions);
    setShowSandboxDialog(false);
    setSandboxActiveUrl(null);
    setSandboxActions([]);
  };

  const downloadExtensionZip = async () => {
    try {
      const res = await api.get('/extension/download', {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'orion-extension.zip');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Extension downloaded successfully');
    } catch (err: any) {
      toast.error('Failed to download extension: ' + (err.message || 'Unknown error'));
    }
  };

  const downloadScriptJson = () => {
    try {
      const dataStr = JSON.stringify(actions, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `orion-script-${step.name || 'automation'}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Script exported successfully');
    } catch (err: any) {
      toast.error('Failed to export script: ' + (err.message || 'Unknown error'));
    }
  };

  const importScriptJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          handleConfigChange('actions', parsed);
          toast.success('Script imported successfully');
        } else {
          toast.error('Invalid file format. Expected a JSON array of actions.');
        }
      } catch (err) {
        toast.error('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const renderActionFields = (action: any, idx: number) => {
    switch (action.type) {
      case 'navigate':
        return (
          <div className="space-y-2 mt-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Target URL</label>
              <Input
                className="h-8 text-xs py-1"
                placeholder="e.g. https://example.com/login"
                value={action.url || ''}
                onChange={(e) => handleActionChange(idx, 'url', e.target.value)}
              />
            </div>
          </div>
        );
      case 'fill':
        return (
          <div className="space-y-2 mt-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Selector</label>
              <Input
                className="h-8 text-xs py-1"
                placeholder="CSS Selector (e.g. #username or input[name=email])"
                value={action.selector || ''}
                onChange={(e) => handleActionChange(idx, 'selector', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Value</label>
              <Input
                className="h-8 text-xs py-1"
                placeholder="e.g. my-username or {{secrets.PASSWORD}}"
                value={action.value || ''}
                onChange={(e) => handleActionChange(idx, 'value', e.target.value)}
              />
            </div>
          </div>
        );
      case 'click':
        return (
          <div className="space-y-2 mt-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Selector</label>
              <Input
                className="h-8 text-xs py-1"
                placeholder="CSS Selector (e.g. #submit-btn or button.login)"
                value={action.selector || ''}
                onChange={(e) => handleActionChange(idx, 'selector', e.target.value)}
              />
            </div>
          </div>
        );
      case 'waitForElement':
        return (
          <div className="space-y-2 mt-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Selector</label>
              <Input
                className="h-8 text-xs py-1"
                placeholder="CSS Selector (e.g. .dashboard)"
                value={action.selector || ''}
                onChange={(e) => handleActionChange(idx, 'selector', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Timeout (ms)</label>
              <Input
                className="h-8 text-xs py-1"
                type="number"
                placeholder="Default: 10000"
                value={action.timeout || 10000}
                onChange={(e) => handleActionChange(idx, 'timeout', parseInt(e.target.value) || 10000)}
              />
            </div>
          </div>
        );
      case 'screenshot':
        return (
          <div className="space-y-2 mt-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Screenshot Name</label>
              <Input
                className="h-8 text-xs py-1"
                placeholder="e.g. login_dashboard"
                value={action.name || ''}
                onChange={(e) => handleActionChange(idx, 'name', e.target.value)}
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Recorder Helper Bar */}
      <div className="p-3 bg-secondary/15 rounded-lg border border-border/40 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground/80 flex items-center gap-1.5">
            <MonitorPlay className="h-4 w-4 text-primary" /> Test Steps Recorder
          </span>
          {isExtensionInstalled ? (
            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
              <Check className="h-3 w-3" /> Extension Loaded
            </span>
          ) : (
            <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Extension Missing
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {isExtensionInstalled ? (
            isExtensionRecording ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={stopExtensionRecording}
                className="w-full text-[11px] h-8 font-bold animate-pulse"
              >
                Stop Recording
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setShowExtensionUrlDialog(true)}
                className="w-full text-[11px] h-8 font-bold"
              >
                Record via Extension
              </Button>
            )
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadExtensionZip}
              className="w-full text-[11px] h-8 font-bold flex items-center justify-center gap-1 border-dashed border-primary/40 hover:border-primary"
            >
              <Download className="h-3 w-3" /> Get Extension ZIP
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setShowSandboxDialog(true);
              setSandboxActiveUrl(null);
              setSandboxActions([]);
            }}
            className="w-full text-[11px] h-8 font-bold"
          >
            Record in Sandbox
          </Button>
        </div>
      </div>

      {/* Viewport Settings */}
      <div className="grid grid-cols-2 gap-3 pb-3 border-b border-border/40">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Viewport Width</label>
          <Input
            type="number"
            value={viewportWidth}
            onChange={(e) => handleConfigChange('viewportWidth', parseInt(e.target.value) || 1280)}
            placeholder="1280"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Viewport Height</label>
          <Input
            type="number"
            value={viewportHeight}
            onChange={(e) => handleConfigChange('viewportHeight', parseInt(e.target.value) || 720)}
            placeholder="720"
          />
        </div>
      </div>

      {/* Actions Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Automation Script</label>
          <div className="flex items-center space-x-1.5">
            {actions.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadScriptJson}
                className="h-7 text-[10px] px-2 flex items-center gap-1 border-dashed hover:border-primary hover:text-primary"
              >
                <Download className="h-3 w-3" /> Export JSON
              </Button>
            )}
            <label className="cursor-pointer">
              <span className="inline-flex items-center justify-center rounded-md border border-input bg-background px-2 py-1 h-7 text-[10px] font-semibold text-muted-foreground hover:bg-accent hover:text-accent-foreground border-dashed hover:border-primary hover:text-primary">
                <Upload className="h-3 w-3 mr-1" /> Import JSON
              </span>
              <input
                type="file"
                accept=".json"
                onChange={importScriptJson}
                className="hidden"
              />
            </label>
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              onClick={handleAddAction}
              className="h-7 text-[10px] px-2 flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Add Action
            </Button>
          </div>
        </div>

        {actions.length === 0 ? (
          <div className="text-center p-6 bg-secondary/10 border border-dashed border-border/60 rounded-md text-xs text-muted-foreground">
            No actions defined. Add navigation, clicks, or text input to build your script.
          </div>
        ) : (
          <div className="space-y-2">
            {actions.map((action: any, idx: number) => {
              const isExpanded = expandedIndex === idx;
              const typeLabel = action.type.charAt(0).toUpperCase() + action.type.slice(1);
              return (
                <Card key={idx} className="border border-border/60 overflow-hidden bg-card/50">
                  <div 
                    onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-secondary/15 select-none"
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className="w-4 h-4 rounded bg-primary/10 flex items-center justify-center text-[9.5px] text-primary shrink-0 font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-[11px] font-bold capitalize text-foreground/90 shrink-0">
                        {action.type === 'waitForElement' ? 'Wait For Element' : typeLabel}
                      </span>
                      {action.type === 'navigate' && action.url && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                          ({action.url})
                        </span>
                      )}
                      {action.type === 'click' && action.selector && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                          ({action.selector})
                        </span>
                      )}
                      {action.type === 'screenshot' && action.name && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[150px] flex items-center gap-1">
                          <Eye className="h-2.5 w-2.5" /> ({action.name})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={idx === 0}
                        onClick={(e) => handleMoveUp(idx, e)}
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={idx === actions.length - 1}
                        onClick={(e) => handleMoveDown(idx, e)}
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleRemoveAction(idx, e)}
                        className="h-6 w-6 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-3 border-t border-border/40 bg-secondary/5 text-xs space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Action Type</label>
                        <Select
                          className="h-8 text-xs py-0.5"
                          options={[
                            { value: 'navigate', label: 'Navigate to URL' },
                            { value: 'fill', label: 'Type Value (Fill Form)' },
                            { value: 'click', label: 'Click Element' },
                            { value: 'waitForElement', label: 'Wait For Element' },
                            { value: 'screenshot', label: 'Take Screenshot' }
                          ]}
                          value={action.type || 'navigate'}
                          onChange={(e) => handleActionChange(idx, 'type', e.target.value)}
                        />
                      </div>
                      {renderActionFields(action, idx)}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Extension Start URL Dialog */}
      <Dialog isOpen={showExtensionUrlDialog} onClose={() => setShowExtensionUrlDialog(false)} size="md">
        <DialogHeader>
          <DialogTitle>Start Extension Recording</DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-4">
          <p className="text-xs text-muted-foreground leading-normal">
            A new tab will open pointing to this URL. The extension will record your keystrokes and clicks until you hit <strong>Stop Recording</strong>.
          </p>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Starting Website URL</label>
            <Input
              type="text"
              value={recordingUrl}
              onChange={(e) => setRecordingUrl(e.target.value)}
              placeholder="e.g. https://example.com/login"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setShowExtensionUrlDialog(false)}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={startExtensionRecording} disabled={!recordingUrl.trim()}>Start Recording</Button>
        </DialogFooter>
      </Dialog>

      {/* In-App Sandbox Recording Dialog */}
      <Dialog isOpen={showSandboxDialog} onClose={() => { setShowSandboxDialog(false); setSandboxActiveUrl(null); }} size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <MonitorPlay className="h-5 w-5 text-primary" /> Zero-Install Step Recorder Sandbox
          </DialogTitle>
        </DialogHeader>
        
        {!sandboxActiveUrl ? (
          /* Prompt starting URL */
          <div className="p-6 space-y-4">
            <p className="text-xs text-muted-foreground leading-normal">
              Enter the target URL. We will proxy page resources through the server, strip security headers, and load it securely.
            </p>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Website URL</label>
              <Input
                type="text"
                value={sandboxUrlInput}
                onChange={(e) => setSandboxUrlInput(e.target.value)}
                placeholder="e.g. https://example.com/login"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowSandboxDialog(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={startSandboxRecording} disabled={!sandboxUrlInput.trim()}>Start Sandbox</Button>
            </DialogFooter>
          </div>
        ) : (
          /* Main Interactive Split Sandbox */
          <div className="flex flex-col h-[75vh]">
            <div className="flex-1 grid grid-cols-3 overflow-hidden border-b border-border/30">
              {/* Proxied Iframe sandbox */}
              <div className="col-span-2 relative bg-white h-full">
                <iframe
                  src={sandboxActiveUrl}
                  title="Recording Sandbox iframe"
                  className="w-full h-full border-none"
                />
              </div>

              {/* Recorded events logs */}
              <div className="col-span-1 border-l border-border/30 bg-secondary/10 flex flex-col h-full overflow-hidden">
                <div className="p-3 bg-secondary/20 border-b border-border/30 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Recorded Actions</span>
                  <span className="text-[10px] text-emerald-400 font-bold animate-pulse flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-400"></span> Live Capturing
                  </span>
                </div>
                <div className="flex-1 p-3 overflow-y-auto space-y-2 font-mono text-[10px]">
                  {sandboxActions.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground font-sans">
                      Start clicking or typing inside the sandboxed window to record steps...
                    </div>
                  ) : (
                    sandboxActions.map((act, aIdx) => (
                      <div key={aIdx} className="p-2 border border-border/50 bg-card rounded flex flex-col gap-1 shadow-sm leading-relaxed">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-primary capitalize">{aIdx + 1}. {act.type}</span>
                          {act.value && <span className="text-muted-foreground truncate max-w-[80px]">("{act.value}")</span>}
                        </div>
                        {act.url && <div className="text-[9px] text-muted-foreground truncate">{act.url}</div>}
                        {act.selector && <div className="text-[9px] text-foreground/80 truncate font-semibold bg-secondary/15 px-1 py-0.5 rounded">{act.selector}</div>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="p-4 bg-background shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSandboxActiveUrl(null);
                  setSandboxActions([]);
                }}
              >
                Reset Start URL
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowSandboxDialog(false);
                  setSandboxActiveUrl(null);
                  setSandboxActions([]);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={saveSandboxRecording}
                disabled={sandboxActions.length === 0}
              >
                Save {sandboxActions.length} Step(s) to Config
              </Button>
            </DialogFooter>
          </div>
        )}
      </Dialog>
    </div>
  );
};
