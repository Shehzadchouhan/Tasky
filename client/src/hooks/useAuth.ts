import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext.tsx';
import type { AuthContextType } from '../context/AuthContext.tsx';

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
