import { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { NoteToolbar } from './NoteToolbar.tsx';
import { LinkModal } from './LinkModal.tsx';

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
  const activeNoteIdRef = useRef(noteId);
  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;

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
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-indigo-600 dark:text-indigo-400 underline underline-offset-2 hover:text-indigo-800 dark:hover:text-indigo-300',
          rel: 'noopener noreferrer',
          target: '_blank',
        },
        validate: (href) => /^(?:https?:\/\/|mailto:)/i.test(href),
      }),
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

  return (
    <div className="flex flex-col border border-slate-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#252538] shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-[#6c63ff]/50 transition-all">
      <NoteToolbar
        editor={editor}
        onOpenLinkModal={() => setIsLinkModalOpen(true)}
      />

      <EditorContent editor={editor} className="flex-1" />

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
