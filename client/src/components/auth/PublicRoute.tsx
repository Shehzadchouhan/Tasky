import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.ts';
import { Spinner } from '../common/Spinner.tsx';

export function PublicRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#1e1e2f]">
        <Spinner size="lg" label="Loading..." />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
