import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import DatabaseNodeView from './DatabaseNodeView';

export const DatabaseBlock = Node.create({
  name: 'databaseBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      databaseId: {
        default: null,
        parseHTML: element => element.getAttribute('data-database-id'),
        renderHTML: attributes => ({ 'data-database-id': attributes.databaseId }),
      },
      title: {
        default: 'Untitled Database',
        parseHTML: element => element.getAttribute('data-title'),
        renderHTML: attributes => ({ 'data-title': attributes.title }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-database-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DatabaseNodeView);
  },
});
