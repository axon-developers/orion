import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Input } from '../../components/ui';
import { User, Key, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { toast } from 'sonner';

export const ProfilePage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      await api.put('/users/me', { fullName, email });
    },
    onSuccess: (data) => {
      // Update store
      const updatedUser = { ...user, fullName, email } as any;
      localStorage.setItem('orion_user', JSON.stringify(updatedUser));
      useAuthStore.setState({ user: updatedUser });
      toast.success('Profile settings updated successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update profile settings');
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) {
        throw new Error('New passwords do not match');
      }
      await api.put('/users/me/password', { currentPassword, newPassword });
    },
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed successfully');
    },
    onError: (err: any) => {
      toast.error(err.message || err.response?.data?.message || 'Failed to change password');
    },
  });

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-200">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground mt-1">Configure profile details and credentials</p>
      </div>

      <Card className="border border-border/50 bg-card/20 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center">
            <User className="mr-2 h-5 w-5 text-primary" />
            Profile Details
          </CardTitle>
          <CardDescription>Update your personal information and contact details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Username</label>
              <Input value={user?.username || ''} disabled className="bg-secondary/40 font-mono" />
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Access Role</label>
              <Input value={user?.role || ''} disabled className="bg-secondary/40 font-mono" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Full Name</label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Email Address</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </CardContent>
        <CardFooter className="border-t border-border/30 bg-secondary/5 py-3 px-6 flex justify-end">
          <Button onClick={() => updateProfileMutation.mutate()} disabled={updateProfileMutation.isPending || !fullName.trim() || !email.trim()}>
            {updateProfileMutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardFooter>
      </Card>

      <Card className="border border-border/50 bg-card/20 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center">
            <Key className="mr-2 h-5 w-5 text-primary" />
            Change Password
          </CardTitle>
          <CardDescription>Ensure your account remains secure by updating your password regularly</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Current Password</label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">New Password</label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Confirm New Password</label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t border-border/30 bg-secondary/5 py-3 px-6 flex justify-end">
          <Button onClick={() => changePasswordMutation.mutate()} disabled={changePasswordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}>
            {changePasswordMutation.isPending ? 'Updating...' : 'Change Password'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};
export default ProfilePage;
