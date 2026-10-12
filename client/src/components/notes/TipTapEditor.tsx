import { useState, useEffect, useRef, type ChangeEvent, type MouseEvent } from 'react';
import { Node } from '@tiptap/core';
import { useEditor, EditorContent } from '@tiptap/react';
import Image from '@tiptap/extension-image';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { NoteToolbar } from './NoteToolbar.tsx';
import { LinkModal } from './LinkModal.tsx';
import { notesApi } from '../../api/notes.api.ts';

type MediaKind = 'image' | 'video' | 'audio';

const UploadedVideo = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  addAttributes: () => ({ src: { default: null } }),
  parseHTML: () => [{ tag: 'video[src]' }],
  renderHTML: ({ HTMLAttributes }) => [
    'video',
    {
      ...HTMLAttributes,
      controls: true,
      preload: 'metadata',
      crossorigin: 'use-credentials',
      class: 'my-3 max-h-[480px] w-full rounded-lg bg-black',
    },
  ],
});

const UploadedAudio = Node.create({
  name: 'audio',
  group: 'block',
  atom: true,
  addAttributes: () => ({ src: { default: null } }),
  parseHTML: () => [{ tag: 'audio[src]' }],
  renderHTML: ({ HTMLAttributes }) => [
    'audio',
    {
      ...HTMLAttributes,
      controls: true,
      preload: 'metadata',
      crossorigin: 'use-credentials',
      class: 'my-3 w-full',
    },
  ],
});

interface TipTapEditorProps {
  noteId: string;
  initialContent: Record<string, any>;
  onContentChange: (content: Record<string, any>) => void;
  reloadTrigger?: number;
}

