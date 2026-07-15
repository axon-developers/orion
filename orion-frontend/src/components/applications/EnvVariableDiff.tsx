import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Select, Badge, Button } from '../ui';
import { EnvironmentDto } from '../../types/api';
import { ArrowLeftRight, Check, AlertTriangle, Eye, EyeOff, Minus, PlusCircle } from 'lucide-react';

interface EnvVariableDiffProps {
  environments: EnvironmentDto[];
}

interface DiffItem {
  key: string;
  sourceVal: string;
  targetVal: string;
  isSecret: boolean;
  status: 'MATCHING' | 'DIFFERENT' | 'MISSING_IN_TARGET' | 'MISSING_IN_SOURCE';
}

export const EnvVariableDiff: React.FC<EnvVariableDiffProps> = ({ environments }) => {
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [hideMatching, setHideMatching] = useState(false);
  const [revealSecrets, setRevealSecrets] = useState<Record<string, boolean>>({});

  const sourceEnv = useMemo(() => environments.find(e => e.id === sourceId), [environments, sourceId]);
  const targetEnv = useMemo(() => environments.find(e => e.id === targetId), [environments, targetId]);

  const diffList = useMemo((): DiffItem[] => {
    if (!sourceEnv || !targetEnv) return [];

    const sourceVars = sourceEnv.variables || [];
    const targetVars = targetEnv.variables || [];

    const sourceMap = new Map(sourceVars.map(v => [v.key, v]));
    const targetMap = new Map(targetVars.map(v => [v.key, v]));

    const allKeys = Array.from(new Set([
      ...sourceVars.map(v => v.key),
      ...targetVars.map(v => v.key)
    ])).sort();

    return allKeys.map(key => {
      const srcVar = sourceMap.get(key);
      const tgtVar = targetMap.get(key);

      const isSecret = (srcVar?.isSecret || tgtVar?.isSecret) || false;
      const sourceVal = srcVar?.value ?? '';
      const targetVal = tgtVar?.value ?? '';

      let status: DiffItem['status'];
      if (srcVar && tgtVar) {
        status = sourceVal === targetVal ? 'MATCHING' : 'DIFFERENT';
      } else if (srcVar) {
        status = 'MISSING_IN_TARGET';
      } else {
        status = 'MISSING_IN_SOURCE';
      }

      return {
        key,
        sourceVal,
        targetVal,
        isSecret,
        status
      };
    });
  }, [sourceEnv, targetEnv]);

  const filteredDiff = useMemo(() => {
    if (hideMatching) {
      return diffList.filter(item => item.status !== 'MATCHING');
    }
    return diffList;
  }, [diffList, hideMatching]);

  const toggleRevealSecret = (key: string) => {
    setRevealSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getStatusBadge = (status: DiffItem['status']) => {
    switch (status) {
      case 'MATCHING':
        return <Badge variant="success" className="gap-1"><Check className="h-3 w-3" /> Matching</Badge>;
      case 'DIFFERENT':
        return <Badge variant="warning" className="gap-1"><ArrowLeftRight className="h-3 w-3" /> Value Mismatch</Badge>;
      case 'MISSING_IN_TARGET':
        return <Badge variant="destructive" className="gap-1"><Minus className="h-3 w-3" /> Missing in Target</Badge>;
      case 'MISSING_IN_SOURCE':
        return <Badge variant="outline" className="gap-1 text-cyan-400 border-cyan-500/20 bg-cyan-500/5"><PlusCircle className="h-3 w-3" /> Missing in Source</Badge>;
    }
  };

  const renderValue = (item: DiffItem, side: 'source' | 'target') => {
    const val = side === 'source' ? item.sourceVal : item.targetVal;
    const exists = side === 'source' ? item.status !== 'MISSING_IN_SOURCE' : item.status !== 'MISSING_IN_TARGET';

    if (!exists) {
      return <span className="text-muted-foreground/30 italic">Not Defined</span>;
    }

    if (item.isSecret) {
      const isRevealed = revealSecrets[`${item.key}_${side}`];
      return (
        <div className="flex items-center space-x-1.5 font-mono text-xs">
          <span>{isRevealed ? val : '••••••••••••'}</span>
          <button 
            type="button" 
            onClick={() => toggleRevealSecret(`${item.key}_${side}`)}
            className="text-muted-foreground hover:text-foreground p-0.5"
          >
            {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
      );
    }

    return <span className="font-mono text-xs break-all">{val}</span>;
  };

  return (
    <Card className="border border-border/50 bg-card/10">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-bold flex items-center justify-between">
          <span>Variable Compare Tool</span>
          {sourceEnv && targetEnv && (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="hideMatching"
                checked={hideMatching}
                onChange={(e) => setHideMatching(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 checked:bg-indigo-600 checked:border-indigo-600 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <label htmlFor="hideMatching" className="text-xs font-semibold text-muted-foreground cursor-pointer select-none">
                Hide Matching Keys
              </label>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Environment Pickers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Source Environment</label>
            <Select
              options={[
                { value: '', label: 'Select Source Environment' },
                ...environments.map(e => ({ value: e.id, label: e.name }))
              ]}
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Target Environment</label>
            <Select
              options={[
                { value: '', label: 'Select Target Environment' },
                ...environments.map(e => ({ value: e.id, label: e.name }))
              ]}
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            />
          </div>
        </div>

        {/* Diff Result List */}
        {!sourceEnv || !targetEnv ? (
          <div className="text-center py-10 border border-dashed border-border/30 rounded-lg text-xs text-muted-foreground">
            Select two environments above to view variable differences side-by-side.
          </div>
        ) : filteredDiff.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-border/30 rounded-lg text-xs text-muted-foreground">
            {hideMatching ? 'All variables match!' : 'No variables defined in either environment.'}
          </div>
        ) : (
          <div className="border border-border/40 rounded-lg overflow-hidden bg-card/25">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-secondary/15 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30">
                  <th className="py-3 px-4">Variable Key</th>
                  <th className="py-3 px-4">Comparison Status</th>
                  <th className="py-3 px-4">Value in {sourceEnv.name}</th>
                  <th className="py-3 px-4">Value in {targetEnv.name}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filteredDiff.map(item => (
                  <tr 
                    key={item.key} 
                    className={`text-xs hover:bg-secondary/5 transition-colors ${
                      item.status === 'DIFFERENT' ? 'bg-amber-500/5' :
                      item.status === 'MISSING_IN_TARGET' ? 'bg-rose-500/5' :
                      item.status === 'MISSING_IN_SOURCE' ? 'bg-cyan-500/5' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 font-semibold text-foreground">{item.key}</td>
                    <td className="py-3.5 px-4">{getStatusBadge(item.status)}</td>
                    <td className="py-3.5 px-4">{renderValue(item, 'source')}</td>
                    <td className="py-3.5 px-4">{renderValue(item, 'target')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
