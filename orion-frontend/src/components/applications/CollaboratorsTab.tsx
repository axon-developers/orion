import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input } from '../ui';
import { Shield, Plus, Trash2, Loader2, Users } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { toast } from 'sonner';

interface Collaborator {
  id: string;
  applicationId: string;
  username: string;
  role: string;
  createdAt: string;
}

interface CollaboratorsTabProps {
  appId: string;
  createdBy: string;
}

export const CollaboratorsTab: React.FC<CollaboratorsTabProps> = ({ appId, createdBy }) => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [newUsername, setNewUsername] = useState('');

  const isOwner = createdBy === user?.id || user?.role === 'ADMIN';

  // Fetch collaborators
  const { data: collaborators, isLoading } = useQuery<Collaborator[]>({
    queryKey: ['collaborators', appId],
    queryFn: async () => {
      const res = await api.get(`/applications/${appId}/collaborators`);
      return res.data;
    },
  });

  // Add collaborator
  const addMutation = useMutation({
    mutationFn: async (username: string) => {
      await api.post(`/applications/${appId}/collaborators?username=${encodeURIComponent(username)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators', appId] });
      setNewUsername('');
      toast.success('Collaborator added successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to add collaborator');
    },
  });

  // Remove collaborator
  const removeMutation = useMutation({
    mutationFn: async (username: string) => {
      await api.delete(`/applications/${appId}/collaborators/${encodeURIComponent(username)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators', appId] });
      toast.success('Collaborator removed');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to remove collaborator');
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;
    addMutation.mutate(newUsername.trim());
  };

  return (
    <div className="space-y-6">
      {isOwner && (
        <Card className="border border-border/50 bg-card/20 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center">
              <Plus className="mr-2 h-4 w-4 text-primary" />
              Add Application Editor
            </CardTitle>
            <CardDescription>Grant write permissions to another user. Editors can add, update, and delete test cases.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="flex gap-3 max-w-md">
              <Input
                type="text"
                placeholder="Enter collaborator username..."
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="text-xs h-9"
                required
              />
              <Button type="submit" size="sm" disabled={addMutation.isPending} className="h-9 font-bold shrink-0">
                {addMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Add Editor'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="border border-border/50 bg-card/20 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center">
            <Users className="mr-2 h-4 w-4 text-primary" />
            Application Editors
          </CardTitle>
          <CardDescription>Users who have edit access to this application.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !collaborators || collaborators.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No editors assigned yet. Only the application creator and administrators have write access.</p>
          ) : (
            <div className="divide-y divide-border/20 border border-border/30 rounded-md overflow-hidden bg-background/40">
              {collaborators.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-4 text-xs">
                  <div className="flex items-center space-x-3">
                    <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
                      {c.username.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{c.username}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center mt-0.5">
                        <Shield className="h-3 w-3 mr-1 text-cyan-400" />
                        {c.role}
                      </p>
                    </div>
                  </div>
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to remove editor access for ${c.username}?`)) {
                          removeMutation.mutate(c.username);
                        }
                      }}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
