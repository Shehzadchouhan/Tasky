import { useRef } from 'react';
import { Modal } from '../common/Modal.tsx';
import { Button } from '../common/Button.tsx';
import type { Note, NoteSummary } from '../../types/note.types.ts';

interface DeleteNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: Note | NoteSummary | null;
  onConfirm: (id: string) => Promise<void>;
  isDeleting: boolean;
}

export function DeleteNoteModal({
  isOpen,
  onClose,
  note,
  onConfirm,
  isDeleting,
}: DeleteNoteModalProps) {
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  if (!note) return null;

  const handleDelete = async () => {
    await onConfirm(note.id);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Note"
      initialFocusRef={cancelBtnRef}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-slate-900 dark:text-white">
            &ldquo;{note.title || 'Untitled'}&rdquo;
          </span>
          ? This action cannot be undone.
        </p>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
          <Button
            ref={cancelBtnRef}
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="md"
            onClick={handleDelete}
            isLoading={isDeleting}
          >
            Delete Note
          </Button>
        </div>
      </div>
    </Modal>
  );
}
