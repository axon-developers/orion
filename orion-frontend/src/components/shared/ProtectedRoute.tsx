import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('ADMIN' | 'TESTER' | 'VIEWER')[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, checkAuth } = useAuthStore();
  const location = useLocation();

  // Run on mount to ensure Zustand is in sync with localStorage
  React.useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Re-read after state has been checked
  const currentAuth = useAuthStore.getState().isAuthenticated;
  const currentUser = useAuthStore.getState().user;

  const storedToken = localStorage.getItem('orion_access_token');
  
  if (!currentAuth && !storedToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && currentUser && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
export default ProtectedRoute;
