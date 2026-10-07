import { useState, useRef, type FormEvent } from 'react';
import { Modal } from '../common/Modal.tsx';
import { Input } from '../common/Input.tsx';
import { Select } from '../common/Select.tsx';
import { Button } from '../common/Button.tsx';
import { ApiClientError } from '../../api/client.ts';
import type {
  CreateTaskInput,
  Task,
  TaskCategory,
  TaskPriority,
  TaskStatus,
  UpdateTaskInput,
} from '../../types/task.types.ts';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: Task | null;
  initialTitle?: string;
  onSubmit: (data: CreateTaskInput | UpdateTaskInput) => Promise<void>;
  isSubmitting: boolean;
}

const CATEGORY_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'Work', label: 'Work' },
  { value: 'Home', label: 'Home' },
  { value: 'Personal', label: 'Personal' },
  { value: 'Urgent', label: 'Urgent' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const STATUS_OPTIONS = [
  { value: 'todo', label: 'To Do' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
];

interface TaskModalFormProps {
  taskToEdit?: Task | null;
  initialTitle?: string;
  onSubmit: (data: CreateTaskInput | UpdateTaskInput) => Promise<void>;
  onClose: () => void;
  isSubmitting: boolean;
}

function TaskModalForm({ taskToEdit, initialTitle, onSubmit, onClose, isSubmitting }: TaskModalFormProps) {
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState(taskToEdit?.title || initialTitle || '');
  const [description, setDescription] = useState(taskToEdit?.description || '');
  const [category, setCategory] = useState<TaskCategory>(taskToEdit?.category || 'none');
  const [priority, setPriority] = useState<TaskPriority>(taskToEdit?.priority || 'medium');
  const [status, setStatus] = useState<TaskStatus>(taskToEdit?.status || 'todo');
  const [dueDate, setDueDate] = useState(
    taskToEdit?.dueDate ? taskToEdit.dueDate.slice(0, 10) : ''
  );

  const [errors, setErrors] = useState<{
    title?: string;
    description?: string;
    general?: string;
  }>({});

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Client-side mirror of server validations
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrors((prev) => ({ ...prev, title: 'Title is required' }));
      return;
    }
    if (trimmedTitle.length > 120) {
      setErrors((prev) => ({
        ...prev,
        title: 'Title must be between 1 and 120 characters',
      }));
      return;
    }

    const trimmedDesc = description.trim();
    if (trimmedDesc.length > 1000) {
      setErrors((prev) => ({
        ...prev,
        description: 'Description cannot exceed 1000 characters',
      }));
      return;
    }

    const payload: CreateTaskInput | UpdateTaskInput = {
      title: trimmedTitle,
      description: trimmedDesc,
      category,
      priority,
      status,
      dueDate: dueDate ? dueDate : null,
    };

    try {
      await onSubmit(payload);
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        const fieldErrors: { title?: string; description?: string; general?: string } = {};
        if (err.details && err.details.length > 0) {
          err.details.forEach((detail) => {
            if (detail.field === 'title') fieldErrors.title = detail.message;
            else if (detail.field === 'description') fieldErrors.description = detail.message;
            else fieldErrors.general = detail.message;
          });
        } else {
          fieldErrors.general = err.message;
        }
        setErrors(fieldErrors);
      } else {
        setErrors({ general: 'Failed to save task. Please try again.' });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {errors.general && (
        <div
          role="alert"
          className="p-3 text-xs sm:text-sm font-medium rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50"
        >
          {errors.general}
        </div>
      )}

      {/* Title Input */}
      <Input
        ref={titleInputRef}
        label="Title *"
        placeholder="e.g., Complete project report"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        error={errors.title}
        maxLength={120}
        required
      />

      {/* Description Textarea */}
      <div className="w-full flex flex-col gap-1.5 text-left">
        <label
          htmlFor="task-description"
          className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
        >
          Description
        </label>
        <textarea
          id="task-description"
          rows={3}
          placeholder="Add relevant notes or details..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
          className="w-full px-3.5 py-2.5 rounded-xl text-sm transition-all duration-150 bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 dark:bg-[#1e1e2f] dark:border-white/10 dark:text-slate-100 dark:placeholder:text-slate-500 focus-visible:outline-none focus-visible:border-[#6c63ff] focus-visible:ring-2 focus-visible:ring-[#6c63ff]/30 resize-none"
        />
        {errors.description && (
          <p className="text-xs text-rose-500 font-medium">{errors.description}</p>
        )}
        <span className="text-[11px] text-slate-400 self-end">
          {description.length} / 1000
        </span>
      </div>

      {/* Selects grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Category"
          options={CATEGORY_OPTIONS}
          value={category}
          onChange={(e) => setCategory(e.target.value as TaskCategory)}
        />

        <Select
          label="Priority"
          options={PRIORITY_OPTIONS}
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
        />
      </div>

      {/* Status (if editing) & Due Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {taskToEdit && (
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
          />
        )}

        <div className={taskToEdit ? '' : 'sm:col-span-2'}>
          <Input
            type="date"
            label="Due Date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            helperText="Optional target completion date"
          />
        </div>
      </div>

      {/* Modal Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10 mt-2">
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={isSubmitting}
        >
          {taskToEdit ? 'Save Changes' : 'Create Task'}
        </Button>
      </div>
    </form>
  );
}

export function TaskModal({
  isOpen,
  onClose,
  taskToEdit,
  initialTitle,
  onSubmit,
  isSubmitting,
}: TaskModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={taskToEdit ? 'Edit Task' : 'Create New Task'}
      description={
        taskToEdit
          ? 'Update the details and schedule for this task.'
          : 'Add a new task to your list to stay on track.'
      }
    >
      {isOpen && (
        <TaskModalForm
          key={taskToEdit ? taskToEdit.id : `new-task-${initialTitle ?? ''}`}
          taskToEdit={taskToEdit}
          initialTitle={initialTitle}
          onSubmit={onSubmit}
          onClose={onClose}
          isSubmitting={isSubmitting}
        />
      )}
    </Modal>
  );
}
