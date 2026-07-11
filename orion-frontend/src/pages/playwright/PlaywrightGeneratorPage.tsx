import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Card, CardHeader, CardTitle, CardDescription, CardContent, 
  Button, Input, Badge 
} from '../../components/ui';
import { 
  PlayCircle, Play, Square, RefreshCw, Trash2, Copy, Download, 
  Check, ArrowRight, Video, ChevronUp, ChevronDown, Code, 
  ListOrdered, Edit2, AlertCircle, Sparkles, Camera, Upload
} from 'lucide-react';
import { toast } from 'sonner';

interface RecordedAction {
  id: string;
  type: 'navigation' | 'click' | 'fill' | 'screenshot';
  url?: string;
  selector?: string;
  value?: string;
}

const JsonViewerCode = ({ code }: { code: string }) => {
  const highlight = (jsCode: string) => {
    if (!jsCode) return '';
    let escaped = jsCode.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Simple JS highlights
    return escaped
      .replace(/(\/\/.*)/g, '<span class="text-[#8b949e] italic">$1</span>') // comments
      .replace(/(\bconst\b|\brequire\b|\basync\b|\bawait\b|\btest\b)/g, '<span class="text-[#ff7b72] font-semibold">$1</span>') // keywords
      .replace(/('([^'\\]|\\.)*')/g, '<span class="text-[#7ee787]">$2</span>') // strings
      .replace(/(\bpage\b)/g, '<span class="text-[#79c0ff]">$1</span>'); // page object
  };

  return (
    <pre 
      className="p-4 rounded-xl bg-[#0d1117] text-[#c9d1d9] border border-[#21262d] shadow-2xl text-[13px] leading-relaxed h-[calc(100vh-380px)] min-h-[450px] overflow-auto scrollbar-thin font-mono w-full" 
      dangerouslySetInnerHTML={{ __html: highlight(code) }} 
    />
  );
};

