import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Modal } from '../components/common/Modal.tsx';

describe('Modal focus management', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not move focus away from an input when modal content rerenders', () => {
    vi.useFakeTimers();

    function EditableModal() {
      const [value, setValue] = useState('');

      return (
        <Modal isOpen onClose={() => {}} title="Edit note">
          <input
            aria-label="Note content"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <span>{value}</span>
        </Modal>
      );
    }

    render(<EditableModal />);
    act(() => {
      vi.advanceTimersByTime(20);
    });

    const input = screen.getByRole('textbox', { name: 'Note content' });
    input.focus();
    fireEvent.change(input, { target: { value: 'Keep typing' } });

    act(() => {
      vi.advanceTimersByTime(20);
    });

    expect(input).toHaveFocus();
    expect(input).toHaveValue('Keep typing');
  });
});
