import { useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap.ts';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  initialFocusRef,
}: ModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const titleId = 'modal-title';
  const descId = 'modal-desc';

  useFocusTrap({
    isOpen,
    onClose,
    containerRef,
    initialFocusRef,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
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
        className="relative z-10 w-full max-w-lg rounded-2xl bg-white dark:bg-[#252538] border border-slate-200 dark:border-white/10 shadow-2xl p-6 sm:p-7 text-left transition-all duration-200 animate-in fade-in zoom-in-95 focus:outline-none"
      >
        <div className="flex items-start justify-between gap-4 mb-5">
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
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c63ff]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
