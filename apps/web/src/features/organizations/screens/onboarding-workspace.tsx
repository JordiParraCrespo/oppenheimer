import {
  Button,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  Input,
  SlugInput,
  StepHeader,
  Link as TextLink,
} from '@oppenheimer/design-system-web';
import { isProvisionalSlug } from '@oppenheimer/frontend-consumer';
import { useClaimPersonalWorkspace, useOrganizations } from '@oppenheimer/frontend-consumer/react';
import { useLogout, useProfile } from '@oppenheimer/frontend-core/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { Navigate, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAddressCheck } from '@/features/organizations/hooks/use-address-check';
import { slugify } from '@/features/organizations/lib/slugify';
import { workspaceAddressPrefix } from '@/features/organizations/lib/workspace-address';

/**
 * Onboarding step 2: name the workspace and pick its permanent address, which
 * follows the name until edited by hand. Continue waits for an available
 * address and writes it before moving on, because it is only claimed once the
 * row holds it. Sign-up has already provisioned a workspace, so this step
 * **renames** it; creating is the recovery path for an account the
 * best-effort sign-up hook left with none.
 */
export function OnboardingWorkspaceScreen({
  step,
  total,
  onClaimed,
}: {
  step: number;
  total: number;
  onClaimed: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  // Back and "use a different account" both leave first-run for the sign-in
  // screen, which is only true if the session goes with them: a still-signed-in
  // `/login` bounces straight to `/sessions/new` (PR #28).
  const logout = useLogout({ onSuccess: () => navigate({ to: '/login' }) });
  const leave = () => logout.mutate();
  // `isSuccess`, not merely `data`: submitting before this settles would take
  // the create branch over a workspace sign-up had already provisioned, and
  // Better Auth would happily make a second one.
  const { data: organizations, isSuccess: workspacesRead } = useOrganizations();
  const claim = useClaimPersonalWorkspace();
  const existing = organizations?.[0];

  // The address is claimed once. A workspace whose slug the reader has already
  // chosen shows it and does not offer to change it — `08` and `05` both call
  // it permanent, and `check-slug` counts their own slug as taken, so a
  // revisit could not re-submit it even if the field let them try.
  const claimedAddress = existing && !isProvisionalSlug(existing.slug) ? existing.slug : null;

  // The first-run gate (`08-auth.md`): an account whose address is already
  // claimed belongs in the console, not in the step that names one. The test
  // is the claimed address, not a workspace's existence — sign-up provisions
  // one for everybody. Only a *settled, successful* read decides: an
  // unanswered query says nothing, and guessing would bounce a reader out on a
  // network blip. And it is decided once, on arrival, because submitting this
  // step claims the address and writes it into the cache before navigating on
  // to GitHub — a gate that kept reading would send the newcomer to the
  // console, past the rest of the walk.
  const [claimedOnArrival, setClaimedOnArrival] = useState<boolean | null>(null);
  if (claimedOnArrival === null && workspacesRead) setClaimedOnArrival(claimedAddress !== null);

  // One nullable draft rather than a field each: `null` means "the reader has
  // not typed", so the fields show the provisioned row as soon as it arrives
  // and keep showing what was typed afterwards — no effect, and nothing to
  // re-sync when the query settles.
  const [draft, setDraft] = useState<{ name: string; address: string } | null>(null);
  const [addressEdited, setAddressEdited] = useState(false);

  const name = draft?.name ?? existing?.name ?? '';
  const address = draft?.address ?? claimedAddress ?? slugify(existing?.name ?? '');

  // A claimed address is not up for checking: it is already this workspace's,
  // and `check-slug` would call it taken.
  const { status, error: checkError } = useAddressCheck(claimedAddress ? '' : address);

  const prefix = workspaceAddressPrefix();
  const full = `${prefix}${address}`;
  const addressReady = Boolean(claimedAddress) || status === 'ok';

  const edit = (changes: Partial<{ name: string; address: string }>) =>
    setDraft({ name, address, ...changes });

  const submit = () =>
    claim.mutate({ existing, name: name.trim(), slug: address }, { onSuccess: onClaimed });

  if (claimedOnArrival) return <Navigate to="/sessions/new" replace />;

  return (
    <div className="flex flex-col gap-5">
      <StepHeader
        step={step}
        total={total}
        back={{ render: <button type="button" onClick={leave} /> }}
        backLabel={t('onboarding.flow.back')}
        counterLabel={t('onboarding.flow.step', { step, total })}
        title={t('onboarding.flow.workspace.title')}
      >
        {t('onboarding.flow.workspace.description')}
      </StepHeader>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="ws-name">{t('onboarding.flow.workspace.name')}</FieldLabel>
          <Input
            id="ws-name"
            size="lg"
            value={name}
            placeholder={t('onboarding.flow.workspace.namePlaceholder')}
            onChange={(event) =>
              edit({
                name: event.target.value,
                ...(addressEdited || claimedAddress
                  ? {}
                  : { address: slugify(event.target.value) }),
              })
            }
          />
        </Field>
        <Field data-invalid={status === 'taken' || undefined}>
          <FieldLabel htmlFor="ws-slug">{t('onboarding.flow.workspace.address')}</FieldLabel>
          <SlugInput
            id="ws-slug"
            size="lg"
            prefix={prefix}
            placeholder={t('onboarding.flow.workspace.addressPlaceholder')}
            checkingLabel={t('onboarding.flow.workspace.checkingLabel')}
            okLabel={t('onboarding.flow.workspace.availableLabel')}
            takenLabel={t('onboarding.flow.workspace.takenLabel')}
            value={address}
            status={claimedAddress ? 'ok' : status}
            readOnly={Boolean(claimedAddress)}
            onChange={(event) => {
              setAddressEdited(true);
              edit({ address: slugify(event.target.value) });
            }}
          />
          {claimedAddress ? (
            <FieldDescription>
              {t('onboarding.flow.workspace.permanent', { address: full })}
            </FieldDescription>
          ) : checkError ? (
            // A check that failed is not a verdict. Say so, rather than
            // leaving the field in a checking state nobody can clear.
            <FieldDescription tone="danger">
              {t('onboarding.flow.workspace.checkFailed')}
            </FieldDescription>
          ) : status === 'ok' ? (
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
      <ErrorAlert error={claim.error} fallback={t('onboarding.flow.workspace.claimFailed')} />

      {/* Leaving signs out first; a sign-out that failed leaves the reader here,
          signed in, and says so rather than doing nothing. */}
      <ErrorAlert error={logout.error} fallback={t('nav.logOutFailed')} />

      <Button
        size="lg"
        block
        type="button"
        disabled={!workspacesRead || !addressReady || !name.trim()}
        onClick={submit}
        pending={claim.isPending}
        pendingLabel={t('onboarding.flow.workspace.claiming')}
      >
        {t('onboarding.flow.continue')}
      </Button>

      <div className="flex flex-col items-center gap-1 text-sm text-fg-muted">
        {/* Until the profile read lands there is no address to name, and a
            placeholder here would be a different person's. */}
        {profile?.email ? (
          <span>{t('onboarding.flow.workspace.using', { email: profile.email })}</span>
        ) : null}
        <TextLink render={<button type="button" onClick={leave} />}>
          {t('onboarding.flow.workspace.differentAccount')}
        </TextLink>
      </div>
    </div>
  );
}
