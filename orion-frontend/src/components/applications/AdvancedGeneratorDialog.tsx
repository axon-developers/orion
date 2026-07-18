import React, { useState } from 'react';
import { 
  Dialog, DialogHeader, DialogTitle, DialogFooter, Button, Input, Switch, Select 
} from '../ui';
import { Sparkles, Upload, FileCode, Loader2, AlertTriangle, Shield, CheckCircle } from 'lucide-react';
import { AdvancedGeneratorOptions, GeneratorPreviewPayload } from '../../types/api';
import api from '../../lib/api';
import { toast } from 'sonner';

interface AdvancedGeneratorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  appId: string;
  onAnalyzed: (payload: GeneratorPreviewPayload) => void;
}

export const AdvancedGeneratorDialog: React.FC<AdvancedGeneratorDialogProps> = ({
  isOpen,
  onClose,
  appId,
  onAnalyzed,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [groupBy, setGroupBy] = useState<'TAG' | 'OPERATION' | 'SINGLE'>('TAG');
  const [maxUseCases, setMaxUseCases] = useState<number>(20);
  const [includeNegative, setIncludeNegative] = useState<boolean>(true);
  const [includeOptional, setIncludeOptional] = useState<boolean>(true);
  const [strictStatusCode, setStrictStatusCode] = useState<boolean>(false);
  const [authHeaderVar, setAuthHeaderVar] = useState<string>('authToken');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      toast.error('Please select an OpenAPI / Swagger spec file (.json, .yaml, or .yml)');
      return;
    }

    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('groupBy', groupBy);
      formData.append('includeNegativeCases', String(includeNegative));
      formData.append('includeOptionalFields', String(includeOptional));
      formData.append('maxUseCasesPerOperation', String(maxUseCases));
      formData.append('strictStatusCode', String(strictStatusCode));
      formData.append('authHeaderVariable', authHeaderVar || 'authToken');

      const res = await api.post(`/applications/${appId}/testcases/generate-advanced/analyze`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('OpenAPI spec parsed successfully! Preview modal opening...');
      onAnalyzed(res.data);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to analyze OpenAPI spec');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} className="max-w-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-xl font-bold">
          <Sparkles className="w-6 h-6 text-primary animate-pulse" />
          Advanced OpenAPI / Swagger Test Generator
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-6 py-2">
        {/* Upload Zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            file ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
          }`}
        >
          <input
            type="file"
            id="openapi-file-input"
            accept=".json,.yaml,.yml"
            className="hidden"
            onChange={handleFileChange}
          />
          <label htmlFor="openapi-file-input" className="cursor-pointer block">
            {file ? (
              <div className="flex items-center justify-center gap-3 text-primary font-medium">
                <FileCode className="w-8 h-8" />
                <div className="text-left">
                  <p className="text-sm font-semibold">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB — Click or drag to change
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                  Drop OpenAPI 3.0 / Swagger 2.0 specification file here
                </p>
                <p className="text-xs text-muted-foreground">Supports .json, .yaml, and .yml schemas</p>
              </div>
            )}
          </label>
        </div>

        {/* Generator Options */}
        <div className="space-y-4 bg-muted/40 p-4 rounded-xl border border-border">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Generator Configuration & Use-Case Engine Options
          </h4>

          {/* Grouping */}
          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs font-medium text-muted-foreground col-span-3">Test Case Grouping Strategy</label>
            <button
              type="button"
              onClick={() => setGroupBy('TAG')}
              className={`p-3 rounded-lg border text-left text-xs transition-all ${
                groupBy === 'TAG' ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-border bg-background'
              }`}
            >
              <div className="font-medium">By OpenAPI Tag</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">One test case per tag (Default)</div>
            </button>

            <button
              type="button"
              onClick={() => setGroupBy('OPERATION')}
              className={`p-3 rounded-lg border text-left text-xs transition-all ${
                groupBy === 'OPERATION' ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-border bg-background'
              }`}
            >
              <div className="font-medium">Per Operation</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">One test case per (path + method)</div>
            </button>

            <button
              type="button"
              onClick={() => setGroupBy('SINGLE')}
              className={`p-3 rounded-lg border text-left text-xs transition-all ${
                groupBy === 'SINGLE' ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-border bg-background'
              }`}
            >
              <div className="font-medium">Single Suite</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">All endpoints in 1 test case</div>
            </button>
          </div>

          {/* Controls Grid */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Max Use Cases Per Endpoint ({maxUseCases})
              </label>
              <input
                type="range"
                min={1}
                max={50}
                value={maxUseCases}
                onChange={(e) => setMaxUseCases(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Auth Token Header Variable</label>
              <Input
                value={authHeaderVar}
                onChange={(e) => setAuthHeaderVar(e.target.value)}
                placeholder="authToken"
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-foreground block">Include Negative Test Cases</span>
                <span className="text-[11px] text-muted-foreground">Generates missing required field tests expecting 4XX</span>
              </div>
              <Switch checked={includeNegative} onChange={(e) => setIncludeNegative(e.target.checked)} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-foreground block">Include Optional Fields Use Case</span>
                <span className="text-[11px] text-muted-foreground">Generates scenario with optional inputs omitted</span>
              </div>
              <Switch checked={includeOptional} onChange={(e) => setIncludeOptional(e.target.checked)} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-foreground block">Strict Status Code Matching</span>
                <span className="text-[11px] text-muted-foreground">
                  OFF = Check 2XX range (200-299); ON = Check exact status code from CSV
                </span>
              </div>
              <Switch checked={strictStatusCode} onChange={(e) => setStrictStatusCode(e.target.checked)} />
            </div>
          </div>
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onClose} disabled={isAnalyzing}>
          Cancel
        </Button>
        <Button onClick={handleAnalyze} disabled={!file || isAnalyzing} className="gap-2">
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Parsing & Cartographing...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Analyze Spec & Open Preview →
            </>
          )}
        </Button>
      </DialogFooter>
    </Dialog>
  );
};
