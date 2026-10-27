import {
  useOpenSessionPreviewTab,
  useSuspenseSessionPorts,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, QueryState } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserBar } from '../components/browser-bar';
import { BrowserMessage } from '../components/browser-message';
import { previewPort } from '../lib/preview-port';
import { SessionBrowserFrame } from './session-browser-frame';

/**
 * The Browser tab once the session's ports have answered: what to say when
 * there is no page (the host away, a runner that cannot share ports, no dev
 * server yet), else the address bar and the page. It subscribes because it
 * draws the ports; the poll brings a dev server the agent just started.
 *
 * The port shown is the one the reader picked while it is still listened on,
 * else the likeliest front end (`previewPort`). Reload asks for the page
 * again (a new ticket, so a new frame); Open in a new tab asks for a URL of
 * its own, into a tab opened in the click so no popup blocker stands in the
 * way.
 */
export function SessionBrowserPorts({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation();
  const { data, error } = useSuspenseSessionPorts(sessionId);
  const [chosen, setChosen] = useState<number | null>(null);
  const [opened, setOpened] = useState(0);
  const openTab = useOpenSessionPreviewTab();

  if (data.state === 'host_offline') {
    return (
      <BrowserMessage
        title={t('sessions.preview.hostOffline')}
        detail={t('sessions.preview.hostOfflineDetail')}
      />
    );
  }
  if (data.state === 'not_supported') {
    return (
      <BrowserMessage
        title={t('sessions.preview.notSupported')}
        detail={t('sessions.preview.notSupportedDetail')}
      />
    );
  }
  const port = previewPort(data.ports, chosen);

  const onOpenTab = () => {
    if (port === undefined) return;
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    openTab.mutate(
      { sessionId, port },
      {
        onSuccess: (preview) => {
          if (tab) tab.location.href = preview.url;
        },
        onError: () => tab?.close(),
      },
    );
  };

  return (
    <>
      <ErrorAlert error={error} fallback={t('sessions.preview.portsFailed')} className="m-3" />
      <ErrorAlert
        error={openTab.error}
        fallback={t('sessions.preview.previewFailed')}
        onDismiss={() => openTab.reset()}
        className="m-3"
      />
      {port === undefined ? (
        <BrowserMessage
          title={t('sessions.preview.waiting')}
          detail={t('sessions.preview.waitingDetail')}
        />
      ) : (
        <>
          <BrowserBar
            ports={data.ports}
            port={port}
            onPort={setChosen}
            onReload={() => setOpened((n) => n + 1)}
            onOpenTab={onOpenTab}
            openingTab={openTab.isPending}
          />
          <QueryState key={`${port}:${opened}`}>
            <QueryState.Pending>
              <BrowserMessage title={t('sessions.preview.opening', { port })} busy />
            </QueryState.Pending>
            <QueryState.Error fallback={t('sessions.preview.previewFailed')} className="m-3" />
            <QueryState.Data>
              <SessionBrowserFrame sessionId={sessionId} port={port} opened={opened} />
            </QueryState.Data>
          </QueryState>
        </>
      )}
    </>
  );
}
