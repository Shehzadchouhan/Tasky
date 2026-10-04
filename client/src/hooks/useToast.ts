import { useContext } from 'react';
import { ToastContext } from '../context/ToastContext.tsx';
import type { ToastContextType } from '../context/ToastContext.tsx';

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
