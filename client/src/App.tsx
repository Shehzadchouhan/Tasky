import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { ProtectedRoute } from './components/auth/ProtectedRoute.tsx';
import { PublicRoute } from './components/auth/PublicRoute.tsx';
import { AppLayout } from './components/layout/AppLayout.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { RegisterPage } from './pages/RegisterPage.tsx';
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
            <AuthProvider>
              <Routes>
                {/* Public Only Routes */}
                <Route element={<PublicRoute />}>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                </Route>

                {/* Protected Routes */}
                <Route element={<ProtectedRoute />}>
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
                </Route>

                {/* Catch-all */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