export const PlaywrightGeneratorPage: React.FC = () => {
  const [urlInput, setUrlInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [actions, setActions] = useState<RecordedAction[]>([]);
  const [activeUrl, setActiveUrl] = useState('');
  const [iframeUrl, setIframeUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'steps' | 'code'>('steps');
  const [copied, setCopied] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const lastRecordedUrlRef = useRef<string | null>(null);

  // Load recorder listener
  useEffect(() => {
    const handleRecorderMessage = (e: MessageEvent) => {
      if (!isRecording) return;
      if (e.data && e.data.source === 'orion-proxy-recorder' && e.data.action) {
        const { action } = e.data;
        const newAction: RecordedAction = {
          id: Math.random().toString(36).substring(2, 11),
          type: action.type || 'click',
          selector: action.selector || '',
          value: action.value || ''
        };
        setActions(prev => [...prev, newAction]);
        toast.success(`Captured ${action.type || 'click'} action`);
      }
    };
    window.addEventListener('message', handleRecorderMessage);
    return () => window.removeEventListener('message', handleRecorderMessage);
  }, [isRecording]);

  // Sync to localStorage
  useEffect(() => {
    if (actions.length > 0) {
      localStorage.setItem('orion_recorded_actions', JSON.stringify(actions));
    } else {
      localStorage.removeItem('orion_recorded_actions');
    }
  }, [actions]);

  const handleStartRecording = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) {
      toast.warning('Please enter a target website URL');
      return;
    }

    let url = urlInput.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'http://' + url;
      setUrlInput(url);
    }

    const lowerUrl = url.toLowerCase();
    if (
      lowerUrl.includes('localhost:8080') || 
      lowerUrl.includes('127.0.0.1:8080') ||
      lowerUrl.includes('localhost:5173') || 
      lowerUrl.includes('127.0.0.1:5173') ||
      lowerUrl.includes('localhost:5174') || 
      lowerUrl.includes('127.0.0.1:5174')
    ) {
      toast.error('Cannot record actions on the Orion application itself to prevent proxy loops.');
      return;
    }

    setActions([
      {
        id: Math.random().toString(36).substring(2, 11),
        type: 'navigation',
        url: url
      }
    ]);
    lastRecordedUrlRef.current = url;
    setActiveUrl(url);
    setIframeUrl(`/api/record/proxy?url=${encodeURIComponent(url)}`);
    setIsRecording(true);
    toast.success('Recording started successfully');
  };

  const handleStopRecording = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsRecording(false);
    toast.info('Recording stopped. You can edit steps and download the script.');
  };

  const handleClearRecording = () => {
    setActions([]);
    setIsRecording(false);
    setActiveUrl('');
    setIframeUrl('');
    lastRecordedUrlRef.current = null;
    toast.info('Recording cleared');
  };

  const handleIframeLoad = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    if (!isRecording) return;
    try {
      const iframe = e.currentTarget;
      if (iframe.contentWindow) {
        const proxiedUrl = iframe.contentWindow.location.href;
        const urlObj = new URL(proxiedUrl);
        const targetUrl = urlObj.searchParams.get('url');
        if (targetUrl && targetUrl !== lastRecordedUrlRef.current) {
          lastRecordedUrlRef.current = targetUrl;
          const newAction: RecordedAction = {
            id: Math.random().toString(36).substring(2, 11),
            type: 'navigation',
            url: targetUrl
          };
          setActions(prev => [...prev, newAction]);
          toast.info(`Navigated inside iframe: ${targetUrl}`);
        }
      }
    } catch (err) {
      // Cross-origin fallback
    }
  };

  // Step modifiers
  const deleteAction = (id: string) => {
    setActions(prev => prev.filter(a => a.id !== id));
  };

  const moveAction = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === actions.length - 1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const newActions = [...actions];
    const temp = newActions[index];
    newActions[index] = newActions[targetIdx];
    newActions[targetIdx] = temp;
    setActions(newActions);
  };

  const updateActionValue = (id: string, field: 'selector' | 'value' | 'url', val: string) => {
    setActions(prev => prev.map(a => {
      if (a.id === id) {
        return { ...a, [field]: val };
      }
      return a;
    }));
  };

  const insertScreenshot = (index: number) => {
    const newAction: RecordedAction = {
      id: Math.random().toString(36).substring(2, 11),
      type: 'screenshot',
      value: `screenshot_${actions.length + 1}.png`
    };
    const newActions = [...actions];
    newActions.splice(index + 1, 0, newAction);
    setActions(newActions);
    toast.success('Screenshot step inserted');
  };

  const appendScreenshot = () => {
    const newAction: RecordedAction = {
      id: Math.random().toString(36).substring(2, 11),
      type: 'screenshot',
      value: `screenshot_${actions.length + 1}.png`
    };
    setActions(prev => [...prev, newAction]);
    toast.success('Screenshot step appended');
  };

  // JSON Import / Export
  const exportActionsJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(actions, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "orion_recorded_steps.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success('Actions exported to JSON file');
  };

  const importActionsJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          const sanitized = parsed.map((act: any) => ({
            id: act.id || Math.random().toString(36).substring(2, 11),
            type: act.type || 'click',
            url: act.url || '',
            selector: act.selector || '',
            value: act.value || ''
          }));
          setActions(sanitized);
          toast.success(`Imported ${sanitized.length} actions from JSON file`);
        } else {
          toast.error('Invalid file format: JSON must be an array of actions');
        }
      } catch (err) {
        toast.error('Failed to parse JSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Drag and Drop
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const newActions = [...actions];
    const draggedItem = newActions[draggedIndex];
    newActions.splice(draggedIndex, 1);
    newActions.splice(targetIndex, 0, draggedItem);
    setActions(newActions);
    setDraggedIndex(null);
    toast.success('Steps reordered successfully');
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Code generator
  const generatedScript = useMemo(() => {
    let script = `const { test, expect } = require('@playwright/test');\n\n`;
    script += `test('Recorded User Scenario', async ({ page }) => {\n`;
    
    actions.forEach((act, idx) => {
      if (act.type === 'navigation' && act.url) {
        script += `  // Navigate to target URL\n`;
        script += `  await page.goto('${act.url}');\n\n`;
      } else if (act.type === 'click' && act.selector) {
        script += `  // Click elements\n`;
        script += `  await page.locator('${act.selector}').click();\n\n`;
      } else if (act.type === 'fill' && act.selector) {
        script += `  // Fill inputs\n`;
        script += `  await page.locator('${act.selector}').fill('${act.value || ''}');\n\n`;
      } else if (act.type === 'screenshot') {
        script += `  // Take screenshot\n`;
        script += `  await page.screenshot({ path: '${act.value || `screenshot_${idx}.png`}' });\n\n`;
      }
    });
    
    script += `});\n`;
    return script;
  }, [actions]);

  const copyScript = () => {
    navigator.clipboard.writeText(generatedScript);
    setCopied(true);
    toast.success('Playwright script copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadScript = () => {
    const element = document.createElement("a");
    const file = new Blob([generatedScript], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = "recorded_scenario.spec.js";
    document.body.appendChild(element);
    element.click();
    element.remove();
    toast.success('Playwright script downloaded successfully');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/30 pb-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center">
            <PlayCircle className="mr-2.5 h-8 w-8 text-primary" />
            Playwright script generator
          </h1>
          <p className="text-muted-foreground mt-1">Open any website inside the browser recorder container to build visual end-to-end tests.</p>
        </div>
      </div>

      {/* URL Input Bar */}
      <Card className="glass relative overflow-hidden shrink-0">
        <CardContent className="p-4">
          <form onSubmit={handleStartRecording} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <PlayCircle className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Enter starting website URL (e.g. https://google.com)"
                className="pl-9 h-10 text-xs"
                disabled={isRecording}
              />
            </div>
            <div className="flex gap-2">
              {!isRecording ? (
                <Button type="submit" className="h-10 text-xs font-bold px-5">
                  <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
                  Start Recording
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={handleStopRecording} className="h-10 text-xs font-bold border-rose-500/20 text-rose-400 hover:bg-rose-500/10">
                  <Square className="mr-1.5 h-3.5 w-3.5 fill-current" />
                  Stop Recording
                </Button>
              )}
              {actions.length > 0 && (
                <Button type="button" variant="outline" onClick={handleClearRecording} className="h-10 text-xs font-bold">
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Reset
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Main Split Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[calc(100vh-270px)] min-h-[550px]">
        {/* Left Side: Proxied Browser iframe */}
        <div className="lg:col-span-3 bg-card/15 border border-border/40 rounded-xl overflow-hidden flex flex-col h-full">
          <div className="p-3 border-b border-border/30 bg-secondary/5 flex items-center justify-between shrink-0 font-mono text-[10px]">
            <div className="flex items-center space-x-2 text-muted-foreground truncate max-w-md">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block"></span>
              <span className="text-muted-foreground">Proxy Container:</span>
              <span className="text-foreground truncate">{activeUrl || 'Idle'}</span>
            </div>
            {isRecording && (
              <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse px-2 py-0.5 text-[9px] font-bold">
                REC ACTIVE
              </Badge>
            )}
          </div>
          <div className="flex-1 bg-white relative">
            {iframeUrl ? (
              <iframe
                src={iframeUrl}
                onLoad={handleIframeLoad}
                className="w-full h-full border-0 bg-white"
                title="Proxy Browser View"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-card/5 text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Sparkles className="h-8 w-8 animate-bounce" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-foreground">Awaiting Target URL</h3>
                  <p className="text-xs text-muted-foreground max-w-sm">Enter a valid URL in the top address bar and click start recording to initiate the visual tracker proxy sandbox.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Step logs list and live code editor panel */}
        <div className="lg:col-span-2 flex flex-col bg-card/15 border border-border/40 rounded-xl overflow-hidden h-full">
          {/* Tab Selector Header */}
          <div className="border-b border-border/30 bg-secondary/5 p-1 flex items-center justify-start space-x-1 shrink-0">
            <button
              onClick={() => setActiveTab('steps')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded transition-all cursor-pointer ${activeTab === 'steps' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <ListOrdered className="h-3.5 w-3.5" />
              <span>Recorded Actions ({actions.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded transition-all cursor-pointer ${activeTab === 'code' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Code className="h-3.5 w-3.5" />
              <span>Playwright Code</span>
            </button>
          </div>

          {/* Action List Content */}
          <div className="flex-1 p-4 overflow-y-auto scrollbar-thin">
            {activeTab === 'steps' && (
              <div className="space-y-3">
                {/* JSON Import/Export Actions Bar */}
                <div className="flex items-center justify-between pb-2 border-b border-border/20 shrink-0 mb-3">
                  <div className="flex items-center space-x-2">
                    <label className="cursor-pointer">
                      <span className="inline-flex items-center justify-center rounded-md border border-input bg-background px-2.5 py-1 text-[10px] font-bold text-muted-foreground hover:bg-accent hover:text-accent-foreground border-dashed hover:border-primary hover:text-primary transition-colors cursor-pointer">
                        <Upload className="h-3 w-3 mr-1" /> Import JSON
                      </span>
                      <input
                        type="file"
                        accept=".json"
                        onChange={importActionsJson}
                        className="hidden"
                      />
                    </label>
                    {actions.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={exportActionsJson}
                        className="h-7 text-[10px] px-2 flex items-center gap-1 border-dashed hover:border-primary hover:text-primary"
                      >
                        <Download className="h-3 w-3" /> Export JSON
                      </Button>
                    )}
                  </div>
                  {actions.length > 0 && (
                    <span className="text-[10px] text-muted-foreground italic">Drag steps to reorder</span>
                  )}
                </div>

                {actions.length === 0 ? (
                  <div className="text-center py-24 text-muted-foreground/60 space-y-2">
                    <AlertCircle className="h-10 w-10 text-muted-foreground/20 mx-auto" />
                    <p className="text-xs">No user actions captured yet. Clicks and input changes will populate here in real time.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {actions.map((act, idx) => (
                      <React.Fragment key={act.id}>
                        <div 
                          draggable
                          onDragStart={(e) => handleDragStart(e, idx)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDrop={(e) => handleDrop(e, idx)}
                          onDragEnd={handleDragEnd}
                          className={`p-3 bg-secondary/15 rounded-xl border border-border/40 flex items-start justify-between gap-3 shadow-inner relative group/action transition-all cursor-grab active:cursor-grabbing ${draggedIndex === idx ? 'opacity-40 border-dashed border-primary bg-primary/5' : ''}`}
                        >
                          <div className="flex-1 space-y-2 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-[10px] text-muted-foreground">#{idx + 1}</span>
                              <Badge variant={act.type === 'navigation' ? 'outline' : act.type === 'click' ? 'success' : act.type === 'fill' ? 'secondary' : 'warning'} className="text-[9px] uppercase font-black tracking-wider px-1.5">
                                {act.type}
                              </Badge>
                            </div>
                            
                            {act.type === 'navigation' && (
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase">Target URL</label>
                                <Input
                                  value={act.url || ''}
                                  onChange={(e) => updateActionValue(act.id, 'url', e.target.value)}
                                  className="h-7 text-[11px] bg-background border-border/30 font-mono"
                                />
                              </div>
                            )}

                            {act.type === 'screenshot' && (
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase">Screenshot Filename</label>
                                <Input
                                  value={act.value || ''}
                                  onChange={(e) => updateActionValue(act.id, 'value', e.target.value)}
                                  className="h-7 text-[11px] bg-background border-border/30 font-mono"
                                  placeholder="e.g. homepage_loaded.png"
                                />
                              </div>
                            )}

                            {act.type !== 'navigation' && act.type !== 'screenshot' && (
                              <div className="space-y-2">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-muted-foreground uppercase">Selector</label>
                                  <Input
                                    value={act.selector || ''}
                                    onChange={(e) => updateActionValue(act.id, 'selector', e.target.value)}
                                    className="h-7 text-[11px] bg-background border-border/30 font-mono"
                                  />
                                </div>
                                {act.type === 'fill' && (
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-muted-foreground uppercase">Input Text Value</label>
                                    <Input
                                      value={act.value || ''}
                                      onChange={(e) => updateActionValue(act.id, 'value', e.target.value)}
                                      className="h-7 text-[11px] bg-background border-border/30"
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Reorder and Delete controls */}
                          <div className="flex flex-col gap-1 shrink-0">
                            <button
                              onClick={() => moveAction(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1 rounded hover:bg-secondary/40 text-muted-foreground disabled:opacity-40 cursor-pointer"
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => moveAction(idx, 'down')}
                              disabled={idx === actions.length - 1}
                              className="p-1 rounded hover:bg-secondary/40 text-muted-foreground disabled:opacity-40 cursor-pointer"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => deleteAction(act.id)}
                              className="p-1 rounded hover:bg-rose-500/10 text-rose-400 cursor-pointer mt-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {idx < actions.length - 1 && (
                          <div className="relative flex items-center justify-center my-1 group/divider">
                            <div className="absolute inset-0 flex items-center">
                              <div className="w-full border-t border-dashed border-border/25 group-hover/divider:border-primary/50 transition-colors"></div>
                            </div>
                            <button
                              type="button"
                              onClick={() => insertScreenshot(idx)}
                              className="relative z-10 opacity-0 group-hover/divider:opacity-100 transition-all bg-background border border-border px-2 py-0.5 rounded-full text-[9px] font-bold text-muted-foreground hover:text-primary hover:border-primary cursor-pointer flex items-center gap-1 shadow-sm"
                            >
                              <Camera className="h-2.5 w-2.5" /> + Screenshot
                            </button>
                          </div>
                        )}
                      </React.Fragment>
                    ))}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={appendScreenshot}
                      className="w-full h-8 text-[11px] font-bold border-dashed flex items-center justify-center gap-1 mt-3 hover:border-primary hover:text-primary"
                    >
                      <Camera className="h-3.5 w-3.5" /> Add Screenshot to End
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Generated Code Content */}
            {activeTab === 'code' && (
              <div className="space-y-4 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between pb-2 border-b border-border/20 shrink-0">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Playwright Spec Script</h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Live generated code script template ready to test</p>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Button variant="outline" size="sm" className="h-7 text-[10px] px-2 py-0" onClick={copyScript}>
                      {copied ? (
                        <>
                          <Check className="h-3 w-3 mr-1 text-emerald-400" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" /> Copy
                        </>
                      )}
                    </Button>
                    <Button size="sm" className="h-7 text-[10px] px-2 py-0" onClick={downloadScript}>
                      <Download className="h-3 w-3 mr-1" /> Download
                    </Button>
                  </div>
                </div>
                <div className="flex-1">
                  <JsonViewerCode code={generatedScript} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlaywrightGeneratorPage;
