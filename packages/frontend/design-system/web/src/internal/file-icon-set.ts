import type { FileTreeIconConfig, RemappedIcon } from '@pierre/trees';

/**
 * The file-type marks `FileIcon` and `DiffFileTree` draw: @pierre/trees'
 * `complete` set, with the one mark it gets wrong replaced. The set draws
 * HTML as a `#`, which reads as CSS; here it is `</>` on the set's own
 * rounded tile. The replacement keeps the `html` token, so it still takes
 * `--file-icon-html` (the tree reads the token off the resolved icon).
 */

const HTML_ICON = 'op-file-icon-html';

const SPRITE = `<svg xmlns="http://www.w3.org/2000/svg"><symbol id="${HTML_ICON}" viewBox="0 0 16 16"><path fill="currentColor" d="M8 1C2.24 1 1 2.24 1 8s1.24 7 7 7 7-1.24 7-7-1.24-7-7-7" opacity=".2"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.25" d="M5.75 5.25 3.25 8l2.5 2.75m4.5-5.5L12.75 8l-2.5 2.75M8.9 4.5l-1.8 7"/></symbol></svg>`;

const html = { name: HTML_ICON, token: 'html' } as RemappedIcon;

const FILE_ICON_SET = {
  set: 'complete',
  colored: true,
  spriteSheet: SPRITE,
  byFileExtension: { html, htm: html },
} satisfies FileTreeIconConfig;

export { FILE_ICON_SET };
