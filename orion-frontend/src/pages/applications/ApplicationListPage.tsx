import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Input, Textarea, Dialog, DialogHeader, DialogTitle, DialogFooter, Badge } from '../../components/ui';
import { Plus, Boxes, Loader2, ArrowRight, Trash2, Edit2, AlertTriangle } from 'lucide-react';
import { ApplicationDto, PagedResponse } from '../../types/api';
import { useAuthStore } from '../../stores/auth-store';
import { toast } from 'sonner';

export const ApplicationListPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [selectedApp, setSelectedApp] = useState<ApplicationDto | null>(null);

  // Form states
  const [appId, setAppId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [prId, setPrId] = useState('');
  const [plId, setPlId] = useState('');
  const [owner, setOwner] = useState('');

  // Fetch list of apps
  const { data: appData, isLoading } = useQuery<PagedResponse<ApplicationDto>>({
    queryKey: ['applications', search],
    queryFn: async () => {
      const res = await api.get(`/applications?page=0&size=100&search=${search}`);
      return res.data;
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/applications', { 
        appId, 
        appName: name, 
        description, 
        prId, 
        plId, 
        owner 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      setIsCreateOpen(false);
      resetForm();
      toast.success('Application created successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create application');
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!selectedApp) return;
      await api.put(`/applications/${selectedApp.id}`, { 
        appName: name, 
        description, 
        prId, 
        plId, 
        owner 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      setIsEditOpen(false);
      setSelectedApp(null);
      resetForm();
      toast.success('Application updated successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update application');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedApp) return;
      await api.delete(`/applications/${selectedApp.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      setIsDeleteOpen(false);
      setSelectedApp(null);
      toast.success('Application soft-deleted successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete application');
    },
  });

  const resetForm = () => {
    setAppId('');
    setName('');
    setDescription('');
    setPrId('');
    setPlId('');
    setOwner('');
  };

  const handleOpenEdit = (app: ApplicationDto, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedApp(app);
    setAppId(app.appId || app.id);
    setName(app.appName || app.name);
    setDescription(app.description || '');
    setPrId(app.prId || '');
    setPlId(app.plId || '');
    setOwner(app.owner || '');
    setIsEditOpen(true);
  };

  const handleOpenDelete = (app: ApplicationDto, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedApp(app);
    setIsDeleteOpen(true);
  };

  // Input sanitizer: only allow A-Z, 0-9, max 8 chars, capitalized
  const handleSanitizedInput = (setter: (val: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    setter(val);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Applications</h1>
          <p className="text-muted-foreground mt-1">Select or create an application container to organize tests</p>
        </div>
        {user?.role !== 'VIEWER' && (
          <Button onClick={() => { resetForm(); setIsCreateOpen(true); }} className="shrink-0">
            <Plus className="mr-2 h-5 w-5" />
            New Application
          </Button>
        )}
      </div>

      {/* Search Filter */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-md">
          <Input
            placeholder="Search applications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card"
          />
        </div>
      </div>

      {/* List content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !appData?.content || appData.content.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center border-dashed">
          <Boxes className="h-16 w-16 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-bold">No applications found</h3>
          <p className="text-muted-foreground max-w-sm mt-1">Create your first application container to start designing workflows.</p>
          {user?.role !== 'VIEWER' && (
            <Button onClick={() => setIsCreateOpen(true)} className="mt-4">
              <Plus className="mr-2 h-4 w-4" /> Create Application
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {appData.content.map((app) => (
            <Card 
              key={app.id} 
              onClick={() => navigate(`/applications/${app.id}`)}
              className="group cursor-pointer border border-border/50 hover:border-primary/50 bg-card/30 hover:bg-card/60 backdrop-blur-sm transition-all duration-300 relative overflow-hidden p-5 flex flex-col justify-between h-[155px]"
            >
              {/* Top Row: App Name & ID & Active Badge */}
              <div className="flex justify-between items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold font-mono text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded shrink-0">
                      {app.appId || app.id}
                    </span>
                    {!app.isActive && <Badge variant="secondary" className="text-[9px] px-1 py-0">Inactive</Badge>}
                  </div>
                  <h3 className="text-base font-bold group-hover:text-primary transition-colors truncate mt-1.5">
                    {app.appName || app.name}
                  </h3>
                </div>
                
                {/* Actions overlaying */}
                {user?.role !== 'VIEWER' && (
                  <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-muted-foreground hover:text-foreground animate-in fade-in duration-200"
                      onClick={(e) => handleOpenEdit(app, e)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-muted-foreground hover:text-destructive animate-in fade-in duration-200"
                      onClick={(e) => handleOpenDelete(app, e)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Middle Row: Description */}
              <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                {app.description || 'No description provided.'}
              </p>
              
              {/* Bottom Row: Metadata tags */}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/10 pt-2.5 mt-2">
                <div className="flex items-center space-x-2">
                  <span>PR: <span className="font-semibold text-foreground">{app.prId}</span></span>
                  <span className="text-border/40">•</span>
                  <span>PL: <span className="font-semibold text-foreground">{app.plId}</span></span>
                  <span className="text-border/40">•</span>
                  <span className="truncate max-w-[90px]">Owner: <span className="font-semibold text-foreground">{app.owner}</span></span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-1 shrink-0" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* CREATE DIALOG */}
      <Dialog isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} size="2xl">
        <DialogHeader>
          <DialogTitle>Create Application</DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Application ID (8-char CAPS)</label>
              <Input
                placeholder="e.g. AP000001"
                value={appId}
                onChange={handleSanitizedInput(setAppId)}
                maxLength={8}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Application Name</label>
              <Input
                placeholder="e.g. Identity Service"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Project ID (8-char CAPS)</label>
              <Input
                placeholder="e.g. PR000002"
                value={prId}
                onChange={handleSanitizedInput(setPrId)}
                maxLength={8}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Platform ID (8-char CAPS)</label>
              <Input
                placeholder="e.g. PL000003"
                value={plId}
                onChange={handleSanitizedInput(setPlId)}
                maxLength={8}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Owner</label>
              <Input
                placeholder="e.g. siva@axon.com"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              placeholder="Enter brief description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
          <Button 
            onClick={() => createMutation.mutate()} 
            disabled={createMutation.isPending || !appId || appId.length !== 8 || !name.trim() || !prId || prId.length !== 8 || !plId || plId.length !== 8 || !owner.trim()}
          >
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* EDIT DIALOG */}
      <Dialog isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} size="2xl">
        <DialogHeader>
          <DialogTitle>Edit Application</DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium opacity-60">Application ID (Read-only)</label>
              <Input
                value={appId}
                disabled
                className="bg-secondary/40 text-muted-foreground border-border/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Application Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Project ID (8-char CAPS)</label>
              <Input
                value={prId}
                onChange={handleSanitizedInput(setPrId)}
                maxLength={8}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Platform ID (8-char CAPS)</label>
              <Input
                value={plId}
                onChange={handleSanitizedInput(setPlId)}
                maxLength={8}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Owner</label>
              <Input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
          <Button 
            onClick={() => editMutation.mutate()} 
            disabled={editMutation.isPending || !name.trim() || !prId || prId.length !== 8 || !plId || plId.length !== 8 || !owner.trim()}
          >
            {editMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* DELETE DIALOG */}
      <Dialog isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)}>
        <DialogHeader>
          <DialogTitle className="flex items-center text-destructive">
            <AlertTriangle className="mr-2 h-5 w-5" />
            Delete Application
          </DialogTitle>
        </DialogHeader>
        <div className="p-6 text-sm text-muted-foreground">
          Are you sure you want to delete <span className="font-semibold text-foreground">"{selectedApp?.appName || selectedApp?.name}"</span>?
          This will soft-delete the application container. This action can be undone by an Administrator.
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
};
export default ApplicationListPage;
