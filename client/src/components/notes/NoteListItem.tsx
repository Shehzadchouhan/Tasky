import { formatRelativeTime } from '../../utils/date.ts';
import type { NoteSummary } from '../../types/note.types.ts';

interface NoteListItemProps {
  note: NoteSummary;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export function NoteListItem({ note, isSelected, onSelect }: NoteListItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(note.id)}
      aria-selected={isSelected}
      className={`w-full text-left p-3.5 rounded-xl transition-all border flex flex-col gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c63ff] ${
        isSelected
          ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800/80 shadow-xs'
          : 'bg-white dark:bg-[#252538]/60 border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 hover:bg-slate-50/50 dark:hover:bg-[#252538]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold text-sm text-slate-900 dark:text-white truncate">
          {note.title || 'Untitled'}
        </h4>
        <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
          {formatRelativeTime(note.updatedAt)}
        </span>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
        {note.snippet || <span className="italic text-slate-400">Empty note</span>}
      </p>
    </button>
  );
}
