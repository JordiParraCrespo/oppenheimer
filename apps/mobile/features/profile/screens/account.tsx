import { TabScreen } from '@oppenheimer/frontend-mobile';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Appearance } from '../sections/appearance';
import { ProfileCard } from '../sections/profile-card';
import { SignOut } from '../sections/sign-out';

/** Who is signed in, how the app looks, and the way out. */
export function AccountScreen() {
  const { t } = useTranslation();

  return (
    <TabScreen title={t('nav.account')}>
      <View className="gap-6 px-4 pt-4">
        <ProfileCard />
        <Appearance />
        <SignOut />
      </View>
    </TabScreen>
  );
}
