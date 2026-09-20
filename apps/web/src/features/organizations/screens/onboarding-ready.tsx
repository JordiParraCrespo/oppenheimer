import {
  Button,
  StepHeader,
  SuccessMark,
  SummaryCard,
  SummaryRow,
} from '@oppenheimer/design-system-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/** What the previous steps would have produced; fixed until they are wired. */
const SUMMARY = {
  workspace: 'Versio Platform',
  address: 'oppenheimer.dev/versio',
  owner: 'JordiParraCrespo',
  repositories: 12,
  host: 'mac-studio · macOS 15',
};

/**
 * The landing after onboarding: a success ring, the three facts the steps
 * produced, one button into the console.
 */
export function OnboardingReadyScreen() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3.5">
        <SuccessMark />
        <StepHeader title={t('onboarding.flow.ready.title')}>
          {t('onboarding.flow.ready.description', { workspace: SUMMARY.workspace })}
        </StepHeader>
      </div>

      <SummaryCard>
        <SummaryRow label={t('onboarding.flow.ready.workspace')}>{SUMMARY.address}</SummaryRow>
        <SummaryRow label={t('onboarding.flow.ready.code')}>
          {t('onboarding.flow.ready.repos', { owner: SUMMARY.owner, count: SUMMARY.repositories })}
        </SummaryRow>
        <SummaryRow label={t('onboarding.flow.ready.host')}>{SUMMARY.host}</SummaryRow>
      </SummaryCard>

      <Button size="lg" block render={<Link to="/sessions" />}>
        {t('onboarding.flow.ready.go')}
      </Button>
    </div>
  );
}
