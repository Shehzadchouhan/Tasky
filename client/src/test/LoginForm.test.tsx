import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage.tsx';
import { AuthProvider } from '../context/AuthContext.tsx';
import { ToastProvider } from '../context/ToastContext.tsx';
import { authApi } from '../api/auth.api.ts';
import { ApiClientError } from '../api/client.ts';

// Mock auth API
vi.mock('../api/auth.api.ts', () => ({
  authApi: {
    getMe: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  },
}));

describe('LoginPage & Form Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.getMe).mockRejectedValue(new Error('Unauthenticated'));
  });

  const renderLoginPage = () => {
    return render(
      <MemoryRouter initialEntries={['/login']}>
        <ToastProvider>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>
    );
  };

  it('shows validation error when submitting with empty email', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const submitBtn = screen.getByRole('button', { name: /Sign In/i });
    await user.click(submitBtn);

    expect(screen.getByText('Email is required')).toBeInTheDocument();
  });

  it('shows validation error when password is empty', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const emailInput = screen.getByLabelText(/Email Address/i);
    await user.type(emailInput, 'user@example.com');

    const submitBtn = screen.getByRole('button', { name: /Sign In/i });
    await user.click(submitBtn);

    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  it('displays server error banner on failed 401 login attempt', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.login).mockRejectedValueOnce(
      new ApiClientError('Invalid email or password', 401)
    );

    renderLoginPage();

    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitBtn = screen.getByRole('button', { name: /Sign In/i });

    await user.type(emailInput, 'wrong@example.com');
    await user.type(passwordInput, 'wrongpassword');
    await user.click(submitBtn);

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });

  it('calls authApi.login with user credentials on valid submit', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.login).mockResolvedValueOnce({
      user: {
        id: '123',
        name: 'Test User',
        email: 'test@example.com',
        createdAt: '2026-10-01T00:00:00.000Z',
      },
    });

    renderLoginPage();

    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitBtn = screen.getByRole('button', { name: /Sign In/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'securepassword');
    await user.click(submitBtn);

    expect(authApi.login).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'securepassword',
    });
  });
});
