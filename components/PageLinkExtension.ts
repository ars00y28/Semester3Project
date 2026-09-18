import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import PageLinkView from './PageLinkView';

export const PageLink = Node.create({
  name: 'pageLink',
  group: 'inline',
  inline: true,
  selectable: true,
  atom: true,

  addAttributes() {
    return {
      pageId: {
        default: null,
        parseHTML: element => element.getAttribute('data-page-id'),
        renderHTML: attributes => ({ 'data-page-id': attributes.pageId }),
      },
      title: {
        default: 'Untitled',
        parseHTML: element => element.getAttribute('data-page-title') || element.textContent || 'Untitled',
        renderHTML: attributes => ({ 'data-page-title': attributes.title }),
      },
      pageType: {
        default: 'DOCUMENT',
        parseHTML: element => element.getAttribute('data-page-type') || 'DOCUMENT',
        renderHTML: attributes => ({ 'data-page-type': attributes.pageType }),
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'button[data-page-id]' },
      { tag: 'span[data-page-id]' },
      { tag: 'a[data-page-id]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const icon = HTMLAttributes['data-page-type'] === 'DATABASE' ? '🗄️' : '📄';
    const title = HTMLAttributes['data-page-title'] || 'Untitled';
    return [
      'button',
      mergeAttributes(HTMLAttributes, {
        type: 'button',
        'data-page-id': HTMLAttributes['data-page-id'],
        class: 'inline-flex items-center gap-1.5 px-2.5 py-0.5 my-0.5 mx-1 rounded-md bg-slate-100 hover:bg-blue-50 text-slate-800 hover:text-blue-700 font-medium text-sm border border-slate-200 hover:border-blue-300 no-underline cursor-pointer transition-colors select-none align-baseline',
      }),
      `${icon} ${title}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageLinkView);
  },
});
