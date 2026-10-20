import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme.ts';

export function Header() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/90 dark:bg-neutral-950/90 border-b border-yellow-500/15 dark:border-yellow-400/20 transition-colors">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo / Brand */}
        <div className="flex items-center gap-2.5">
          <img
            src="/taskly-icon.svg"
            alt="Taskly Logo"
            className="w-9 h-9 rounded-xl object-cover border border-yellow-400/30 shadow-sm shadow-yellow-500/20"
          />
          <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-neutral-950 via-yellow-700 to-amber-600 dark:from-yellow-300 dark:via-yellow-200 dark:to-yellow-400 bg-clip-text text-transparent">
            Taskly
          </span>
        </div>

        {/* User Info & Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-xl text-slate-600 dark:text-yellow-200 hover:bg-slate-100 dark:hover:bg-yellow-300/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-yellow-300" aria-hidden="true" />
            ) : (
              <Moon className="w-5 h-5 text-yellow-700" aria-hidden="true" />
            )}
          </button>

        </div>
      </div>
    </header>
  );
}
