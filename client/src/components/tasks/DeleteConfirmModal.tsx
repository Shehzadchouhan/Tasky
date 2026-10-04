import { useRef } from 'react';
import { Modal } from '../common/Modal.tsx';
import { Button } from '../common/Button.tsx';
import type { Task } from '../../types/task.types.ts';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onConfirm: (id: string) => Promise<void>;
  isDeleting: boolean;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  task,
  onConfirm,
  isDeleting,
}: DeleteConfirmModalProps) {
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  if (!task) return null;

  const handleDelete = async () => {
    await onConfirm(task.id);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Task"
      initialFocusRef={cancelBtnRef}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-slate-900 dark:text-white">
            &ldquo;{task.title}&rdquo;
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
            Delete Task
          </Button>
        </div>
      </div>
    </Modal>
  );
}
