import {
  Button,
  Disclosure,
  DisclosurePanel,
  DisclosureTrigger,
  useCopy,
} from '@oppenheimer/design-system-web';
import { CheckIcon, CopyIcon, ExternalLink } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';
import { OwnerLinkStep } from '@/features/telegram/components/owner-link-step';
import { ownerLinkByHand } from '@/features/telegram/lib/owner-link';

/**
 * The owner link for someone without the Telegram app, folded under the
 * row: "No Telegram app?" opens two numbered steps, the bot's chat on
 * Telegram Web and the `/start <code>` message to send there, with Copy
 * beside it. The row holds whether it is open, so New link keeps it open.
 * Nothing is drawn for a link that carries no code.
 */
export function OwnerLinkByHand({
  url,
  open,
  onOpenChange,
}: {
  url: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const byHand = ownerLinkByHand(url);
  const { copied, copy } = useCopy(byHand?.message ?? '');
  if (!byHand) return null;
  return (
    <Disclosure
      open={open}
      onOpenChange={onOpenChange}
      data-testid="telegram-owner-link-by-hand"
      className="pr-3 pb-3 pl-5"
    >
      <DisclosureTrigger tone="muted" className="w-fit gap-1.5 text-[12.5px]">
        {t('settings.telegram.answering.noApp')}
      </DisclosureTrigger>
      <DisclosurePanel className="mt-2.5">
        <ol className="flex max-w-140 flex-col gap-3 rounded-sm border border-border-subtle bg-hover-surface p-3.5">
          <OwnerLinkStep n={1} label={t('settings.telegram.answering.stepOpen')}>
            <Button
              size="sm"
              variant="secondary"
              className="w-fit"
              nativeButton={false}
              render={<a href={byHand.webUrl} target="_blank" rel="noopener noreferrer" />}
            >
              <ExternalLink />
              {t('settings.telegram.answering.openWeb')}
            </Button>
          </OwnerLinkStep>
          <OwnerLinkStep n={2} label={t('settings.telegram.answering.stepSend')}>
            <div className="flex items-center gap-2 rounded-sm border border-border-subtle bg-field py-1.25 pr-1.25 pl-3.5">
              <code className="min-w-0 flex-1 truncate font-mono text-xs text-fg">
                {byHand.message}
              </code>
              <Button type="button" variant="secondary" size="sm" onClick={copy}>
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied
                  ? t('settings.telegram.answering.copied')
                  : t('settings.telegram.answering.copy')}
              </Button>
            </div>
          </OwnerLinkStep>
        </ol>
      </DisclosurePanel>
    </Disclosure>
  );
}
