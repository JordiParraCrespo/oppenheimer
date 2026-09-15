import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { LegalPage, LegalSection } from '@/components/public/public-site-layout';

export const Route = createFileRoute('/privacy')({ component: PrivacyPage });

function PrivacyPage() {
  const { t } = useTranslation();

  return (
    <LegalPage
      eyebrow={t('public.privacy.eyebrow')}
      title={t('public.privacy.title')}
      summary={t('public.privacy.summary')}
    >
      <LegalSection title={t('public.privacy.controller.title')}>
        <p>{t('public.privacy.controller.body')}</p>
        <p>{t('public.privacy.contactLabel')}</p>
      </LegalSection>

      <LegalSection title={t('public.privacy.data.title')}>
        <p>{t('public.privacy.data.intro')}</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>{t('public.privacy.data.account')}</li>
          <li>{t('public.privacy.data.workspace')}</li>
          <li>{t('public.privacy.data.content')}</li>
          <li>{t('public.privacy.data.integrations')}</li>
          <li>{t('public.privacy.data.technical')}</li>
        </ul>
      </LegalSection>

      <LegalSection title={t('public.privacy.google.title')}>
        <p>{t('public.privacy.google.body')}</p>
        <p>{t('public.privacy.google.separateConsent')}</p>
      </LegalSection>

      <LegalSection title={t('public.privacy.purposes.title')}>
        <p>{t('public.privacy.purposes.body')}</p>
      </LegalSection>

      <LegalSection title={t('public.privacy.sharing.title')}>
        <p>{t('public.privacy.sharing.body')}</p>
      </LegalSection>

      <LegalSection title={t('public.privacy.retention.title')}>
        <p>{t('public.privacy.retention.body')}</p>
      </LegalSection>

      <LegalSection title={t('public.privacy.cookies.title')}>
        <p>{t('public.privacy.cookies.body')}</p>
      </LegalSection>

      <LegalSection title={t('public.privacy.security.title')}>
        <p>{t('public.privacy.security.body')}</p>
      </LegalSection>

      <LegalSection title={t('public.privacy.rights.title')}>
        <p>{t('public.privacy.rights.body')}</p>
        <p>{t('public.privacy.rights.authority')}</p>
      </LegalSection>

      <LegalSection title={t('public.privacy.children.title')}>
        <p>{t('public.privacy.children.body')}</p>
      </LegalSection>

      <LegalSection title={t('public.privacy.changes.title')}>
        <p>{t('public.privacy.changes.body')}</p>
        <p>{t('public.privacy.lastUpdated')}</p>
      </LegalSection>
    </LegalPage>
  );
}
