import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

// Layout & Protect routes
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/shared/ProtectedRoute';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Standard Pages
import DashboardPage from './pages/dashboard/DashboardPage';
import ApplicationListPage from './pages/applications/ApplicationListPage';
import ApplicationDetailPage from './pages/applications/ApplicationDetailPage';
import GlobalEnvConfigPage from './pages/global-config/GlobalEnvConfigPage';
import GlobalTestStepListPage from './pages/global-config/GlobalTestStepListPage';
import GlobalTestStepFormPage from './pages/global-config/GlobalTestStepFormPage';
import UserManagementPage from './pages/users/UserManagementPage';
import WorkflowDesignerPage from './pages/testcases/WorkflowDesignerPage';
import ExecutionDetailPage from './pages/executions/ExecutionDetailPage';
import ExecutionListPage from './pages/executions/ExecutionListPage';
import SamlCallbackPage from './pages/auth/SamlCallbackPage';
import ProfilePage from './pages/settings/ProfilePage';
import PlaywrightGeneratorPage from './pages/playwright/PlaywrightGeneratorPage';
import AdminSettingsPage from './pages/settings/AdminSettingsPage';
import AdminAuditLogPage from './pages/settings/AdminAuditLogPage';
import LogViewerPage from './pages/settings/LogViewerPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

import { useSystemSettingsStore } from './stores/system-settings-store';
import { useThemeStore } from './stores/theme-store';

export const App: React.FC = () => {
  const { fetchPublicSettings } = useSystemSettingsStore();

  React.useEffect(() => {
    fetchPublicSettings();
    useThemeStore.getState().initialize();
  }, [fetchPublicSettings]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/saml/callback" element={<SamlCallbackPage />} />

          {/* Protected Application Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            
            {/* Application pages */}
            <Route path="applications" element={<ApplicationListPage />} />
            <Route path="applications/:appId" element={<ApplicationDetailPage />} />
            <Route path="applications/:appId/testcases/:tcId/designer" element={<WorkflowDesignerPage />} />
            
            {/* Executions page */}
            <Route path="executions" element={<ExecutionListPage />} />
            <Route path="executions/:execId" element={<ExecutionDetailPage />} />

            {/* Playwright Generator page */}
            <Route path="playwright-generator" element={<PlaywrightGeneratorPage />} />

            {/* Admin global config pages */}
            <Route
              path="global/env-configs"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <GlobalEnvConfigPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="global/test-steps"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <GlobalTestStepListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="global/test-steps/new"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <GlobalTestStepFormPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="global/test-steps/:id"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <GlobalTestStepFormPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/users"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <UserManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/settings"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminSettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/audit-log"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminAuditLogPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/logs"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <LogViewerPage />
                </ProtectedRoute>
              }
            />
            <Route path="settings/profile" element={<ProfilePage />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-right" theme="dark" richColors closeButton />
    </QueryClientProvider>
  );
};
export default App;
