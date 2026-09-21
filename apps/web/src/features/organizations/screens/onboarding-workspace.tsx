import {
  Alert,
  AlertDescription,
  Button,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  Input,
  SlugInput,
  StepHeader,
} from '@oppenheimer/design-system-web';
import {
  useCreateOrganization,
  useOrganizations,
  useUpdateOrganization,
} from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage, useProfile } from '@oppenheimer/frontend-core/react';
import { AuthLink } from '@oppenheimer/frontend-web';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAddressCheck } from '@/features/organizations/hooks/use-address-check';
import { slugify } from '@/features/organizations/lib/slugify';

/** The address prefix the artboard shows; the deployment's own comes with wiring. */
const ADDRESS_PREFIX = 'oppenheimer.dev/';

/**
 * Onboarding step 2: name the workspace and pick its permanent address. The
 * address follows the name until the reader edits it by hand, and is checked
 * against `POST /organizations/check-slug` as they type. Continue waits for an
 * available address, then writes it before moving on — the address is only
 * really claimed once the row holds it, so leaving the step without writing
 * would let a second person take the name in between.
 *
 * Sign-up has already provisioned a workspace, named after the account with a
 * random suffix, so this step **renames** it rather than creating a second
 * one. Creating is the fallback for the one account that has none: the sign-up
 * hook is best-effort, and this step is also the recovery path.
 */
export function OnboardingWorkspaceScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const resolveError = useErrorMessage();
  const { data: profile } = useProfile();
  const { data: organizations } = useOrganizations();
  const create = useCreateOrganization();
  const rename = useUpdateOrganization();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [addressEdited, setAddressEdited] = useState(false);
  const status = useAddressCheck(address);

  const existing = organizations?.[0];
  const isPending = create.isPending || rename.isPending;
  const error = create.error ?? rename.error;

  const full = `${ADDRESS_PREFIX}${address}`;

  const submit = () => {
    const onSuccess = () => navigate({ to: '/onboarding/github' });
    const changes = { name: name.trim(), slug: address };

    if (existing) rename.mutate({ id: existing.id, changes }, { onSuccess });
    else create.mutate(changes, { onSuccess });
  };

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

      {/* The create can fail after the address read as free — someone else may
          have taken it in between — so the failure belongs on this step, not
          on the one it would otherwise have navigated to. */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {resolveError(error, t('onboarding.flow.workspace.createFailed')).message}
          </AlertDescription>
        </Alert>
      )}

      <Button
        size="lg"
        block
        type="button"
        disabled={status !== 'ok' || !name.trim() || isPending}
        onClick={submit}
      >
        {isPending ? t('onboarding.flow.workspace.creating') : t('onboarding.flow.continue')}
      </Button>

      <div className="flex flex-col items-center gap-1 text-sm text-fg-muted">
        {/* Until the profile read lands there is no address to name, and a
            placeholder here would be a different person's. */}
        {profile?.email ? (
          <span>{t('onboarding.flow.workspace.using', { email: profile.email })}</span>
        ) : null}
        <AuthLink to="/login">{t('onboarding.flow.workspace.differentAccount')}</AuthLink>
      </div>
    </div>
  );
}
