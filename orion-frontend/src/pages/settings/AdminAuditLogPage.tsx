import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge, Input } from '../../components/ui';
import { ScrollText, Loader2, User, Calendar, ArrowLeftRight } from 'lucide-react';
import { PagedResponse } from '../../types/api';

interface AuditLogDto {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  performedBy: string;
  previousValue: string;
  newValue: string;
  timestamp: string;
}

export const AdminAuditLogPage: React.FC = () => {
  const [performedByFilter, setPerformedByFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('SYSTEM_SETTING');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(15);

  const { data: auditData, isLoading } = useQuery<PagedResponse<AuditLogDto>>({
    queryKey: ['admin-audit-logs', entityTypeFilter, performedByFilter, page, size],
    queryFn: async () => {
      let url = `/admin/audit-logs?page=${page}&size=${size}`;
      if (entityTypeFilter) url += `&entityType=${entityTypeFilter}`;
      if (performedByFilter) url += `&performedBy=${performedByFilter}`;
      const res = await api.get(url);
      return res.data;
    }
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return <Badge variant="success">Create</Badge>;
      case 'UPDATE':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Update</Badge>;
      case 'DELETE':
        return <Badge variant="destructive">Delete</Badge>;
      default:
        return <Badge variant="secondary">{action}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center">
          <ScrollText className="mr-2 h-7 w-7 text-primary" />
          Audit Trail Logs
        </h1>
        <p className="text-muted-foreground mt-1">Audit log records of system changes, security adjustments, and setting modifications</p>
      </div>

      <div className="flex items-center justify-between gap-4">
        {/* Filters */}
        <div className="flex items-center space-x-3">
          <select
            value={entityTypeFilter}
            onChange={(e) => {
              setEntityTypeFilter(e.target.value);
              setPage(0);
            }}
            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-xs max-w-[200px] text-foreground cursor-pointer"
          >
            <option value="">All Entities</option>
            <option value="SYSTEM_SETTING">System Settings</option>
            <option value="GLOBAL_ENV_CONFIG">Global Env Variables</option>
            <option value="APPLICATION">Applications</option>
            <option value="TEST_CASE">Test Cases</option>
            <option value="USER">Users</option>
          </select>

          <Input
            value={performedByFilter}
            onChange={(e) => {
              setPerformedByFilter(e.target.value);
              setPage(0);
            }}
            placeholder="Filter by admin username..."
            className="h-10 text-xs w-48"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !auditData?.content || auditData.content.length === 0 ? (
        <Card className="text-center py-16 border-dashed">
          <ScrollText className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-bold">No audit logs recorded</h3>
          <p className="text-muted-foreground mt-1">Actions performed on settings and administrative views are recorded here.</p>
        </Card>
      ) : (
        <Card className="border border-border/50 bg-card/20 overflow-hidden flex flex-col justify-between">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/35 text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                    <th className="p-4 font-bold">Entity Type</th>
                    <th className="p-4 font-bold">Entity Key/ID</th>
                    <th className="p-4 font-bold">Action</th>
                    <th className="p-4 font-bold">Changed By</th>
                    <th className="p-4 font-bold">Values Change (Old → New)</th>
                    <th className="p-4 font-bold">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30 font-medium">
                  {auditData.content.map((log) => (
                    <tr key={log.id} className="hover:bg-secondary/10 transition-colors">
                      <td className="p-4 font-bold text-foreground font-mono text-[10px]">{log.entityType}</td>
                      <td className="p-4 font-mono text-muted-foreground">{log.entityId}</td>
                      <td className="p-4">{getActionBadge(log.action)}</td>
                      <td className="p-4">
                        <span className="font-semibold text-foreground flex items-center space-x-1"><User className="h-3.5 w-3.5 inline text-muted-foreground mr-1 shrink-0" />{log.performedBy}</span>
                      </td>
                      <td className="p-4 font-mono text-[10px] max-w-sm truncate">
                        {log.previousValue || log.newValue ? (
                          <div className="flex items-center space-x-1">
                            <span className="text-rose-400 bg-rose-500/10 px-1 py-0.5 rounded truncate max-w-[140px]" title={log.previousValue}>
                              {log.previousValue ? log.previousValue.replace(/"/g, '') : 'None'}
                            </span>
                            <ArrowLeftRight className="h-3 w-3 text-muted-foreground inline shrink-0" />
                            <span className="text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded truncate max-w-[140px]" title={log.newValue}>
                              {log.newValue ? log.newValue.replace(/"/g, '') : 'None'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60">--</span>
                        )}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        <span className="flex items-center space-x-1"><Calendar className="h-3.5 w-3.5 inline mr-1 text-muted-foreground shrink-0" />{new Date(log.timestamp).toLocaleString()}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>

          {/* Pagination Controls */}
          {auditData && auditData.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border/40 px-4 py-3 bg-secondary/10 text-xs font-semibold">
              <div className="flex items-center space-x-2">
                <span className="text-muted-foreground">Rows per page:</span>
                <select
                  value={size}
                  onChange={(e) => {
                    setSize(parseInt(e.target.value) || 15);
                    setPage(0);
                  }}
                  className="h-8 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground cursor-pointer"
                >
                  <option value="15">15</option>
                  <option value="30">30</option>
                  <option value="50">50</option>
                </select>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-muted-foreground">
                  Page {page + 1} of {auditData.totalPages} ({auditData.totalElements} records)
                </span>
                <div className="flex items-center space-x-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                    disabled={page === 0}
                    className="h-8 py-0"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((prev) => Math.min(auditData.totalPages - 1, prev + 1))}
                    disabled={page >= auditData.totalPages - 1}
                    className="h-8 py-0"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default AdminAuditLogPage;
