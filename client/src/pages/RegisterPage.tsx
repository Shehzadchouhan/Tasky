import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckSquare } from 'lucide-react';
import { Input } from '../components/common/Input.tsx';
import { Button } from '../components/common/Button.tsx';
import { useAuth } from '../hooks/useAuth.ts';
import { useToast } from '../hooks/useToast.ts';
import { ApiClientError } from '../api/client.ts';

export function RegisterPage() {
  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    general?: string;
  }>({});

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    // Client-side mirror of server validations
    let hasError = false;
    const clientErrors: { name?: string; email?: string; password?: string } = {};

    if (!trimmedName) {
      clientErrors.name = 'Name is required';
      hasError = true;
    } else if (trimmedName.length > 50) {
      clientErrors.name = 'Name must not exceed 50 characters';
      hasError = true;
    }

    if (!trimmedEmail) {
      clientErrors.email = 'Email is required';
      hasError = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      clientErrors.email = 'Invalid email address';
      hasError = true;
    }

    if (!password) {
      clientErrors.password = 'Password is required';
      hasError = true;
    } else if (password.length < 8) {
      clientErrors.password = 'Password must be at least 8 characters';
      hasError = true;
    } else if (password.length > 72) {
      clientErrors.password = 'Password must not exceed 72 characters';
      hasError = true;
    }

    if (hasError) {
      setErrors(clientErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await register({ name: trimmedName, email: trimmedEmail, password });
      showToast('Account created successfully! Welcome to Taskly.', 'success');
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiClientError) {
        const fieldErrors: {
          name?: string;
          email?: string;
          password?: string;
          general?: string;
        } = {};
        if (err.details && err.details.length > 0) {
          err.details.forEach((detail) => {
            if (detail.field === 'name') fieldErrors.name = detail.message;
            else if (detail.field === 'email') fieldErrors.email = detail.message;
            else if (detail.field === 'password') fieldErrors.password = detail.message;
            else fieldErrors.general = detail.message;
          });
        } else {
          fieldErrors.general = err.message;
        }
        setErrors(fieldErrors);
      } else {
        setErrors({ general: 'Failed to create account. Please try again later.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-transparent transition-colors">
      <div className="w-full max-w-md flex flex-col gap-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-neutral-700 to-neutral-950 dark:from-neutral-200 dark:to-white flex items-center justify-center text-white dark:text-neutral-900 shadow-lg shadow-black/20 mb-3">
            <CheckSquare className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Create an account
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Get started with Taskly today for free.
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-white/90 dark:bg-neutral-900/85 border border-slate-200/80 dark:border-white/10 rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-sm">
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
              label="Full Name"
              placeholder="Alex Smith"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              maxLength={50}
              required
            />

            <Input
              type="email"
              label="Email Address"
              placeholder="alex@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              required
            />

            <Input
              type="password"
              label="Password"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              helperText="Must be 8 to 72 characters long"
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              isLoading={isSubmitting}
            >
              Create Account
            </Button>
          </form>

          <div className="pt-6 mt-6 border-t border-slate-100 dark:border-white/5 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold text-slate-800 dark:text-slate-200 hover:text-black dark:hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 rounded-xs"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
