import { Loader2 } from 'lucide-react';

export function Spinner({
  size = 'md',
  label = 'Loading...',
}: {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}) {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
  };

  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-2 p-6 text-slate-400 dark:text-slate-500"
    >
      <Loader2 className={`${sizeMap[size]} animate-spin text-[#6c63ff]`} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function TaskSkeleton() {
  return (
    <div className="w-full p-4 sm:p-5 rounded-2xl bg-white/60 dark:bg-[#252538]/60 border border-slate-200/80 dark:border-white/5 animate-pulse flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div className="h-5 bg-slate-200 dark:bg-white/10 rounded-md w-1/3" />
        <div className="h-5 bg-slate-200 dark:bg-white/10 rounded-md w-16" />
      </div>
      <div className="h-4 bg-slate-200 dark:bg-white/10 rounded-md w-2/3" />
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
        <div className="h-4 bg-slate-200 dark:bg-white/10 rounded-md w-24" />
        <div className="h-4 bg-slate-200 dark:bg-white/10 rounded-md w-16" />
      </div>
    </div>
  );
}
