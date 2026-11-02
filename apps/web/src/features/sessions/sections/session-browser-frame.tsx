import { useSuspenseSessionPreview } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';

/**
 * The page: the session's port on its own preview origin, framed. The URL
 * carries a ticket the origin spends on arrival and keeps the reader in a
 * cookie of its own; from there the app's links, reloads and hot reload stay
 * inside the frame. The origin is never the console's, so the app cannot
 * reach the console from in here, and `sandbox` keeps it from navigating it.
 */
export function SessionBrowserFrame({
  sessionId,
  port,
  opened,
}: {
  sessionId: string;
  port: number;
  opened: number;
}) {
  const { t } = useTranslation();
  // A refetch that fails is not drawn here: this read never refetches, its
  // ticket is spent once; Reload asks again under a new key.
  const { data } = useSuspenseSessionPreview(sessionId, port, opened);

  return (
    <iframe
      key={data.url}
      src={data.url}
      title={t('sessions.preview.browserFrame', { port })}
      className="min-h-0 w-full flex-1 border-0 bg-white"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
      allow="clipboard-read; clipboard-write; fullscreen"
    />
  );
}
