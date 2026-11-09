import { useEffect, useState } from 'react';

/**
 * URLs an `img` can show each of `blobs` from, while the caller is mounted,
 * in order: the outside system is the browser's object-URL table, which
 * keeps the bytes alive until the URL is revoked. Undefined for a blob not
 * there yet. `blobs` keeps its identity while none of them changes.
 */
export function useObjectUrls(blobs: readonly (Blob | undefined)[]): (string | undefined)[] {
  const [urls, setUrls] = useState<ReadonlyMap<Blob, string>>(new Map());
  useEffect(() => {
    const created = new Map<Blob, string>();
    for (const blob of blobs) if (blob) created.set(blob, URL.createObjectURL(blob));
    setUrls(created);
    return () => {
      for (const url of created.values()) URL.revokeObjectURL(url);
    };
  }, [blobs]);
  return blobs.map((blob) => (blob ? urls.get(blob) : undefined));
}
