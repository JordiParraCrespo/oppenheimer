'use client';

import { createFileTreeIconResolver, getBuiltInSpriteSheet } from '@pierre/trees';
import * as React from 'react';

import { cn } from '../lib/utils';

/**
 * FileIcon — a file's type mark, from the path: the Go gopher's cyan for
 * `.go`, TypeScript's blue, YAML's red, a neutral page for anything the set
 * does not know. The marks are the published icon set `DiffFileTree` draws
 * (@pierre/trees, its `complete` set): the icon is a `<use>` of the set's
 * own sprite, added to the document once, and its hue is the type's
 * `--file-icon-<type>` token, the map the tree reads too.
 */

const resolver = createFileTreeIconResolver({ set: 'complete', colored: true });
const SPRITE_ID = 'op-file-icon-sprite';

/** Adds the set's sprite to the document once, so every icon can reference its symbols. */
function useSprite() {
  React.useEffect(() => {
    // The document body: the sprite the <use> elements below point into.
    if (document.getElementById(SPRITE_ID)) return;
    // The HTML parser puts the set's markup in the SVG namespace, as it would inline.
    const sprite = new DOMParser().parseFromString(getBuiltInSpriteSheet('complete'), 'text/html').body.firstElementChild;
    if (!sprite) return;
    sprite.id = SPRITE_ID;
    sprite.setAttribute('aria-hidden', 'true');
    sprite.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
    document.body.append(document.adoptNode(sprite));
  }, []);
}

function FileIcon({ path, className, ...props }: Omit<React.ComponentProps<'svg'>, 'children'> & { path: string }) {
  useSprite();
  const icon = resolver.resolveIcon('file-tree-icon-file', path);
  const token = icon.token ?? 'default';
  return (
    <svg
      aria-hidden
      data-slot="file-icon"
      data-token={token}
      fill="currentColor"
      className={cn('size-4 shrink-0', className)}
      // biome-ignore lint/style/noInlineStyles: the hue is the file's type, read from its token.
      style={{ color: `var(--file-icon-${token}, var(--file-icon-default))` }}
      {...props}
    >
      <use href={`#${icon.name}`} />
    </svg>
  );
}

export { FileIcon };
