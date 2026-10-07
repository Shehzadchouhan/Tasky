import { useState, useRef, useEffect } from 'react';
import { Modal } from '../common/Modal.tsx';
import { Button } from '../common/Button.tsx';
import { Input } from '../common/Input.tsx';

interface LinkModalProps {
  isOpen: boolean;
  initialUrl?: string;
  onClose: () => void;
  onSetLink: (url: string) => void;
  onRemoveLink?: () => void;
}

const FORBIDDEN_PROTOCOLS = /^(?:javascript|data|vbscript):/i;
const ALLOWED_PROTOCOLS = /^(?:https?:\/\/|mailto:)/i;

export function LinkModal({
  isOpen,
  initialUrl = '',
  onClose,
  onSetLink,
  onRemoveLink,
}: LinkModalProps) {
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setUrl(initialUrl);
      setError('');
    }
  }, [isOpen, initialUrl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();

    if (!trimmed) {
      setError('URL is required');
      return;
    }

    if (trimmed.length > 2048) {
      setError('URL cannot exceed 2048 characters');
      return;
    }

    if (FORBIDDEN_PROTOCOLS.test(trimmed)) {
      setError('Links with javascript:, data:, or vbscript: are strictly prohibited');
      return;
    }

    if (!ALLOWED_PROTOCOLS.test(trimmed)) {
      setError('Link must start with http://, https:// or mailto:');
      return;
    }

    onSetLink(trimmed);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialUrl ? 'Edit Link' : 'Insert Link'}
      initialFocusRef={inputRef}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Input
            ref={inputRef}
            label="URL Address"
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError('');
            }}
            placeholder="https://example.com or mailto:user@example.com"
            error={error}
            aria-label="Link URL input"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Must start with <code className="font-mono text-xs">http://</code>,{' '}
            <code className="font-mono text-xs">https://</code>, or{' '}
            <code className="font-mono text-xs">mailto:</code>
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
          <div>
            {initialUrl && onRemoveLink && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  onRemoveLink();
                  onClose();
                }}
              >
                Remove Link
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md">
              Save Link
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
