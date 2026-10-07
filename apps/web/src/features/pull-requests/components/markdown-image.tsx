import { useState } from 'react';

/**
 * An image in a description, at an address already made safe. One that does
 * not load (a private attachment, a dead link) becomes a link to it, so the
 * reader still has a way there.
 */
export function MarkdownImage({ href, alt }: { href: string; alt: string }) {
  const [failed, setFailed] = useState(false);
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
