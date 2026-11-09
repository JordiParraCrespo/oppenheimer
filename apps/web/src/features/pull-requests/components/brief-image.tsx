import { useState } from 'react';

/**
 * One of the description's pictures on a card: a thumbnail at the strip's
 * height that opens the picture itself. One that does not load (a private
 * attachment GitHub will not serve here, a dead link) is not drawn, since a
 * broken frame says nothing a reviewer can use. It draws its own list item,
 * so a strip whose pictures all failed is empty and takes no room.
 */
export function BriefImage({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <li className="shrink-0">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="block overflow-hidden rounded-lg border border-border-subtle bg-control"
      >
        <img
          src={url}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="block h-56 w-auto max-w-none"
        />
      </a>
    </li>
  );
}
