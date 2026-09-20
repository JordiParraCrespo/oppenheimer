import {
  Button,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  Input,
  SlugInput,
  StepHeader,
} from '@oppenheimer/design-system-web';
import { AuthLink } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAddressCheck } from '@/features/organizations/hooks/use-address-check';
import { slugify } from '@/features/organizations/lib/slugify';

/** The address prefix the artboard shows; the deployment's own comes with wiring. */
const ADDRESS_PREFIX = 'oppenheimer.dev/';
/** The signed-in address, fixed until this screen reads the session. */
const ACCOUNT_EMAIL = 'jordiparra99@gmail.com';

/**
 * Onboarding step 2: name the workspace and pick its permanent address. The
 * address follows the name until the reader edits it by hand, and is checked
 * for availability as they type. Continue waits for an available address.
 *
 * Scaffold: local state only. Nothing is saved and the check is simulated.
 */
export function OnboardingWorkspaceScreen() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [addressEdited, setAddressEdited] = useState(false);
  const status = useAddressCheck(address);

  const full = `${ADDRESS_PREFIX}${address}`;

  return (
    <div className="flex flex-col gap-5">
      <StepHeader
        step={2}
        total={4}
        back={{ render: <Link to="/login" /> }}
        backLabel={t('onboarding.flow.back')}
        title={t('onboarding.flow.workspace.title')}
      >
        {t('onboarding.flow.workspace.description')}
      </StepHeader>

      <FieldGroup className="gap-3.5">
        <Field>
          <FieldLabel htmlFor="ws-name">{t('onboarding.flow.workspace.name')}</FieldLabel>
          <Input
            id="ws-name"
            size="lg"
            value={name}
            placeholder={t('onboarding.flow.workspace.namePlaceholder')}
            onChange={(event) => {
              setName(event.target.value);
              if (!addressEdited) setAddress(slugify(event.target.value));
            }}
          />
        </Field>
        <Field data-invalid={status === 'taken' || undefined}>
          <FieldLabel htmlFor="ws-slug">{t('onboarding.flow.workspace.address')}</FieldLabel>
          <SlugInput
            id="ws-slug"
            size="lg"
            prefix={ADDRESS_PREFIX}
            placeholder={t('onboarding.flow.workspace.addressPlaceholder')}
            value={address}
            status={status}
            onChange={(event) => {
              setAddressEdited(true);
              setAddress(slugify(event.target.value));
            }}
          />
          {status === 'ok' ? (
            <FieldDescription tone="success">
              {t('onboarding.flow.workspace.available', { address: full })}
            </FieldDescription>
          ) : status === 'taken' ? (
            <FieldDescription tone="danger">
              {t('onboarding.flow.workspace.taken', { address: full })}
            </FieldDescription>
          ) : status === 'checking' ? (
            <FieldDescription>{t('onboarding.flow.workspace.checking')}</FieldDescription>
          ) : (
            <FieldDescription>{t('onboarding.flow.workspace.hint')}</FieldDescription>
          )}
        </Field>
      </FieldGroup>

      <Button size="lg" block disabled={status !== 'ok'} render={<Link to="/onboarding/github" />}>
        {t('onboarding.flow.continue')}
      </Button>

      <div className="flex flex-col items-center gap-1 text-sm text-fg-muted">
        <span>{t('onboarding.flow.workspace.using', { email: ACCOUNT_EMAIL })}</span>
        <AuthLink to="/login">{t('onboarding.flow.workspace.differentAccount')}</AuthLink>
      </div>
    </div>
  );
}
