import { Button } from '@oppenheimer/design-system-mobile/button';
import { Glass } from '@oppenheimer/design-system-mobile/glass';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Check, Monitor } from '@oppenheimer/design-system-mobile/icons';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { useOrganizations } from '@oppenheimer/frontend-consumer/react';
import {
  AuthLayout,
  AuthSubtitle,
  AuthTitle,
  authControlClass,
} from '@oppenheimer/frontend-mobile';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

/**
 * The end of the phone's walk. The console's walk goes on to connect GitHub
 * and pair a host, which are work for the computer those repositories and
 * that runner live on, so this says where they are done and opens the app.
 */
export function OnboardingReadyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: organizations } = useOrganizations();
  const workspace = organizations?.[0]?.name ?? t('onboarding.flow.ready.workspace');

  return (
    <AuthLayout
      footer={
        <Button onPress={() => router.replace('/(app)')} className={authControlClass}>
          <Text>{t('onboarding.flow.ready.open')}</Text>
        </Button>
      }
    >
      <View className="gap-1.5">
        <Text variant="overline">{t('onboarding.flow.step', { step: 2, total: 2 })}</Text>
        <AuthTitle>{t('onboarding.flow.ready.title')}</AuthTitle>
        <AuthSubtitle>{t('onboarding.flow.ready.description', { workspace })}</AuthSubtitle>
      </View>

      <Glass className="gap-3 rounded-2xl p-4">
        <View className="flex-row items-center gap-3">
          <Icon as={Check} size={17} className="text-status-active" />
          <View className="flex-1">
            <Text variant="body">{workspace}</Text>
          </View>
          <Text variant="caption">{t('onboarding.flow.ready.doneLabel')}</Text>
        </View>
        <View className="flex-row items-start gap-3">
          <Icon as={Monitor} size={17} />
          <View className="flex-1">
            <Text variant="caption">{t('onboarding.flow.ready.onComputer')}</Text>
          </View>
        </View>
      </Glass>
    </AuthLayout>
  );
}
