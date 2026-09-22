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
  Link as TextLink,
} from '@oppenheimer/design-system-web';
import { isProvisionalSlug } from '@oppenheimer/frontend-consumer';
import { useClaimPersonalWorkspace, useOrganizations } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage, useLogout, useProfile } from '@oppenheimer/frontend-core/react';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAddressCheck } from '@/features/organizations/hooks/use-address-check';
import { closeFirstRun, openFirstRun } from '@/features/organizations/lib/first-run';
import { slugify } from '@/features/organizations/lib/slugify';
import { workspaceAddressPrefix } from '@/features/organizations/lib/workspace-address';

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
  // Back and "use a different account" both leave first-run for the sign-in
  // screen, which is only true if the session goes with them: a still-signed-in
  // `/login` bounces straight to `/sessions` (PR #28).
  const logout = useLogout({ onSuccess: () => navigate({ to: '/login' }) });
  const leave = () => {
    // Whatever this tab was walking, it is not walking it any more: the next
    // account to sign in here starts from its own gate, not this one's.
    closeFirstRun();
    logout.mutate();
  };
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

  const submit = () => {
    // Before the claim, not after it. The claim is what makes the account
    // finished, and the gate over the subtree sends a finished account to the
    // console — this reader included, two steps short of the end, unless the
    // walk is already open when the workspace list settles.
    openFirstRun();
    claim.mutate(
      { existing, name: name.trim(), slug: address },
      { onSuccess: () => navigate({ to: '/onboarding/github' }) },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <StepHeader
        step={2}
        total={4}
        back={{ render: <button type="button" onClick={leave} /> }}
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
            onChange={(event) =>
              edit({
                name: event.target.value,
                // The address follows the name until the reader takes it over,
                // and never once it is claimed.
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
            value={address}
            status={claimedAddress ? 'ok' : status}
            // Permanent once claimed: the field shows it and stops taking edits.
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
      {claim.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {resolveError(claim.error, t('onboarding.flow.workspace.claimFailed')).message}
          </AlertDescription>
        </Alert>
      )}

      <Button
        size="lg"
        block
        type="button"
        // `workspacesRead` is the guard against creating a second workspace:
        // until the list has answered, this step does not know whether there
        // is a row to claim.
        disabled={!workspacesRead || !addressReady || !name.trim() || claim.isPending}
        onClick={submit}
      >
        {claim.isPending ? t('onboarding.flow.workspace.claiming') : t('onboarding.flow.continue')}
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
