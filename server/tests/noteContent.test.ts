import { describe, it, expect } from 'vitest';
import {
  validateTipTapDoc,
  extractPlainText,
} from '../src/validation/noteContent.validation.js';

describe('TipTap Content Validation & PlainText Extraction', () => {
  describe('Document Validation: Allowed Nodes & Marks', () => {
    it('should accept an empty document', () => {
      const doc = { type: 'doc', content: [] };
      expect(() => validateTipTapDoc(doc)).not.toThrow();
    });

    it('should accept document with paragraph and text', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello, World!' }],
          },
        ],
      };
      expect(() => validateTipTapDoc(doc)).not.toThrow();
    });

    it('should accept headings with levels 1, 2, and 3', () => {
      for (const level of [1, 2, 3]) {
        const doc = {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level },
              content: [{ type: 'text', text: `Heading ${level}` }],
            },
          ],
        };
        expect(() => validateTipTapDoc(doc)).not.toThrow();
      }
    });

    it('should accept taskList and taskItem with boolean checked attribute', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                attrs: { checked: true },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Done item' }] }],
              },
              {
                type: 'taskItem',
                attrs: { checked: false },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pending item' }] }],
              },
            ],
          },
        ],
      };
      expect(() => validateTipTapDoc(doc)).not.toThrow();
    });

    it('should accept bulletList, orderedList, listItem, blockquote, codeBlock, hardBreak, horizontalRule', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bullet 1' }] }],
              },
            ],
          },
          {
            type: 'orderedList',
            content: [
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ordered 1' }] }],
              },
            ],
          },
          {
            type: 'blockquote',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A quote' }] }],
          },
          {
            type: 'codeBlock',
            content: [{ type: 'text', text: 'console.log("hi");' }],
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Line 1' },
              { type: 'hardBreak' },
              { type: 'text', text: 'Line 2' },
            ],
          },
          {
            type: 'horizontalRule',
          },
        ],
      };
      expect(() => validateTipTapDoc(doc)).not.toThrow();
    });

    it('should accept all allowed marks: bold, italic, strike, code, link', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
              { type: 'text', text: 'Italic', marks: [{ type: 'italic' }] },
              { type: 'text', text: 'Strike', marks: [{ type: 'strike' }] },
              { type: 'text', text: 'Code', marks: [{ type: 'code' }] },
              {
                type: 'text',
                text: 'Link',
                marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
              },
              {
                type: 'text',
                text: 'Mailto',
                marks: [{ type: 'link', attrs: { href: 'mailto:test@example.com' } }],
              },
            ],
          },
        ],
      };
      expect(() => validateTipTapDoc(doc)).not.toThrow();
    });
  });

  describe('Document Validation: Rejection of Invalid or Malicious Content', () => {
    it('should reject non-object or null root', () => {
      expect(() => validateTipTapDoc(null)).toThrow(/non-null object/i);
      expect(() => validateTipTapDoc('string')).toThrow(/non-null object/i);
      expect(() => validateTipTapDoc([])).toThrow(/non-null object/i);
    });

    it('should reject root with type other than "doc"', () => {
      expect(() => validateTipTapDoc({ type: 'paragraph', content: [] })).toThrow(/must be "doc"/i);
    });

    it('should reject unknown properties on root or node', () => {
      expect(() =>
        validateTipTapDoc({
          type: 'doc',
          content: [],
          customProp: 'malicious',
        })
      ).toThrow(/unknown property/i);

      expect(() =>
        validateTipTapDoc({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [],
              danger: true,
            },
          ],
        })
      ).toThrow(/unknown property/i);
    });

    it('should reject unknown node types', () => {
      expect(() =>
        validateTipTapDoc({
          type: 'doc',
          content: [{ type: 'script', content: [] }],
        })
      ).toThrow(/unknown node type: script/i);

      expect(() =>
        validateTipTapDoc({
          type: 'doc',
          content: [{ type: 'iframe', content: [] }],
        })
      ).toThrow(/unknown node type: iframe/i);
    });

    it('should reject unknown marks', () => {
      expect(() =>
        validateTipTapDoc({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Text',
                  marks: [{ type: 'underline' }],
                },
              ],
            },
          ],
        })
      ).toThrow(/unknown mark: underline/i);
    });

    it('should reject heading with level outside 1-3 or invalid level', () => {
      expect(() =>
        validateTipTapDoc({
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 4 },
              content: [{ type: 'text', text: 'Heading 4' }],
            },
          ],
        })
      ).toThrow(/level must be an integer between 1 and 3/i);

      expect(() =>
        validateTipTapDoc({
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 0 },
              content: [{ type: 'text', text: 'Heading 0' }],
            },
          ],
        })
      ).toThrow(/level must be an integer between 1 and 3/i);
    });

    it('should reject taskItem with missing or non-boolean checked attribute', () => {
      expect(() =>
        validateTipTapDoc({
          type: 'doc',
          content: [
            {
              type: 'taskList',
              content: [
                {
                  type: 'taskItem',
                  attrs: { checked: 'true' }, // string instead of boolean
                },
              ],
            },
          ],
        })
      ).toThrow(/checked must be a boolean/i);
    });

    it('should reject links with javascript:, data:, or vbscript: protocols', () => {
      const maliciousLinks = [
        'javascript:alert(1)',
        'JAVASCRIPT:alert(document.cookie)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox("test")',
        'ftp://files.example.com',
        'file:///etc/passwd',
      ];

      for (const href of maliciousLinks) {
        expect(() =>
          validateTipTapDoc({
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: 'Click here',
                    marks: [{ type: 'link', attrs: { href } }],
                  },
                ],
              },
            ],
          })
        ).toThrow();
      }
    });

    it('should reject links exceeding 2048 characters', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2050);
      expect(() =>
        validateTipTapDoc({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Link',
                  marks: [{ type: 'link', attrs: { href: longUrl } }],
                },
              ],
            },
          ],
        })
      ).toThrow(/exceeds maximum length of 2048/i);
    });

    it('should reject nesting depth greater than 12', () => {
      // Build a deeply nested structure
      let current: any = { type: 'paragraph', content: [{ type: 'text', text: 'Leaf' }] };
      for (let i = 0; i < 12; i++) {
        current = { type: 'blockquote', content: [current] };
      }
      const doc = { type: 'doc', content: [current] }; // Depth > 12

      expect(() => validateTipTapDoc(doc)).toThrow(/depth exceeds 12 levels/i);
    });

    it('should reject documents exceeding 5000 nodes', () => {
      const children: any[] = [];
      for (let i = 0; i < 5001; i++) {
        children.push({ type: 'horizontalRule' });
      }
      const doc = { type: 'doc', content: children };

      expect(() => validateTipTapDoc(doc)).toThrow(/exceeds maximum 5000 nodes/i);
    });

    it('should reject serialized size exceeding 100 KB', () => {
      const largeText = 'x'.repeat(1024 * 105);
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: largeText }],
          },
        ],
      };

      expect(() => validateTipTapDoc(doc)).toThrow(/size exceeds 100 KB/i);
    });
  });

  describe('PlainText Extraction', () => {
    it('should return empty string for null, non-object, or empty doc', () => {
      expect(extractPlainText(null)).toBe('');
      expect(extractPlainText(undefined)).toBe('');
      expect(extractPlainText({})).toBe('');
      expect(extractPlainText({ type: 'doc', content: [] })).toBe('');
    });

    it('should concatenate text nodes with spaces between blocks', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'My Note' }],
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'First paragraph. ' },
              { type: 'text', text: 'More inline text.' },
            ],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Second paragraph.' }],
          },
        ],
      };

      const plain = extractPlainText(doc);
      expect(plain).toBe('My Note First paragraph. More inline text. Second paragraph.');
    });

    it('should extract text from lists, quotes, and taskItems', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] }],
              },
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 2' }] }],
              },
            ],
          },
          {
            type: 'blockquote',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A wise quote' }] }],
          },
        ],
      };

      expect(extractPlainText(doc)).toBe('Item 1 Item 2 A wise quote');
    });

    it('should cap extracted plainText at 20000 characters and trim properly', () => {
      const longText = 'a'.repeat(25000);
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: `   ${longText}   ` }],
          },
        ],
      };

      const result = extractPlainText(doc);
      expect(result.length).toBe(20000);
      expect(result).toBe('a'.repeat(20000));
    });
  });
});
