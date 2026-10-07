import type { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  SquareCode,
  Link as LinkIcon,
  Undo,
  Redo,
} from 'lucide-react';

interface NoteToolbarProps {
  editor: Editor | null;
  onOpenLinkModal: () => void;
}

export function NoteToolbar({ editor, onOpenLinkModal }: NoteToolbarProps) {
  if (!editor) {
    return null;
  }

  const btnClass = (isActive: boolean, disabled: boolean = false) =>
    `p-1.5 rounded-md transition-colors text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white ${
      isActive
        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 font-semibold'
        : 'hover:bg-slate-100 dark:hover:bg-white/10'
    } ${disabled ? 'opacity-40 cursor-not-allowed hover:bg-transparent' : ''}`;

  return (
    <div
      role="toolbar"
      aria-label="Note formatting toolbar"
      className="flex flex-wrap items-center gap-0.5 sm:gap-1 p-2 border-b border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#1e1e2f]/50 rounded-t-xl"
    >
      {/* Undo / Redo */}
      <button
        type="button"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        aria-label="Undo (Ctrl+Z)"
        aria-pressed={false}
        className={btnClass(false, !editor.can().undo())}
      >
        <Undo className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        aria-label="Redo (Ctrl+Y)"
        aria-pressed={false}
        className={btnClass(false, !editor.can().redo())}
      >
        <Redo className="w-4 h-4" />
      </button>

      <div className="w-px h-4 bg-slate-300 dark:bg-white/20 mx-1" aria-hidden="true" />

      {/* Bold, Italic, Strike, Inline Code */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        aria-label="Bold (Ctrl+B)"
        aria-pressed={editor.isActive('bold')}
        className={btnClass(editor.isActive('bold'))}
      >
        <Bold className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        aria-label="Italic (Ctrl+I)"
        aria-pressed={editor.isActive('italic')}
        className={btnClass(editor.isActive('italic'))}
      >
        <Italic className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        aria-label="Strikethrough (Ctrl+Shift+S)"
        aria-pressed={editor.isActive('strike')}
        className={btnClass(editor.isActive('strike'))}
      >
        <Strikethrough className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCode().run()}
        aria-label="Inline Code (Ctrl+E)"
        aria-pressed={editor.isActive('code')}
        className={btnClass(editor.isActive('code'))}
      >
        <Code className="w-4 h-4" />
      </button>

      <div className="w-px h-4 bg-slate-300 dark:bg-white/20 mx-1" aria-hidden="true" />

      {/* Headings */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        aria-label="Heading 1"
        aria-pressed={editor.isActive('heading', { level: 1 })}
        className={btnClass(editor.isActive('heading', { level: 1 }))}
      >
        <Heading1 className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        aria-label="Heading 2"
        aria-pressed={editor.isActive('heading', { level: 2 })}
        className={btnClass(editor.isActive('heading', { level: 2 }))}
      >
        <Heading2 className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        aria-label="Heading 3"
        aria-pressed={editor.isActive('heading', { level: 3 })}
        className={btnClass(editor.isActive('heading', { level: 3 }))}
      >
        <Heading3 className="w-4 h-4" />
      </button>

      <div className="w-px h-4 bg-slate-300 dark:bg-white/20 mx-1" aria-hidden="true" />

      {/* Lists */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        aria-label="Bullet list"
        aria-pressed={editor.isActive('bulletList')}
        className={btnClass(editor.isActive('bulletList'))}
      >
        <List className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        aria-label="Numbered list"
        aria-pressed={editor.isActive('orderedList')}
        className={btnClass(editor.isActive('orderedList'))}
      >
        <ListOrdered className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        aria-label="Checklist (Task list)"
        aria-pressed={editor.isActive('taskList')}
        className={btnClass(editor.isActive('taskList'))}
      >
        <ListTodo className="w-4 h-4" />
      </button>

      <div className="w-px h-4 bg-slate-300 dark:bg-white/20 mx-1" aria-hidden="true" />

      {/* Blockquote & Code Block */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        aria-label="Blockquote"
        aria-pressed={editor.isActive('blockquote')}
        className={btnClass(editor.isActive('blockquote'))}
      >
        <Quote className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        aria-label="Code block"
        aria-pressed={editor.isActive('codeBlock')}
        className={btnClass(editor.isActive('codeBlock'))}
      >
        <SquareCode className="w-4 h-4" />
      </button>

      <div className="w-px h-4 bg-slate-300 dark:bg-white/20 mx-1" aria-hidden="true" />

      {/* Link */}
      <button
        type="button"
        onClick={onOpenLinkModal}
        aria-label="Insert or edit link"
        aria-pressed={editor.isActive('link')}
        className={btnClass(editor.isActive('link'))}
      >
        <LinkIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
