import { Wordmark } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/** The wordmark with the product suffix, as it sits top-left of every auth screen. */
export function BrandLogo({ className }: { className?: string }) {
  const { t } = useTranslation();

  return <Wordmark className={className} product={t('common.product')} />;
}
