import { IconButton, PillTab, PillTabs } from '@oppenheimer/design-system-web';
import { GlobeIcon, SmartphoneIcon, XIcon } from '@oppenheimer/design-system-web/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type PreviewTab, rememberPreviewTab, storedPreviewTab } from '../lib/preview-open';
import { SessionBrowser } from './session-browser';
import { SessionDevice } from './session-device';

/**
 * The preview pane beside a session (`SessionsConsole.dc.html`): the design's
 * pill tabs, Browser and Simulator, over what the chosen one shows, and
 * Close. Browser is the session's dev server through its host's runner
 * (`product/versions/mvp/30-session-previews.md`); Simulator its device, the
 * one its agent drives through Argent. Each tab opens its own connection only
 * while it is the one shown. `offered` is what this console and deployment
 * can show, never empty.
 */
export function SessionPreview({
  sessionId,
  offered,
  onClose,
}: {
  sessionId: string;
  offered: readonly PreviewTab[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [chosen, setChosen] = useState(() => storedPreviewTab(offered));
  const shown = chosen && offered.includes(chosen) ? chosen : offered[0];
  const choose = (tab: string) => {
    const next = offered.find((one) => one === tab);
    if (!next) return;
    setChosen(next);
    rememberPreviewTab(next);
  };

  return (
    <aside
      aria-label={t('sessions.preview.label')}
      className="flex w-110 min-w-90 shrink-0 flex-col border-l border-border-subtle bg-card"
    >
      <header className="flex min-h-11.5 items-center gap-2 border-b border-border-subtle p-2">
        <PillTabs
          value={shown ?? ''}
          onValueChange={choose}
          size="sm"
          aria-label={t('sessions.preview.label')}
        >
          {offered.includes('browser') ? (
            <PillTab value="browser">
              <GlobeIcon className="size-3.5" />
              {t('sessions.preview.browser')}
            </PillTab>
          ) : null}
          {offered.includes('simulator') ? (
            <PillTab value="simulator">
              <SmartphoneIcon className="size-3.5" />
              {t('sessions.preview.simulator')}
            </PillTab>
          ) : null}
        </PillTabs>
        <span className="flex-1" />
        <IconButton size="sm" aria-label={t('sessions.preview.close')} onClick={onClose}>
          <XIcon />
        </IconButton>
      </header>
      {shown === 'browser' ? <SessionBrowser sessionId={sessionId} /> : null}
      {shown === 'simulator' ? <SessionDevice sessionId={sessionId} /> : null}
    </aside>
  );
}
