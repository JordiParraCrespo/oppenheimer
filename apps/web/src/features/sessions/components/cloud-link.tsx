import { IconButton, useCopy } from '@oppenheimer/design-system-web';
import { Check, Copy } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * A cloud session's address on claude.ai/code, written out as a link with an
 * icon button that copies it, as the teleport command below it is copied.
 * The button's name is the action and turns to Copied for a moment.
 */
export function CloudLink({ url }: { url: string }) {
  const { t } = useTranslation();
  const { copied, copy } = useCopy(url);
  const label = t(copied ? 'sessions.cloud.copied' : 'sessions.cloud.copyLink');

  return (
    <div className="mt-1 flex min-w-0 items-center gap-1">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="figures min-w-0 truncate text-sm text-link hover:underline"
      >
        {url.replace(/^https:\/\//, '')}
      </a>
      <IconButton
        size="xs"
        aria-label={label}
        title={label}
        aria-live="polite"
        onClick={copy}
        className="shrink-0"
      >
        {copied ? <Check strokeWidth={2.2} /> : <Copy />}
      </IconButton>
    </div>
  );
}
