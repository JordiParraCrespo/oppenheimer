import { useTranslation } from 'react-i18next';
import { LegalPage, LegalSection } from '@/features/public/sections/public-site-layout';

export function TermsScreen() {
  const { t } = useTranslation();

  const sections = [
    'service',
    'accounts',
    'acceptableUse',
    'content',
    'thirdParties',
    'availability',
    'intellectualProperty',
    'termination',
    'liability',
    'law',
    'changes',
  ] as const;

  return (
    <LegalPage
      eyebrow={t('public.terms.eyebrow')}
      title={t('public.terms.title')}
      summary={t('public.terms.summary')}
    >
      {sections.map((section) => (
        <LegalSection key={section} title={t(`public.terms.${section}.title`)}>
          <p>{t(`public.terms.${section}.body`)}</p>
        </LegalSection>
      ))}

      <LegalSection title={t('public.terms.contact.title')}>
        <p>{t('public.terms.contact.body')}</p>
        <p>{t('public.terms.lastUpdated')}</p>
      </LegalSection>
    </LegalPage>
  );
}
