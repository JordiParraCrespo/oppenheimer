import { BotIcon, UserIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Who opened something: a session's bot glyph or a person's, then the name.
 * One mark for a pull request's row and its header.
 */
function AuthorMark({
  kind,
  className,
  children,
}: {
  kind: 'session' | 'person';
  className?: string;
  children: React.ReactNode;
}) {
  const Glyph = kind === 'session' ? BotIcon : UserIcon;
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <Glyph className="size-3 shrink-0 text-fg-subtle" aria-hidden />
      <span className="truncate">{children}</span>
    </span>
  );
}

export { AuthorMark };
