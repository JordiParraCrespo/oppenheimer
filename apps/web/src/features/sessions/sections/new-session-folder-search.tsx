import { useSearchFolder } from '../hooks/use-search-folder';

/**
 * Draws nothing: it holds the one read of the host's home that an address
 * under `~` needs, so the folder chip does not re-render as it settles, and is
 * mounted only while there is a host to ask.
 */
export function NewSessionFolderSearch({
  hostId,
  path,
  onResolved,
}: {
  hostId: string;
  path: string;
  onResolved: (path: string, home: string) => void;
}) {
  useSearchFolder(hostId, path, onResolved);
  return null;
}
