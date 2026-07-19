import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '../ui';
import { Activity, Flame, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { TestCaseHeatmapDto } from '../../types/api';

interface HeatmapTabProps {
  appId: string;
}

export const HeatmapTab: React.FC<HeatmapTabProps> = ({ appId }) => {
  const { data: heatmapData = [], isLoading, refetch } = useQuery<TestCaseHeatmapDto[]>({
    queryKey: ['app-heatmap', appId],
    queryFn: async () => {
      const res = await api.get(`/applications/${appId}/heatmap`);
      return res.data;
    },
    enabled: !!appId,
  });

  const getFlakinessBadge = (score: number) => {
    if (score === 0) {
      return <Badge variant="success" className="text-[10px]">0% Stable</Badge>;
    }
    if (score < 30) {
      return <Badge variant="secondary" className="text-[10px] text-amber-400 border-amber-500/30">{score}% Low Flake</Badge>;
    }
    return <Badge variant="destructive" className="text-[10px] font-bold">{score}% Highly Flaky</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold flex items-center space-x-2">
            <Flame className="h-5 w-5 text-amber-400" />
            <span>Test Case Failure & Flakiness Heatmap</span>
          </h3>
          <p className="text-xs text-muted-foreground">
            Visual matrix showing recent execution history (last 15 runs) and flakiness rating per test case.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-3 py-1.5 text-xs font-bold bg-secondary/40 hover:bg-secondary/70 rounded-lg border border-border/40 flex items-center space-x-1.5 cursor-pointer transition-all"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh Matrix</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : heatmapData.length === 0 ? (
        <Card className="text-center py-12 border-dashed">
          <Activity className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h4 className="font-semibold">No test cases or execution data available</h4>
          <p className="text-xs text-muted-foreground mt-1">Run test cases to generate heat maps and flakiness metrics.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {heatmapData.map((item) => (
            <Card key={item.testCaseId} className="border border-border/40 bg-card/20 p-4 hover:border-primary/30 transition-all">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-foreground">{item.testCaseName}</span>
                    {getFlakinessBadge(item.flakinessScore)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Flakiness Score: <strong>{item.flakinessScore}%</strong> ({item.recentStatuses.length} recent runs tracked)
                  </div>
                </div>

                {/* Status Grid Blocks */}
                <div className="flex items-center space-x-1.5 shrink-0 overflow-x-auto py-1">
                  {item.recentStatuses.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">No runs</span>
                  ) : (
                    item.recentStatuses.map((st, idx) => {
                      let bgColor = 'bg-secondary/40 border-border/50 text-muted-foreground';
                      if (st === 'PASSED') bgColor = 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400';
                      if (st === 'FAILED') bgColor = 'bg-rose-500/20 border-rose-500/40 text-rose-400';
                      if (st === 'RUNNING') bgColor = 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 animate-pulse';

                      return (
                        <div
                          key={idx}
                          title={`Run ${idx + 1}: ${st}`}
                          className={`h-7 w-7 rounded-md border ${bgColor} flex items-center justify-center font-extrabold text-[10px] transition-transform hover:scale-110 cursor-pointer`}
                        >
                          {st === 'PASSED' ? <CheckCircle className="h-4 w-4" /> : st === 'FAILED' ? <XCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
