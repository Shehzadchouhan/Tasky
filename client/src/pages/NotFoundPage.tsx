import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button.tsx';

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-50 dark:bg-[#1e1e2f] text-slate-900 dark:text-white">
      <h1 className="text-6xl font-black text-[#6c63ff] mb-2">404</h1>
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
