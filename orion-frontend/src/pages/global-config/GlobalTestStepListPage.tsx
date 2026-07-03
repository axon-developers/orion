import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Input, Badge } from '../../components/ui';
import { Plus, Workflow, Loader2, Edit2, Trash2, Code, ArrowRight } from 'lucide-react';
import { GlobalTestStepDto, PagedResponse } from '../../types/api';
import { toast } from 'sonner';

export const GlobalTestStepListPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  // Fetch list of global steps
  const { data: stepData, isLoading } = useQuery<PagedResponse<GlobalTestStepDto>>({
    queryKey: ['global-steps-list', search],
    queryFn: async () => {
      const res = await api.get(`/global/test-steps?page=0&size=100&search=${search}`);
      return res.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/global/test-steps/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-steps-list'] });
      toast.success('Global test step template deleted');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete step template');
    },
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center">
            <Workflow className="mr-2 h-7 w-7 text-primary" />
            Global Test Steps
          </h1>
          <p className="text-muted-foreground mt-1">Reusable test step templates available across all applications</p>
        </div>
        <Button onClick={() => navigate('/global/test-steps/new')} className="shrink-0">
          <Plus className="mr-2 h-5 w-5" />
          Create Global Step
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Input
            placeholder="Search global steps..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !stepData?.content || stepData.content.length === 0 ? (
        <Card className="text-center py-16 border-dashed">
          <Workflow className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-bold">No global steps defined</h3>
          <p className="text-muted-foreground max-w-xs mx-auto mt-1">Create reusable steps like authorization flows that testers can reference in test cases.</p>
          <Button onClick={() => navigate('/global/test-steps/new')} className="mt-4">Create Global Step</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stepData.content.map((step) => (
            <Card key={step.id} className="border border-border/50 bg-card/20 flex flex-col justify-between hover:border-primary/20 transition-all duration-300">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-4">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary/80 font-mono">
                    {step.stepType}
                  </span>
                  <div className="flex space-x-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => navigate(`/global/test-steps/${step.id}`)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(step.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-base font-bold mt-1.5">{step.name}</CardTitle>
                <CardDescription className="text-xs line-clamp-2 mt-1 min-h-[32px]">{step.description || 'No description'}</CardDescription>
              </CardHeader>
              <CardFooter className="border-t border-border/20 py-2.5 px-6 flex justify-between items-center bg-secondary/10 text-xs text-muted-foreground">
                <span>By: {step.createdBy}</span>
                <span className="flex items-center text-primary font-semibold hover:underline cursor-pointer" onClick={() => navigate(`/global/test-steps/${step.id}`)}>
                  Configure
                  <ArrowRight className="ml-1 h-3 w-3" />
                </span>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
export default GlobalTestStepListPage;
