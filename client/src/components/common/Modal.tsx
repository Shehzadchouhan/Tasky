import { useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap.ts';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  className?: string;
  isFullScreen?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  initialFocusRef,
  className = '',
  isFullScreen = false,
}: ModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const id = useId();
  const titleId = `${id}-modal-title`;
  const descId = `${id}-modal-desc`;

  useFocusTrap({
    isOpen,
    onClose,
    containerRef,
    initialFocusRef,
  });

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center overflow-y-auto ${
        isFullScreen ? 'p-0' : 'p-4 sm:p-6'
      }`}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Content */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`relative z-10 w-full ${
          isFullScreen
            ? 'flex h-dvh max-w-none flex-col rounded-none border-0 p-4 sm:p-6'
            : 'max-w-lg rounded-2xl border p-6 sm:p-7'
        } bg-white dark:bg-neutral-900 border-slate-200 dark:border-white/10 shadow-2xl text-left transition-all duration-200 animate-in fade-in zoom-in-95 focus:outline-none ${className}`}
      >
        <div className="mb-5 flex shrink-0 items-start justify-between gap-4">
          <div>
            <h2
              id={titleId}
              className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-tight"
            >
              {title}
            </h2>
            {description && (
              <p
                id={descId}
                className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1"
              >
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isFullScreen ? <div className="flex min-h-0 flex-1 flex-col">{children}</div> : children}
      </div>
    </div>
  );
}
