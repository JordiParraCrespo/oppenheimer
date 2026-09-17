import { Wordmark } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/** The wordmark with the product suffix, as it sits top-left of every auth screen. */
export function BrandLogo({ className, product }: { className?: string; product?: string }) {
  const { t } = useTranslation();

  return <Wordmark className={className} product={product ?? t('common.product')} />;
}
