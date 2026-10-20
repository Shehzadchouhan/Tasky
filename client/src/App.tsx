import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import { AppLayout } from './components/layout/AppLayout.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { ApiClientError } from './api/client.ts';

const loadDashboardPage = () => import('./pages/DashboardPage.tsx');
const DashboardPage = lazy(() =>
  loadDashboardPage().then(({ DashboardPage: page }) => ({ default: page }))
);

// Requirement 4: retry: false for 4xx errors
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiClientError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  useEffect(() => {
    loadDashboardPage().catch((error: unknown) => {
      console.error('Failed to preload dashboard:', error);
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<AppLayout />}>
                <Route
                  path="/"
                  element={
                    <Suspense
                      fallback={
                        <div className="flex min-h-[50vh] items-center justify-center">
                          <p role="status" className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800 dark:border-white/20 dark:border-t-white" />
                            Preparing your workspace…
                          </p>
                        </div>
                      }
                    >
                      <DashboardPage />
                    </Suspense>
                  }
                />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
