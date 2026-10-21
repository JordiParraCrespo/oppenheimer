import { useEffect, useState } from 'react';

/**
 * A URL an `img` can show `blob` from, while the caller is mounted: the
 * outside system is the browser's object-URL table, which keeps the bytes
 * alive until the URL is revoked. Undefined until the blob is there.
 */
export function useObjectUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<{ blob: Blob; url: string } | undefined>();
  useEffect(() => {
    if (!blob) return;
    const created = URL.createObjectURL(blob);
    setUrl({ blob, url: created });
    return () => URL.revokeObjectURL(created);
  }, [blob]);
  return url && url.blob === blob ? url.url : undefined;
}
