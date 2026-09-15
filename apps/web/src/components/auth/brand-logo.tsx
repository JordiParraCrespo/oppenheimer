import { cn } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { BrandGlyph } from '@/components/brand-glyph';

/** Mark plus wordmark, as it sits in the top-left of every auth screen. */
export function BrandLogo({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <BrandGlyph />
      <span className="text-base font-medium text-ink-900">{t('common.appName')}</span>
    </div>
  );
}
