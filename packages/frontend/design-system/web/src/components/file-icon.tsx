import { createFileTreeIconResolver, getBuiltInSpriteSheet } from '@pierre/trees';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * FileIcon — a file's type mark, from the path: the Go gopher's cyan for
 * `.go`, TypeScript's blue, YAML's red, a neutral page for anything the set
 * does not know. The marks are the published icon set `DiffFileTree` draws
 * (@pierre/trees, its `complete` set), so a diff's header and its tree show
 * the same mark; each wears its hue from the `--file-icon-*` tokens.
 */

const resolver = createFileTreeIconResolver({ set: 'complete', colored: true });

/** The sprite's symbols by id, parsed once: `{ viewBox, body }`. */
let symbols: Map<string, { viewBox: string; body: string }> | null = null;
function symbolOf(id: string) {
  if (!symbols) {
    symbols = new Map();
    const sprite = getBuiltInSpriteSheet('complete');
    for (const match of sprite.matchAll(/<symbol id="([^"]+)" viewBox="([^"]+)">([\s\S]*?)<\/symbol>/g)) {
      const [, symbolId, viewBox, body] = match;
      if (symbolId && viewBox && body) symbols.set(symbolId, { viewBox, body });
    }
  }
  return symbols.get(id);
}

/** The set's token for each hue it colours with; anything unlisted is gray. */
const HUE: Record<string, string> = {
  astro: 'purple',
  babel: 'yellow',
  bash: 'green',
  biome: 'blue',
  bootstrap: 'indigo',
  browserslist: 'yellow',
  bun: 'mauve',
  c: 'blue',
  cpp: 'blue',
  claude: 'orange',
  css: 'indigo',
  database: 'purple',
  docker: 'blue',
  eslint: 'indigo',
  go: 'cyan',
  graphql: 'pink',
  html: 'orange',
  image: 'pink',
  javascript: 'yellow',
  json: 'orange',
  markdown: 'green',
  mcp: 'teal',
  npm: 'red',
  postcss: 'red',
  prettier: 'teal',
  python: 'blue',
  react: 'cyan',
  ruby: 'red',
  rust: 'orange',
  sass: 'pink',
  svelte: 'red',
  svg: 'orange',
  svgo: 'green',
  swift: 'orange',
  table: 'teal',
  tailwind: 'cyan',
  terraform: 'indigo',
  typescript: 'blue',
  vite: 'purple',
  vscode: 'blue',
  vue: 'green',
  wasm: 'indigo',
  webpack: 'blue',
  yml: 'red',
  zig: 'orange',
  zip: 'orange',
};

function FileIcon({ path, className, ...props }: Omit<React.ComponentProps<'svg'>, 'children'> & { path: string }) {
  const icon = resolver.resolveIcon('file-tree-icon-file', path);
  const symbol = symbolOf(icon.name) ?? symbolOf('file-tree-builtin-default');
  const token = icon.token ?? 'default';
  return (
    <svg
      aria-hidden
      data-slot="file-icon"
      data-token={token}
      viewBox={symbol?.viewBox ?? '0 0 16 16'}
      fill="currentColor"
      className={cn('size-4 shrink-0', className)}
      // biome-ignore lint/style/noInlineStyles: the hue is the file's type, data from the path.
      style={{ color: `var(--file-icon-${HUE[token] ?? 'gray'})` }}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: the body is the icon set's own static sprite, not input.
      dangerouslySetInnerHTML={{ __html: symbol?.body ?? '' }}
      {...props}
    />
  );
}

export { FileIcon };
