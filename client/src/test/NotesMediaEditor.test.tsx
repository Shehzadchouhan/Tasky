import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TipTapEditor } from '../components/notes/TipTapEditor.tsx';
import { notesApi } from '../api/notes.api.ts';

vi.mock('../api/notes.api.ts', () => ({
  notesApi: {
    uploadMedia: vi.fn(),
  },
}));

describe('Note media editor', () => {
  it('uploads and inserts an image at the current editor selection', async () => {
    const user = userEvent.setup();
    const onContentChange = vi.fn();
    vi.mocked(notesApi.uploadMedia).mockResolvedValueOnce({
      id: '507f1f77bcf86cd799439011',
      originalName: 'photo.png',
      mimeType: 'image/png',
      size: 100,
      url: 'http://localhost:5000/api/notes/media/507f1f77bcf86cd799439011',
    });

    render(
      <TipTapEditor
        noteId="507f1f77bcf86cd799439012"
        initialContent={{ type: 'doc', content: [{ type: 'paragraph' }] }}
        onContentChange={onContentChange}
      />
    );

    const imageInput = await screen.findByLabelText('Choose image file');
    const photo = new File(['image content'], 'photo.png', { type: 'image/png' });
    await user.upload(imageInput, photo);

    await waitFor(() => {
      expect(notesApi.uploadMedia).toHaveBeenCalledWith('507f1f77bcf86cd799439012', photo);
      expect(onContentChange).toHaveBeenCalledWith(expect.objectContaining({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'image',
            attrs: expect.objectContaining({
              src: 'http://localhost:5000/api/notes/media/507f1f77bcf86cd799439011',
            }),
          }),
        ]),
      }));
    });
  });

  it('records a microphone message and uploads it into the open note', async () => {
    class MockMediaRecorder {
      static isTypeSupported = vi.fn(() => true);
      mimeType = 'audio/webm;codecs=opus';
      state = 'inactive';
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;

      start() {
        this.state = 'recording';
      }

      stop() {
        this.state = 'inactive';
        this.ondataavailable?.({ data: new Blob(['voice message'], { type: 'audio/webm' }) });
        this.onstop?.();
      }
    }

    const track = { stop: vi.fn() };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }) },
    });
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);

    const onContentChange = vi.fn();
    vi.mocked(notesApi.uploadMedia).mockResolvedValueOnce({
      id: '507f1f77bcf86cd799439013',
      originalName: 'audio-message.webm',
      mimeType: 'audio/webm',
      size: 13,
      url: 'http://localhost:5000/api/notes/media/507f1f77bcf86cd799439013',
    });
    const user = userEvent.setup();

    render(
      <TipTapEditor
        noteId="507f1f77bcf86cd799439012"
        initialContent={{ type: 'doc', content: [{ type: 'paragraph' }] }}
        onContentChange={onContentChange}
      />
    );

    await user.click(await screen.findByRole('button', { name: 'Start audio recording' }));
    expect(await screen.findByText(/Recording audio/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Stop audio recording' }));

    await waitFor(() => {
      expect(notesApi.uploadMedia).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439012',
        expect.objectContaining({ name: 'audio-message.webm', type: 'audio/webm' })
      );
      expect(onContentChange).toHaveBeenCalledWith(expect.objectContaining({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'audio',
            attrs: {
              src: 'http://localhost:5000/api/notes/media/507f1f77bcf86cd799439013',
            },
          }),
        ]),
      }));
    });
    expect(track.stop).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('renders links as clickable links opening in a protected new tab', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(
      <TipTapEditor
        noteId="507f1f77bcf86cd799439012"
        initialContent={{
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Open site',
              marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
            }],
          }],
        }}
        onContentChange={vi.fn()}
      />
    );

    const link = await screen.findByRole('link', { name: 'Open site' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    fireEvent.click(link);
    expect(open).toHaveBeenCalledWith(
      'https://example.com/',
      '_blank',
      'noopener,noreferrer'
    );
  });
});
