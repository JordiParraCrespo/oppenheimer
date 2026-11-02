import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BrowserMessage } from '../components/browser-message';
import { SessionBrowserPorts } from './session-browser-ports';

/**
 * The preview pane's Browser (`product/versions/mvp/30-session-previews.md`):
 * the ports the session listens on, read under Suspense and polled while the
 * tab is open. This composes the read's other states: while it first answers,
 * the line the empty tab says (the quieter of the two shapes it can take);
 * a first failure, with Try again.
 */
export function SessionBrowser({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <QueryState>
        <QueryState.Pending>
          <BrowserMessage title={t('sessions.preview.lookingForPorts')} busy />
        </QueryState.Pending>
        <QueryState.Error fallback={t('sessions.preview.portsFailed')} className="m-3" />
        <QueryState.Data>
          <SessionBrowserPorts sessionId={sessionId} />
        </QueryState.Data>
      </QueryState>
    </div>
  );
}
