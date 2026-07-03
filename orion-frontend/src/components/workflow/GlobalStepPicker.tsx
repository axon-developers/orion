import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { Dialog, DialogHeader, DialogTitle, DialogFooter, Button } from '../ui';
import { GlobalTestStepDto, PagedResponse } from '../../types/api';
import { Link, Loader2 } from 'lucide-react';

interface GlobalStepPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (globalStep: GlobalTestStepDto) => void;
}

export const GlobalStepPicker: React.FC<GlobalStepPickerProps> = ({ 
  isOpen, 
  onClose, 
  onSelect 
}) => {
  // Fetch global steps
  const { data: globalSteps, isLoading } = useQuery<PagedResponse<GlobalTestStepDto>>({
    queryKey: ['global-steps-picker'],
    queryFn: async () => {
      const res = await api.get('/global/test-steps?page=0&size=100');
      return res.data;
    },
    enabled: isOpen,
  });

  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <DialogHeader>
        <DialogTitle className="flex items-center">
          <Link className="mr-2 h-5 w-5 text-amber-400" />
          Select Global Step Template
        </DialogTitle>
      </DialogHeader>
      <div className="p-6 overflow-y-auto max-h-[400px]">
        <p className="text-xs text-muted-foreground mb-4">Choose reusable step template to insert into test case:</p>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !globalSteps?.content || globalSteps.content.length === 0 ? (
          <div className="text-sm text-center py-6 text-muted-foreground">
            No global test steps configured by Administrator.
          </div>
        ) : (
          <div className="space-y-3">
            {globalSteps.content.map((step) => (
              <div 
                key={step.id}
                onClick={() => onSelect(step)}
                className="flex items-center justify-between p-3 rounded-lg border border-border/60 hover:border-primary/50 bg-secondary/10 hover:bg-secondary/20 cursor-pointer transition-all"
              >
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{step.name}</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{step.description || 'No description'}</p>
                  <span className="text-[9px] font-extrabold uppercase text-primary/80 mt-1 block">Type: {step.stepType}</span>
                </div>
                <Button size="sm">Select</Button>
              </div>
            ))}
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </DialogFooter>
    </Dialog>
  );
};
export default GlobalStepPicker;
