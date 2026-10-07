export interface TipTapMark {
  type: string;
  attrs?: Record<string, any>;
}

export interface TipTapNode {
  type: string;
  text?: string;
  marks?: TipTapMark[];
  attrs?: Record<string, any>;
  content?: TipTapNode[];
}

const ALLOWED_NODE_TYPES = new Set([
  'doc',
  'paragraph',
  'heading',
  'text',
  'bulletList',
  'orderedList',
  'listItem',
  'taskList',
  'taskItem',
  'blockquote',
  'codeBlock',
  'hardBreak',
  'horizontalRule',
]);

const ALLOWED_MARKS = new Set(['bold', 'italic', 'strike', 'code', 'link']);

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'taskList',
  'taskItem',
  'blockquote',
  'codeBlock',
]);

const FORBIDDEN_PROTOCOLS = /^(?:javascript|data|vbscript):/i;
const ALLOWED_LINK_PROTOCOLS = /^(?:https?:\/\/|mailto:)/i;

/**
 * Validates a TipTap JSON document against strict schema constraints:
 * - Allowlist of nodes and marks
 * - No unknown properties or attributes
 * - Max depth 12
 * - Max nodes 5000
 * - Max serialized size 100 KB
 * - Root must be { type: "doc", content: [...] }
 */
export function validateTipTapDoc(doc: unknown): void {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new Error('TipTap document must be a non-null object');
  }

  const root = doc as Record<string, any>;

  // Root key check
  const rootKeys = Object.keys(root);
  for (const k of rootKeys) {
    if (k !== 'type' && k !== 'content') {
      throw new Error(`Unknown property "${k}" on root doc`);
    }
  }

  if (root.type !== 'doc') {
    throw new Error('Root node type must be "doc"');
  }

  if (!Array.isArray(root.content)) {
    throw new Error('Root content must be an array');
  }

  let totalNodes = 1; // root counts as 1

  function validateNode(node: unknown, depth: number): void {
    if (depth > 12) {
      throw new Error('Document nesting depth exceeds 12 levels');
    }

    totalNodes += 1;
    if (totalNodes > 5000) {
      throw new Error('Document exceeds maximum 5000 nodes');
    }

    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      throw new Error('Node must be an object');
    }

    const n = node as Record<string, any>;
    const nodeType = n.type;

    if (typeof nodeType !== 'string' || !ALLOWED_NODE_TYPES.has(nodeType)) {
      throw new Error(`Unknown node type: ${nodeType}`);
    }

    if (nodeType === 'doc') {
      throw new Error('Child node cannot have type "doc"');
    }

    const keys = Object.keys(n);

    if (nodeType === 'text') {
      // Allowed keys: type, text, marks
      for (const k of keys) {
        if (k !== 'type' && k !== 'text' && k !== 'marks') {
          throw new Error(`Unknown property "${k}" on text node`);
        }
      }

      if (typeof n.text !== 'string') {
        throw new Error('Text node must contain string text');
      }

      if (n.marks !== undefined) {
        if (!Array.isArray(n.marks)) {
          throw new Error('Marks must be an array');
        }
        for (const mark of n.marks) {
          validateMark(mark);
        }
      }
      return;
    }

    if (nodeType === 'hardBreak') {
      for (const k of keys) {
        if (k !== 'type' && k !== 'marks') {
          throw new Error(`Unknown property "${k}" on hardBreak node`);
        }
      }
      if (n.marks !== undefined) {
        if (!Array.isArray(n.marks)) {
          throw new Error('Marks must be an array');
        }
        for (const mark of n.marks) {
          validateMark(mark);
        }
      }
      return;
    }

    if (nodeType === 'horizontalRule') {
      for (const k of keys) {
        if (k !== 'type') {
          throw new Error(`Unknown property "${k}" on horizontalRule node`);
        }
      }
      return;
    }

    if (nodeType === 'heading') {
      for (const k of keys) {
        if (k !== 'type' && k !== 'attrs' && k !== 'content') {
          throw new Error(`Unknown property "${k}" on heading node`);
        }
      }
      if (!n.attrs || typeof n.attrs !== 'object' || Array.isArray(n.attrs)) {
        throw new Error('Heading node requires attrs object with level');
      }
      const headingAttrKeys = Object.keys(n.attrs);
      for (const ak of headingAttrKeys) {
        if (ak !== 'level') {
          throw new Error(`Unknown attribute "${ak}" on heading`);
        }
      }
      if (!Number.isInteger(n.attrs.level) || n.attrs.level < 1 || n.attrs.level > 3) {
        throw new Error('Heading level must be an integer between 1 and 3');
      }
    } else if (nodeType === 'taskItem') {
      for (const k of keys) {
        if (k !== 'type' && k !== 'attrs' && k !== 'content') {
          throw new Error(`Unknown property "${k}" on taskItem node`);
        }
      }
      if (!n.attrs || typeof n.attrs !== 'object' || Array.isArray(n.attrs)) {
        throw new Error('taskItem requires attrs object with checked');
      }
      const taskAttrKeys = Object.keys(n.attrs);
      for (const ak of taskAttrKeys) {
        if (ak !== 'checked') {
          throw new Error(`Unknown attribute "${ak}" on taskItem`);
        }
      }
      if (typeof n.attrs.checked !== 'boolean') {
        throw new Error('taskItem attrs.checked must be a boolean');
      }
    } else {
      // paragraph, bulletList, orderedList, listItem, taskList, blockquote, codeBlock
      for (const k of keys) {
        if (k !== 'type' && k !== 'content') {
          throw new Error(`Unknown property "${k}" on ${nodeType} node`);
        }
      }
    }

    if (n.content !== undefined) {
      if (!Array.isArray(n.content)) {
        throw new Error(`Content of ${nodeType} must be an array`);
      }
      for (const child of n.content) {
        validateNode(child, depth + 1);
      }
    }
  }

  function validateMark(mark: unknown): void {
    if (!mark || typeof mark !== 'object' || Array.isArray(mark)) {
      throw new Error('Mark must be an object');
    }
    const m = mark as Record<string, any>;
    const markType = m.type;

    if (typeof markType !== 'string' || !ALLOWED_MARKS.has(markType)) {
      throw new Error(`Unknown mark: ${markType}`);
    }

    const markKeys = Object.keys(m);
    for (const mk of markKeys) {
      if (mk !== 'type' && mk !== 'attrs') {
        throw new Error(`Unknown property "${mk}" on mark`);
      }
    }

    if (markType === 'link') {
      if (!m.attrs || typeof m.attrs !== 'object' || Array.isArray(m.attrs)) {
        throw new Error('Link mark requires attrs object with href');
      }
      const linkAttrKeys = Object.keys(m.attrs);
      for (const lak of linkAttrKeys) {
        if (lak !== 'href') {
          throw new Error(`Unknown attribute "${lak}" on link mark`);
        }
      }

      const href = m.attrs.href;
      if (typeof href !== 'string') {
        throw new Error('Link href must be a string');
      }
      if (href.length > 2048) {
        throw new Error('Link href exceeds maximum length of 2048 characters');
      }
      if (FORBIDDEN_PROTOCOLS.test(href)) {
        throw new Error('Link href with javascript:, data:, or vbscript: protocol is strictly rejected');
      }
      if (!ALLOWED_LINK_PROTOCOLS.test(href)) {
        throw new Error('Link href must start with http://, https:// or mailto:');
      }
    } else {
      // bold, italic, strike, code
      if (m.attrs !== undefined && Object.keys(m.attrs).length > 0) {
        throw new Error(`Mark ${markType} does not accept attributes`);
      }
    }
  }

  for (const child of root.content) {
    validateNode(child, 2); // child of root doc is depth 2
  }

  // Serialized size limit: 100 KB
  const serialized = JSON.stringify(doc);
  if (Buffer.byteLength(serialized, 'utf8') > 100 * 1024) {
    throw new Error('Document serialized size exceeds 100 KB');
  }
}

