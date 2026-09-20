import { Button, Card, StepHeader, Link as TextLink } from '@oppenheimer/design-system-web';
import { Check } from '@oppenheimer/design-system-web/icons';
import { AuthLink } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/** The installation the scaffold pretends GitHub returned. */
const INSTALLATION = { owner: 'JordiParraCrespo', repositories: 12 };

/**
 * Onboarding step 3: install the GitHub App. One primary button that, once
 * the installation exists, becomes a card naming the account and how many
 * repositories it covers, with Continue below. Skippable: the repo chip stays
 * empty until it is done.
 *
 * Scaffold: pressing Connect flips the local state; there is no round trip.
 */
export function OnboardingGithubScreen() {
  const { t } = useTranslation();
  const [connected, setConnected] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <StepHeader
        step={3}
        total={4}
        back={{ render: <Link to="/onboarding/workspace" /> }}
        backLabel={t('onboarding.flow.back')}
        title={t('onboarding.flow.github.title')}
      >
        {t('onboarding.flow.github.description')}
      </StepHeader>

      {connected ? (
        <div className="flex flex-col gap-5">
          <Card className="flex-row items-center gap-3 px-[18px] py-4">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-pill bg-success text-white">
              <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="figures text-[13px] text-fg">{INSTALLATION.owner}</span>
              <span className="text-xs text-fg-muted">
                {t('onboarding.flow.github.connected', { count: INSTALLATION.repositories })}
              </span>
            </span>
          </Card>
          <Button size="lg" block render={<Link to="/onboarding/host" />}>
            {t('onboarding.flow.continue')}
          </Button>
          <TextLink
            className="self-start text-sm"
            render={<button type="button" onClick={() => setConnected(false)} />}
          >
            {t('onboarding.flow.github.change')}
          </TextLink>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          <Button size="lg" block onClick={() => setConnected(true)}>
            {t('onboarding.flow.github.connect')}
          </Button>
          <div className="flex flex-col items-start gap-1.5">
            <AuthLink to="/onboarding/host">{t('onboarding.flow.github.skip')}</AuthLink>
            <p className="text-xs leading-normal text-fg-subtle">
              {t('onboarding.flow.github.skipNote')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
