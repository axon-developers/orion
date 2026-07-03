import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Card, CardContent, Button, Input, Select, Badge, Switch } from '../../components/ui';
import { Users, Loader2, UserCheck, UserMinus, Shield, ShieldAlert, Trash2 } from 'lucide-react';
import { UserDto, PagedResponse } from '../../types/api';
import { toast } from 'sonner';

export const UserManagementPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  // Fetch users
  const { data: userData, isLoading } = useQuery<PagedResponse<UserDto>>({
    queryKey: ['users-list', search],
    queryFn: async () => {
      const res = await api.get(`/users?page=0&size=100&search=${search}`);
      return res.data;
    },
  });

  // Mutations
  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      await api.patch(`/users/${id}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      toast.success('User role updated');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update user role');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await api.patch(`/users/${id}/status`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      toast.success('User status updated');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update status');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      toast.success('User soft-deleted');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete user');
    },
  });

  const handleRoleChange = (id: string, newRole: string) => {
    updateRoleMutation.mutate({ id, role: newRole });
  };

  const handleStatusToggle = (id: string, currentStatus: boolean) => {
    updateStatusMutation.mutate({ id, isActive: !currentStatus });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return (
          <Badge className="bg-primary/20 text-primary border border-primary/30 flex items-center space-x-1 w-fit">
            <Shield className="h-3 w-3" />
            <span>Admin</span>
          </Badge>
        );
      case 'TESTER':
        return (
          <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center space-x-1 w-fit">
            <UserCheck className="h-3 w-3" />
            <span>Tester</span>
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="flex items-center space-x-1 w-fit">
            <UserMinus className="h-3 w-3" />
            <span>Viewer</span>
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center">
          <Users className="mr-2 h-7 w-7 text-primary" />
          User Management
        </h1>
        <p className="text-muted-foreground mt-1">Control user accounts, toggles, and role authorization maps</p>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Input
            placeholder="Search username, email, name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !userData?.content || userData.content.length === 0 ? (
        <Card className="text-center py-12 border-dashed">
          <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h4 className="font-semibold">No users match query</h4>
          <p className="text-xs text-muted-foreground mt-1">Try adapting your search parameters.</p>
        </Card>
      ) : (
        <Card className="border border-border/50 bg-card/20 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/35 text-muted-foreground">
                    <th className="p-4 font-semibold">User Details</th>
                    <th className="p-4 font-semibold">Current Role</th>
                    <th className="p-4 font-semibold">Update Role</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {userData.content.map((u) => (
                    <tr key={u.id} className="hover:bg-secondary/10 transition-colors">
                      <td className="p-4">
                        <div>
                          <div className="font-semibold text-foreground">{u.fullName}</div>
                          <div className="text-xs text-muted-foreground">
                            @{u.username} • {u.email}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">{getRoleBadge(u.role)}</td>
                      <td className="p-4">
                        <Select
                          options={[
                            { value: 'ADMIN', label: 'Admin' },
                            { value: 'TESTER', label: 'Tester' },
                            { value: 'VIEWER', label: 'Viewer' },
                          ]}
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className="h-8 py-0.5 text-xs max-w-[120px]"
                        />
                      </td>
                      <td className="p-4">
                        <Switch
                          checked={u.isActive}
                          onChange={() => handleStatusToggle(u.id, u.isActive)}
                        />
                      </td>
                      <td className="p-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteUserMutation.mutate(u.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
export default UserManagementPage;
