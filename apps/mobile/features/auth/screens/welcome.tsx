import { Button } from '@oppenheimer/design-system-mobile/button';
import { ExpoImage } from '@oppenheimer/design-system-mobile/expo-image';
import { Glass } from '@oppenheimer/design-system-mobile/glass';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Mail } from '@oppenheimer/design-system-mobile/icons';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { AuthLink, authControlClass, SocialLoginButtons } from '@oppenheimer/frontend-mobile';
import { Link, useRouter } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { Trans, useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const portrait = require('../../../assets/imagery/oppenheimer-portrait.webp');

/**
 * The first screen signed out: the portrait full bleed, and over it one card
 * with every way in. The providers the deployment has are buttons; email is
 * a screen of its own. Terms and Privacy are the console's pages, opened in
 * the system browser.
 */
export function WelcomeScreen({ webUrl }: { webUrl: string }) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View className="flex-1 bg-surface-inverse">
      <ExpoImage
        source={portrait}
        accessibilityLabel={t('auth.art.slides.portrait.alt')}
        contentFit="cover"
        contentPosition={{ left: '50%', top: '18%' }}
        className="absolute inset-0"
      />
      <SafeAreaView className="flex-1 justify-between px-2.5 pb-2">
        <View className="h-11 flex-row items-center justify-between px-2.5">
          <Text variant="h3" tone="inverse">
            {t('common.appName')}
          </Text>
          <Glass className="rounded-full px-3 py-1.5">
            <Text variant="caption" tone="default">
              {t('auth.art.slides.portrait.caption')}
            </Text>
          </Glass>
        </View>

        <Glass className="gap-4 rounded-3xl px-4 pb-4 pt-5">
          <View className="gap-1.5">
            <Text variant="largeTitle">{t('auth.login.title')}</Text>
            <Text variant="subhead">{t('auth.login.description')}</Text>
          </View>
          <View className="gap-2.5">
            <SocialLoginButtons divider={false} onSuccess={() => router.replace('/(app)')} />
            <Link href="/(auth)/login" asChild>
              <Button variant="ghost" className={authControlClass}>
                <Icon as={Mail} size={17} />
                <Text>{t('auth.login.continueWithEmail')}</Text>
              </Button>
            </Link>
          </View>
          <Text variant="caption">
            <Trans
              i18nKey="auth.legal"
              components={{
                terms: <AuthLink onPress={() => openBrowserAsync(`${webUrl}/terms`)} />,
                privacy: <AuthLink onPress={() => openBrowserAsync(`${webUrl}/privacy`)} />,
              }}
            />
          </Text>
        </Glass>
      </SafeAreaView>
    </View>
  );
}
