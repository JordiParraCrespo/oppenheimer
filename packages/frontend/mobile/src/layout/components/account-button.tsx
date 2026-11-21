import { Avatar, AvatarFallback } from '@oppenheimer/design-system-mobile/avatar';
import { Glass } from '@oppenheimer/design-system-mobile/glass';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { useProfile } from '@oppenheimer/frontend-core/react';
import { type Href, Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';
import { initials } from '../lib/initials';

/**
 * The way to Account from any tab: the person's initials in a glass circle at
 * the end of the large title's line, as App Store and Music put theirs. It
 * opens Account as the system's sheet over the tab.
 */
export function AccountButton({ href }: { href: Href }) {
  const { t } = useTranslation();
  const { data: user } = useProfile();

  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={t('nav.account')} hitSlop={8}>
        <Glass interactive className="size-9 items-center justify-center rounded-full">
          <Avatar alt={user?.fullName ?? ''} className="size-9">
            <AvatarFallback className="bg-transparent">
              <Text variant="caption" tone="default">
                {user ? initials(user.firstName, user.lastName) : ''}
              </Text>
            </AvatarFallback>
          </Avatar>
        </Glass>
      </Pressable>
    </Link>
  );
}
