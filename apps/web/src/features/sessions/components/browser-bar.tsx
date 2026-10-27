import { ChipSelect, IconButton } from '@oppenheimer/design-system-web';
import { ExternalLinkIcon, GlobeIcon, RotateCwIcon } from '@oppenheimer/design-system-web/icons';
import type { SessionPort } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';

/**
 * The Browser tab's address bar (`SessionsConsole.dc.html`): which of the
 * session's ports the page is, as `localhost:<port>` with the command on it,
 * then Reload and Open in a new tab.
 */
export function BrowserBar({
  ports,
  port,
  onPort,
  onReload,
  onOpenTab,
  openingTab,
}: {
  ports: SessionPort[];
  port: number;
  onPort: (port: number) => void;
  onReload: () => void;
  onOpenTab: () => void;
  openingTab: boolean;
}) {
  const { t } = useTranslation();
  const options = ports.map((one) => ({
    value: String(one.port),
    label: t('sessions.preview.address', { port: one.port }),
    ...(one.process ? { description: one.process } : {}),
  }));

  return (
    <div className="flex min-h-9 items-center gap-1 border-b border-border-subtle px-2 py-1">
      <ChipSelect
        value={String(port)}
        onValueChange={(value) => onPort(Number(value))}
        options={options}
        icon={<GlobeIcon />}
        aria-label={t('sessions.preview.port')}
        searchPlaceholder={t('sessions.preview.portSearch')}
        emptyText={t('sessions.preview.portEmpty')}
      />
      <span className="flex-1" />
      <IconButton
        size="sm"
        aria-label={t('sessions.preview.reload')}
        title={t('sessions.preview.reload')}
        onClick={onReload}
      >
        <RotateCwIcon />
      </IconButton>
      <IconButton
        size="sm"
        aria-label={t('sessions.preview.openTab')}
        title={t('sessions.preview.openTab')}
        onClick={onOpenTab}
        disabled={openingTab}
      >
        <ExternalLinkIcon />
      </IconButton>
    </div>
  );
}
