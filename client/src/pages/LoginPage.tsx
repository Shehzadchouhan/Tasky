import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { CheckSquare } from 'lucide-react';
import { Input } from '../components/common/Input.tsx';
import { Button } from '../components/common/Button.tsx';
import { useAuth } from '../hooks/useAuth.ts';
import { useToast } from '../hooks/useToast.ts';
import { ApiClientError } from '../api/client.ts';

export function LoginPage() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    general?: string;
  }>({});

  const from = (location.state as { from?: string })?.from || '/';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrors((prev) => ({ ...prev, email: 'Email is required' }));
      return;
    }
    if (!password) {
      setErrors((prev) => ({ ...prev, password: 'Password is required' }));
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email: trimmedEmail, password });
      showToast('Welcome back!', 'success');
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiClientError) {
        const fieldErrors: { email?: string; password?: string; general?: string } = {};
        if (err.details && err.details.length > 0) {
          err.details.forEach((detail) => {
            if (detail.field === 'email') fieldErrors.email = detail.message;
            else if (detail.field === 'password') fieldErrors.password = detail.message;
            else fieldErrors.general = detail.message;
          });
        } else {
          fieldErrors.general = err.message;
        }
        setErrors(fieldErrors);
      } else {
        setErrors({ general: 'Failed to sign in. Please try again later.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-50 dark:bg-[#1e1e2f] transition-colors">
      <div className="w-full max-w-md flex flex-col gap-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#6c63ff] to-[#5750d6] flex items-center justify-center text-white shadow-lg shadow-[#6c63ff]/25 mb-3">
            <CheckSquare className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Sign in to Taskly
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Organize, prioritize, and get work done.
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-white dark:bg-[#252538] border border-slate-200/80 dark:border-white/10 rounded-2xl p-6 sm:p-8 shadow-xl">
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            {errors.general && (
              <div
                role="alert"
                className="p-3.5 text-xs sm:text-sm font-medium rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50"
              >
                {errors.general}
              </div>
            )}

            <Input
              type="email"
              label="Email Address"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              required
            />

            <Input
              type="password"
              label="Password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              isLoading={isSubmitting}
            >
              Sign In
            </Button>
          </form>

          <div className="pt-6 mt-6 border-t border-slate-100 dark:border-white/5 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Don&apos;t have an account?{' '}
            <Link
              to="/register"
              className="font-semibold text-[#6c63ff] hover:text-[#5750d6] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c63ff] rounded-xs"
            >
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