/**
 * Extracts plain text from a TipTap document:
 * - Concatenates text nodes with spaces between block containers
 * - Safely handles empty or missing content fallback
 * - Trimmed and capped at 20000 characters
 */
export function extractPlainText(doc: unknown): string {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return '';
  }

  const root = doc as Record<string, any>;
  if (!Array.isArray(root.content) || root.content.length === 0) {
    return '';
  }

  function getBlockText(node: any): string {
    if (!node || typeof node !== 'object') {
      return '';
    }

    if (node.type === 'text') {
      return typeof node.text === 'string' ? node.text : '';
    }

    if (node.type === 'hardBreak') {
      return ' ';
    }

    if (!Array.isArray(node.content) || node.content.length === 0) {
      return '';
    }

    const hasBlockChildren = node.content.some((c: any) => c && BLOCK_TYPES.has(c.type));

    if (hasBlockChildren) {
      return node.content
        .map((c: any) => getBlockText(c).trim())
        .filter((s: string) => s.length > 0)
        .join(' ');
    }

    // Inline children (text, hardBreak)
    return node.content.map((c: any) => getBlockText(c)).join('');
  }

  const text = root.content
    .map((c: any) => getBlockText(c).trim())
    .filter((s: string) => s.length > 0)
    .join(' ');

  return text.trim().slice(0, 20000);
}
