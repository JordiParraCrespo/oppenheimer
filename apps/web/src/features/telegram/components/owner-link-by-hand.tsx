import { Button, useCopy } from '@oppenheimer/design-system-web';
import { CheckIcon, CopyIcon, ExternalLink } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';
import { ownerLinkByHand } from '@/features/telegram/lib/owner-link';

/**
 * The owner link for someone without the Telegram app: the bot's chat on
 * Telegram Web, and the `/start <code>` message to send there, with Copy
 * beside it. Nothing is drawn for a link that carries no code.
 */
export function OwnerLinkByHand({ url }: { url: string }) {
  const { t } = useTranslation();
  const byHand = ownerLinkByHand(url);
  const { copied, copy } = useCopy(byHand?.message ?? '');
  if (!byHand) return null;
  return (
    <div data-testid="telegram-owner-link-by-hand" className="flex flex-col gap-2 pr-3 pb-3 pl-5">
      <span className="text-[12px] text-fg-subtle">
        {t('settings.telegram.answering.byHand')}{' '}
        <a
          href={byHand.webUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-fg-muted underline underline-offset-2 hover:text-fg"
        >
          {t('settings.telegram.answering.openWeb')}
          <ExternalLink className="size-3" />
        </a>
      </span>
      <div className="flex max-w-140 items-center gap-2 rounded-sm border border-border-subtle bg-field py-1.25 pr-1.25 pl-3.5">
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-fg">{byHand.message}</code>
        <Button type="button" variant="secondary" size="sm" onClick={copy}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? t('settings.telegram.answering.copied') : t('settings.telegram.answering.copy')}
        </Button>
      </div>
    </div>
  );
}