export function TipTapEditor({
  noteId,
  initialContent,
  onContentChange,
  reloadTrigger = 0,
}: TipTapEditorProps) {
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const activeNoteIdRef = useRef(noteId);
  const onContentChangeRef = useRef(onContentChange);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const uploadSelectionRef = useRef<{ from: number; to: number }>({ from: 1, to: 1 });
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingSizeRef = useRef(0);
  const recordingExceededLimitRef = useRef(false);
  const mountedRef = useRef(false);
  onContentChangeRef.current = onContentChange;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.stop();
      }
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recorderRef.current = null;
      recordingStreamRef.current = null;
    };
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false,
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: {
          HTMLAttributes: {
            class: 'rounded-lg bg-slate-900 text-slate-100 p-4 font-mono text-sm my-2',
          },
        },
        blockquote: {
          HTMLAttributes: {
            class: 'border-l-4 border-indigo-500 pl-4 italic text-slate-600 dark:text-slate-300 my-2',
          },
        },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'not-prose list-none p-0 my-2 space-y-1',
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'flex items-start gap-2',
        },
      }),
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          class: 'text-indigo-600 dark:text-indigo-400 underline underline-offset-2 hover:text-indigo-800 dark:hover:text-indigo-300',
          rel: 'noopener noreferrer',
          target: '_blank',
        },
        validate: (href) => /^(?:https?:\/\/|mailto:)/i.test(href),
      }),
      Image.configure({
        allowBase64: false,
        HTMLAttributes: {
          class: 'my-3 max-h-[480px] max-w-full rounded-lg object-contain',
          crossorigin: 'use-credentials',
        },
      }),
      UploadedVideo,
      UploadedAudio,
      Placeholder.configure({
        placeholder: 'Write your thoughts, checklist, or documentation...',
        emptyEditorClass: 'is-editor-empty before:content-[attr(data-placeholder)] before:text-slate-400 before:float-left before:pointer-events-none before:h-0',
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        'aria-label': 'Note content',
        role: 'textbox',
        'aria-multiline': 'true',
        class:
          'min-h-[320px] max-h-[600px] overflow-y-auto px-4 py-3 focus:outline-none text-slate-800 dark:text-slate-200 text-sm sm:text-base leading-relaxed',
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      // Event-driven typing update only; avoids controlled two-way binding loops
      const json = currentEditor.getJSON();
      onContentChangeRef.current(json);
    },
  });

  // Only call setContent when the note ID changes or when "Reload latest" triggers
  useEffect(() => {
    if (!editor) return;

    if (activeNoteIdRef.current !== noteId) {
      activeNoteIdRef.current = noteId;
      editor.commands.setContent(initialContent || { type: 'doc', content: [] });
    }
  }, [noteId, initialContent, editor]);

  // Handle explicit reload trigger on conflict resolution ("Reload latest")
  useEffect(() => {
    if (!editor || reloadTrigger === 0) return;
    editor.commands.setContent(initialContent || { type: 'doc', content: [] });
  }, [reloadTrigger, initialContent, editor]);

  const handleSetLink = (url: string) => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const handleRemoveLink = () => {
    if (!editor) return;
    editor.chain().focus().unsetLink().run();
  };

  const currentLinkHref = editor?.getAttributes('link').href || '';

  const handleLinkClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const anchor = target.closest('a[href]');
    if (!(anchor instanceof HTMLAnchorElement) || !editor?.isEditable) return;

    event.preventDefault();
    event.stopPropagation();
    window.open(anchor.href, '_blank', 'noopener,noreferrer');
  };

  const openMediaPicker = (kind: MediaKind) => {
    if (!editor) return;
    uploadSelectionRef.current = {
      from: editor.state.selection.from,
      to: editor.state.selection.to,
    };
    const input = {
      image: imageInputRef.current,
      video: videoInputRef.current,
      audio: audioInputRef.current,
    }[kind];
    input?.click();
  };

  const uploadAndInsertMedia = async (
    kind: MediaKind,
    file: File,
    selection: { from: number; to: number },
    forNoteId: string
  ) => {
    if (!editor) return;
    setUploadError('');
    setIsUploadingMedia(true);
    try {
      const media = await notesApi.uploadMedia(forNoteId, file);
      if (
        !mountedRef.current ||
        editor.isDestroyed ||
        activeNoteIdRef.current !== forNoteId
      ) return;

      const mediaNode = kind === 'image'
        ? { type: 'image', attrs: { src: media.url, alt: media.originalName, title: null } }
        : { type: kind, attrs: { src: media.url } };
      editor
        .chain()
        .focus()
        .setTextSelection(selection)
        .insertContent(mediaNode)
        .run();
    } catch (error) {
      if (mountedRef.current) {
        setUploadError(error instanceof Error ? error.message : 'Unable to upload media.');
      }
    } finally {
      if (mountedRef.current) setIsUploadingMedia(false);
    }
  };

  const handleMediaSelected = async (
    kind: MediaKind,
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file || !editor) return;

    await uploadAndInsertMedia(kind, file, uploadSelectionRef.current, noteId);
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  };

  const toggleAudioRecording = async () => {
    if (isRecordingAudio) {
      stopRecording();
      return;
    }
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setUploadError('Audio recording is not supported in this browser.');
      return;
    }

    setUploadError('');
    uploadSelectionRef.current = {
      from: editor?.state.selection.from || 1,
      to: editor?.state.selection.to || 1,
    };
    const recordingNoteId = noteId;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current || activeNoteIdRef.current !== recordingNoteId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      recordingStreamRef.current = stream;
      const preferredMimeType = [
        'audio/webm;codecs=opus',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recordingChunksRef.current = [];
      recordingSizeRef.current = 0;
      recordingExceededLimitRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size === 0) return;
        recordingSizeRef.current += event.data.size;
        if (recordingSizeRef.current > 50 * 1024 * 1024) {
          recordingExceededLimitRef.current = true;
          setUploadError('Recordings cannot exceed 50 MB. The recording was stopped.');
          stopRecording();
          return;
        }
        recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        recorderRef.current = null;
        if (mountedRef.current) setIsRecordingAudio(false);
        if (recordingExceededLimitRef.current || recordingChunksRef.current.length === 0) return;

        const mimeType = recorder.mimeType.split(';')[0] || 'audio/webm';
        const extension = mimeType === 'audio/mp4' ? 'm4a'
          : mimeType === 'audio/ogg' ? 'ogg'
            : mimeType === 'audio/wav' ? 'wav'
              : mimeType === 'audio/mpeg' ? 'mp3' : 'webm';
        const recording = new File(
          recordingChunksRef.current,
          `audio-message.${extension}`,
          { type: mimeType }
        );
        void uploadAndInsertMedia('audio', recording, uploadSelectionRef.current, recordingNoteId);
      };

      recorder.start(1000);
      setIsRecordingAudio(true);
    } catch (error) {
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      recorderRef.current = null;
      setIsRecordingAudio(false);
      setUploadError(
        error instanceof Error
          ? `Unable to access the microphone: ${error.message}`
          : 'Unable to access the microphone. Check your browser permissions.'
      );
    }
  };

  return (
    <div className="flex flex-col border border-slate-200 dark:border-white/10 rounded-xl bg-white dark:bg-neutral-800 shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-neutral-500/50 transition-all">
      <NoteToolbar
        editor={editor}
        onOpenLinkModal={() => setIsLinkModalOpen(true)}
        onAddMedia={openMediaPicker}
        onToggleAudioRecording={() => void toggleAudioRecording()}
        isRecordingAudio={isRecordingAudio}
        isUploadingMedia={isUploadingMedia}
      />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        aria-label="Choose image file"
        onChange={(event) => void handleMediaSelected('image', event)}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm"
        className="hidden"
        aria-label="Choose video file"
        onChange={(event) => void handleMediaSelected('video', event)}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/webm"
        className="hidden"
        aria-label="Choose audio file"
        onChange={(event) => void handleMediaSelected('audio', event)}
      />
      {isUploadingMedia && (
        <p role="status" className="px-4 pt-2 text-xs text-slate-500 dark:text-slate-400">
          Uploading media…
        </p>
      )}
      {isRecordingAudio && (
        <p role="status" className="flex items-center gap-2 px-4 pt-2 text-xs font-medium text-red-600 dark:text-red-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          Recording audio… Select stop to attach it to this note.
        </p>
      )}
      {uploadError && (
        <p role="alert" className="px-4 pt-2 text-xs text-red-600 dark:text-red-400">
          {uploadError}
        </p>
      )}

      <div className="flex-1" onClickCapture={handleLinkClick}>
        <EditorContent editor={editor} />
      </div>

      <LinkModal
        isOpen={isLinkModalOpen}
        initialUrl={currentLinkHref}
        onClose={() => setIsLinkModalOpen(false)}
        onSetLink={handleSetLink}
        onRemoveLink={handleRemoveLink}
      />
    </div>
  );
}

export default TipTapEditor;
