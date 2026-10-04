import { apiClient } from './client.ts';
import type { LoginInput, RegisterInput, AuthResponse, LogoutResponse } from '../types/auth.types.ts';

export const authApi = {
  login: async (credentials: LoginInput): Promise<AuthResponse> => {
    return apiClient<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  register: async (data: RegisterInput): Promise<AuthResponse> => {
    return apiClient<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  logout: async (): Promise<LogoutResponse> => {
    return apiClient<LogoutResponse>('/auth/logout', {
      method: 'POST',
    });
  },

  getMe: async (): Promise<AuthResponse> => {
    return apiClient<AuthResponse>('/auth/me', {
      method: 'GET',
      skipAuthRedirect: true,
    });
  },
};
