import { Outlet } from 'react-router-dom';
import { Header } from './Header.tsx';

export function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#1e1e2f] text-slate-900 dark:text-slate-100 transition-colors">
      <Header />
      <main className="flex-1 w-full max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
