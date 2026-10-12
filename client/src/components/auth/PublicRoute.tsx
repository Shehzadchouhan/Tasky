import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.ts';
import { Spinner } from '../common/Spinner.tsx';

export function PublicRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <Spinner size="lg" label="Loading..." />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
