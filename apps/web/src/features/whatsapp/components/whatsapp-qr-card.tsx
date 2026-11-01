import { Skeleton } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { WhatsappQrCode } from '@/features/whatsapp/components/whatsapp-qr-code';

/**
 * Pairing a number: the code to scan beside how to scan it. Before the host
 * has issued a code (or while the encoder loads), the same card with the
 * code's frame empty and a line saying what it waits for.
 */
export function WhatsappQrCard({ modules }: { modules: readonly (readonly boolean[])[] | null }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex flex-col items-start gap-5 px-5 pt-1 pb-5 sm:flex-row"
      data-testid="whatsapp-qr"
    >
      {modules ? (
        <WhatsappQrCode modules={modules} label={t('settings.whatsapp.qrAlt')} />
      ) : (
        <Skeleton shape="sm" className="size-56 shrink-0" />
      )}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-fg">{t('settings.whatsapp.qrTitle')}</p>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-fg-muted">
          <li>{t('settings.whatsapp.qrStep1')}</li>
          <li>{t('settings.whatsapp.qrStep2')}</li>
          <li>{t('settings.whatsapp.qrStep3')}</li>
        </ol>
        {modules ? null : (
          <p className="text-sm text-fg-subtle">{t('settings.whatsapp.qrWaiting')}</p>
        )}
      </div>
    </div>
  );
}
