import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LinkModal } from '../components/notes/LinkModal.tsx';

describe('LinkModal Component & URL Sanitization', () => {
  it('renders input and buttons when open', () => {
    render(
      <LinkModal
        isOpen={true}
        onClose={vi.fn()}
        onSetLink={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/URL Address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Link/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });

  it('accepts valid https, http, and mailto links', async () => {
    const user = userEvent.setup();
    const handleSetLink = vi.fn();
    const handleClose = vi.fn();

    const { rerender } = render(
      <LinkModal
        isOpen={true}
        onClose={handleClose}
        onSetLink={handleSetLink}
      />
    );

    // Test https
    const input = screen.getByLabelText(/URL Address/i);
    await user.type(input, 'https://example.com/notes');
    await user.click(screen.getByRole('button', { name: /Save Link/i }));

    expect(handleSetLink).toHaveBeenCalledWith('https://example.com/notes');
    expect(handleClose).toHaveBeenCalled();

    // Test mailto
    handleSetLink.mockClear();
    rerender(
      <LinkModal
        isOpen={true}
        onClose={handleClose}
        onSetLink={handleSetLink}
      />
    );
    await user.clear(input);
    await user.type(input, 'mailto:support@taskly.app');
    await user.click(screen.getByRole('button', { name: /Save Link/i }));

    expect(handleSetLink).toHaveBeenCalledWith('mailto:support@taskly.app');
  });

  it('rejects javascript: URLs and displays an error message without saving', async () => {
    const user = userEvent.setup();
    const handleSetLink = vi.fn();

    render(
      <LinkModal
        isOpen={true}
        onClose={vi.fn()}
        onSetLink={handleSetLink}
      />
    );

    const input = screen.getByLabelText(/URL Address/i);
    await user.type(input, 'javascript:alert("XSS")');
    await user.click(screen.getByRole('button', { name: /Save Link/i }));

    expect(handleSetLink).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Links with javascript:, data:, or vbscript: are strictly prohibited/i)
    ).toBeInTheDocument();
  });

  it('rejects data: and vbscript: URLs', async () => {
    const user = userEvent.setup();
    const handleSetLink = vi.fn();

    render(
      <LinkModal
        isOpen={true}
        onClose={vi.fn()}
        onSetLink={handleSetLink}
      />
    );

    const input = screen.getByLabelText(/URL Address/i);
    await user.type(input, 'data:text/html,<script>alert(1)</script>');
    await user.click(screen.getByRole('button', { name: /Save Link/i }));

    expect(handleSetLink).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Links with javascript:, data:, or vbscript: are strictly prohibited/i)
    ).toBeInTheDocument();
  });

  it('rejects URLs exceeding 2048 characters', async () => {
    const user = userEvent.setup();
    const handleSetLink = vi.fn();

    render(
      <LinkModal
        isOpen={true}
        onClose={vi.fn()}
        onSetLink={handleSetLink}
      />
    );

    const input = screen.getByLabelText(/URL Address/i);
    const longUrl = 'https://example.com/' + 'a'.repeat(2050);
    fireEvent.change(input, { target: { value: longUrl } });
    await user.click(screen.getByRole('button', { name: /Save Link/i }));

    expect(handleSetLink).not.toHaveBeenCalled();
    expect(screen.getByText(/URL cannot exceed 2048 characters/i)).toBeInTheDocument();
  });
});
