import { Button } from '@oppenheimer/design-system-mobile/button';
import { Input } from '@oppenheimer/design-system-mobile/input';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { isProvisionalSlug, slugify } from '@oppenheimer/frontend-consumer';
import { useClaimPersonalWorkspace, useOrganizations } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage, useLogout, useProfile } from '@oppenheimer/frontend-core/react';
import {
  AuthFormError,
  AuthLayout,
  AuthLink,
  AuthSubtitle,
  AuthTitle,
  authControlClass,
  authInputClass,
  FormField,
} from '@oppenheimer/frontend-mobile';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useAddressCheck } from '../hooks/use-address-check';

/**
 * Name the workspace and pick its permanent address, which follows the name
 * until edited by hand — the console's step two, on the phone. Sign-up has
 * already provisioned a workspace, so this **renames** it; creating is the
 * recovery path for an account the best-effort sign-up hook left with none.
 * Continue waits for an available address and writes it before moving on.
 */
export function OnboardingWorkspaceScreen({ webHost }: { webHost: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const resolveError = useErrorMessage();
  const { data: profile } = useProfile();
  const logout = useLogout({ onSuccess: () => router.replace('/(auth)/welcome') });
  // `isSuccess`, not merely `data`: submitting before this settles would take
  // the create branch over a workspace sign-up had already provisioned.
  const { data: organizations, isSuccess: workspacesRead } = useOrganizations();
  const claim = useClaimPersonalWorkspace();
  const existing = organizations?.[0];

  // A claimed address is permanent: shown, never offered for change.
  const claimedAddress = existing && !isProvisionalSlug(existing.slug) ? existing.slug : null;

  // Decided once, on arrival: an account that already chose its address
  // belongs in the app. Submitting writes the address into the cache, so a
  // gate that kept reading would skip Ready.
  const [claimedOnArrival, setClaimedOnArrival] = useState<boolean | null>(null);
  if (claimedOnArrival === null && workspacesRead) setClaimedOnArrival(claimedAddress !== null);

  // `null` means "not typed yet", so the fields show the provisioned row as
  // soon as it arrives and keep what was typed afterwards.
  const [draft, setDraft] = useState<{ name: string; address: string } | null>(null);
  const [addressEdited, setAddressEdited] = useState(false);

  const name = draft?.name ?? existing?.name ?? '';
  const address = draft?.address ?? claimedAddress ?? slugify(existing?.name ?? '');
  const { status, error: checkError } = useAddressCheck(claimedAddress ? '' : address);
  const full = `${webHost}/${address}`;
  const addressReady = Boolean(claimedAddress) || status === 'ok';

  const edit = (changes: Partial<{ name: string; address: string }>) =>
    setDraft({ name, address, ...changes });

  const submit = () =>
    claim.mutate(
      { existing, name: name.trim(), slug: address },
      { onSuccess: () => router.replace('/onboarding/ready') },
    );

  if (claimedOnArrival) return <Redirect href="/(app)" />;

  return (
    <AuthLayout
      footer={
        <View className="items-start gap-1">
          {profile?.email ? (
            <Text variant="caption">
              {t('onboarding.flow.workspace.using', { email: profile.email })}
            </Text>
          ) : null}
          <AuthLink onPress={() => logout.mutate()}>
            {t('onboarding.flow.workspace.differentAccount')}
          </AuthLink>
        </View>
      }
    >
      <View className="gap-1.5">
        <Text variant="overline">{t('onboarding.flow.step', { step: 1, total: 2 })}</Text>
        <AuthTitle>{t('onboarding.flow.workspace.title')}</AuthTitle>
        <AuthSubtitle>{t('onboarding.flow.workspace.description')}</AuthSubtitle>
      </View>

      <View className="gap-4">
        <FormField label={t('onboarding.flow.workspace.name')} nativeID="ws-name">
          <Input
            className={authInputClass}
            aria-labelledby="ws-name"
            value={name}
            placeholder={t('onboarding.flow.workspace.namePlaceholder')}
            onChangeText={(value) =>
              edit({
                name: value,
                ...(addressEdited || claimedAddress ? {} : { address: slugify(value) }),
              })
            }
          />
        </FormField>

        <FormField label={t('onboarding.flow.workspace.address')} nativeID="ws-slug">
          <Input
            className={authInputClass}
            aria-labelledby="ws-slug"
            value={address}
            editable={!claimedAddress}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t('onboarding.flow.workspace.addressPlaceholder')}
            onChangeText={(value) => {
              setAddressEdited(true);
              edit({ address: slugify(value) });
            }}
          />
          {claimedAddress ? (
            <Text variant="caption">
              {t('onboarding.flow.workspace.permanent', { address: full })}
            </Text>
          ) : checkError ? (
            // A check that failed is not a verdict: say so rather than leave
            // the field checking forever.
            <Text variant="caption" tone="destructive">
              {t('onboarding.flow.workspace.checkFailed')}
            </Text>
          ) : status === 'ok' ? (
            <Text variant="caption" tone="success">
              {t('onboarding.flow.workspace.available', { address: full })}
            </Text>
          ) : status === 'taken' ? (
            <Text variant="caption" tone="destructive">
              {t('onboarding.flow.workspace.taken', { address: full })}
            </Text>
          ) : status === 'checking' ? (
            <Text variant="caption">{t('onboarding.flow.workspace.checking')}</Text>
          ) : (
            <Text variant="caption">{t('onboarding.flow.workspace.hint')}</Text>
          )}
        </FormField>
      </View>

      {/* The create can fail after the address read as free: someone may have
          taken it in between, so the failure stays on this step. */}
      {claim.error ? (
        <AuthFormError>
          {resolveError(claim.error, t('onboarding.flow.workspace.claimFailed')).message}
        </AuthFormError>
      ) : null}
      {logout.error ? (
        <AuthFormError>{resolveError(logout.error, t('nav.logOutFailed')).message}</AuthFormError>
      ) : null}

      <Button
        onPress={submit}
        disabled={!workspacesRead || !addressReady || !name.trim() || claim.isPending}
        className={authControlClass}
      >
        <Text>
          {claim.isPending
            ? t('onboarding.flow.workspace.claiming')
            : t('onboarding.flow.continue')}
        </Text>
      </Button>
    </AuthLayout>
  );
}
