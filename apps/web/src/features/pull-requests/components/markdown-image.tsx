import { useState } from 'react';
import { safeHref } from '../lib/markdown';

/**
 * An image in a description. One that does not load (a private attachment,
 * a dead link) becomes a link to it, so the reader still has a way there.
 */
export function MarkdownImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const href = safeHref(src);
  if (!href) return alt || null;
  if (failed)
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {alt || href}
      </a>
    );
  return (
    <img
      src={href}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
