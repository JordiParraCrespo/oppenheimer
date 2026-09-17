import { Button } from '@oppenheimer/design-system-web';
import { useConsumerApp } from '@oppenheimer/frontend-consumer/react';
import { useAuthState } from '@oppenheimer/frontend-core/react';
import {
  AuthEyebrow,
  AuthFooterNote,
  AuthFormError,
  AuthSubtitle,
  AuthTitle,
  authControlClass,
} from '@oppenheimer/frontend-web';
import type { AcceptInvitationDto } from '@oppenheimer/shared/schemas/auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { InviterCard } from '@/features/organizations/components/inviter-card';
import { AcceptInvitationForm } from '@/features/organizations/forms/accept-invitation-form';
import { isExistingAccountError, splitName } from '@/features/organizations/lib/invitation';

export interface AcceptInvitationSearch {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  inviter?: string;
}

export function AcceptInvitationScreen({ id, email, name, role, inviter }: AcceptInvitationSearch) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthState();

  const invitationHref = `/accept-invitation?${new URLSearchParams(
    Object.entries({ id, email, name, role, inviter }).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  ).toString()}`;

  const { mutate, isPending, error } = useMutation<void, Error, AcceptInvitationDto | undefined>({
    mutationFn: async (values) => {
      if (!id || !email) throw new Error(t('auth.acceptInvitation.invalidLink'));

      if (!isAuthenticated) {
        if (!values) throw new Error(t('auth.acceptInvitation.invalidLink'));
        try {
          await app.auth.register({
            email,
            password: values.password,
            ...splitName(values.fullName),
          });
        } catch (failure) {
          // The registration-shaped invitation page is also the entry point
          // for existing accounts. If Better Auth confirms the address already
          // exists, the password the person just supplied is their login
          // credential: authenticate and continue in the same submission.
          // A wrong password still fails normally and never accepts the invite.
          if (!isExistingAccountError(failure)) throw failure;
          await app.auth.login({ email, password: values.password });
        }
      }

      // Better Auth accepts the membership and selects its organization in one
      // transaction. Calling the separately policy-guarded set-active endpoint
      // here can turn a successful acceptance into a misleading 403.
      await app.organizations.acceptInvitation(id);
    },
    onSuccess: async () => {
      // Accepting is what puts this account in a workspace, and the app shell
      // decides where to send a signed-in reader by the workspaces it can see.
      // That list is cached for a minute and persisted across reloads, so
      // without dropping it here an invitee who passed through onboarding
      // first would be bounced straight back to it — asked to create a
      // workspace seconds after joining one.
      //
      // Awaited: the shell redirects on a settled empty list, and navigating
      // while the cached `[]` is still being refetched would race it.
      await queryClient.invalidateQueries();
      navigate({ to: '/sessions' });
    },
  });

  const linkIsValid = Boolean(id && email);

  return (
    <>
      <AuthEyebrow>{t('auth.acceptInvitation.eyebrow')}</AuthEyebrow>
      <AuthTitle>{t('auth.acceptInvitation.title')}</AuthTitle>
      <AuthSubtitle>{t('auth.acceptInvitation.description')}</AuthSubtitle>

      {inviter && <InviterCard inviter={inviter} role={role} email={email} />}

      {/*
        Every other auth screen puts its callout inside the form's `FieldGroup`,
        which supplies the 16px gap to the control below. Here it sits outside
        the form — the accepted-invitation branch has no form at all — so the
        block owns that spacing itself, instead of leaving the alert flush
        against the CTA.
      */}
      {(!linkIsValid || error) && (
        <div className="mb-4 flex flex-col gap-3">
          {!linkIsValid && <AuthFormError>{t('auth.acceptInvitation.invalidLink')}</AuthFormError>}
          {error && (
            <AuthFormError>
              {error instanceof Error ? error.message : t('auth.register.failed')}
            </AuthFormError>
          )}
        </div>
      )}

      {isAuthenticated ? (
        <Button
          type="button"
          disabled={isPending || !linkIsValid}
          className={authControlClass}
          onClick={() => mutate(undefined)}
        >
          {isPending
            ? t('auth.acceptInvitation.joining')
            : t('auth.acceptInvitation.acceptExisting')}
        </Button>
      ) : (
        <AcceptInvitationForm
          email={email}
          defaultName={name}
          isPending={isPending}
          linkIsValid={linkIsValid}
          onSubmit={(values) => mutate(values)}
        />
      )}

      {!isAuthenticated && (
        <AuthFooterNote>
          {t('auth.register.hasAccount')}{' '}
          <Link
            to="/login"
            search={{ redirect: invitationHref, email }}
            className="text-accent-blue transition-opacity hover:opacity-80"
          >
            {t('auth.register.signIn')}
          </Link>
        </AuthFooterNote>
      )}
    </>
  );
}
