import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MetaProvider } from '../context/MetaContext';
import { PageLoader } from './ui';

export function PermissionGuard({ permission, children }) {
  const { status, hasPermission } = useAuth();
  if (status === 'loading') return <PageLoader label="Checking access…" />;
  if (status !== 'authenticated' || !hasPermission(permission)) return <Navigate to="/access-denied" replace />;
  return children || <Outlet />;
}

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <PageLoader label="Checking your session…" />;
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location }} />;
  return (
    <MetaProvider>
      <Outlet />
    </MetaProvider>
  );
}

export function GuestRoute() {
  const { status } = useAuth();
  if (status === 'loading') return <PageLoader label="Loading…" />;
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
