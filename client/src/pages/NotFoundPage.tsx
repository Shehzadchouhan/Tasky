import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button.tsx';

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-transparent text-slate-900 dark:text-white">
      <h1 className="text-6xl font-black text-slate-700 dark:text-slate-200 mb-2">404</h1>
      <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
      <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6 text-sm">
        The page you are looking for might have been moved, removed, or never existed.
      </p>
      <Link to="/">
        <Button variant="primary" size="md">
          Back to Dashboard
        </Button>
      </Link>
    </div>
  );
}
