import { Avatar, AvatarFallback } from '@oppenheimer/design-system-mobile/avatar';
import { Badge } from '@oppenheimer/design-system-mobile/badge';
import { Button } from '@oppenheimer/design-system-mobile/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@oppenheimer/design-system-mobile/card';
import { Separator } from '@oppenheimer/design-system-mobile/separator';
import { Skeleton } from '@oppenheimer/design-system-mobile/skeleton';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { useLogout, useProfile } from '@oppenheimer/frontend/react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { LanguageSwitcher } from '../../components/language-switcher';

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: user, isLoading, isFetching, refetch } = useProfile();

  const logout = useLogout({
    onSuccess: () => {
      router.replace('/(auth)/login');
    },
  });

  return (
    <ScrollView contentContainerClassName="p-6 gap-6">
      <View className="flex-row items-center gap-4">
        <Avatar alt={user?.fullName ?? ''} className="size-14">
          <AvatarFallback>
            <Text className="text-lg font-semibold text-foreground">
              {isLoading ? '' : initials(user?.firstName, user?.lastName)}
            </Text>
          </AvatarFallback>
        </Avatar>
        <View className="flex-1 gap-1">
          {isLoading ? (
            <Skeleton className="h-7 w-48" />
          ) : (
            <Text className="text-2xl font-bold text-foreground" numberOfLines={1}>
              {user?.firstName
                ? t('home.greeting', { name: user.firstName })
                : t('home.greetingFallback')}
            </Text>
          )}
          <Text className="text-sm text-muted-foreground">{t('home.subtitle')}</Text>
        </View>
      </View>

      <Card>
        <CardHeader>
          <CardTitle>{t('home.account')}</CardTitle>
          <CardDescription>{t('home.accountDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="gap-4">
          {isLoading ? (
            <View className="gap-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
            </View>
          ) : !user ? (
            <View className="gap-3">
              <Text className="text-sm text-muted-foreground">{t('home.accountUnavailable')}</Text>
              <Button variant="outline" onPress={() => refetch()} disabled={isFetching}>
                <Text>{isFetching ? t('home.retrying') : t('home.retry')}</Text>
              </Button>
            </View>
          ) : (
            <>
              <AccountRow label={t('home.email')} value={user.email} />
              <Separator />
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-muted-foreground">{t('home.role')}</Text>
                <Badge variant={user.isAdmin ? 'default' : 'secondary'}>
                  <Text>{user.isAdmin ? t('home.admin') : user.role}</Text>
                </Badge>
              </View>
              <Separator />
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-muted-foreground">{t('home.status')}</Text>
                <Badge variant={user.isActive ? 'default' : 'destructive'}>
                  <Text>{user.isActive ? t('home.active') : t('home.inactive')}</Text>
                </Badge>
              </View>
              <Separator />
              <AccountRow label={t('home.memberSince')} value={formatDate(user.createdAt)} />
            </>
          )}
        </CardContent>
      </Card>

      <LanguageSwitcher />

      <Button variant="destructive" onPress={() => logout.mutate()} disabled={logout.isPending}>
        <Text>{logout.isPending ? t('home.signingOut') : t('home.signOut')}</Text>
      </Button>
    </ScrollView>
  );
}

function AccountRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-4">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="flex-1 text-right text-sm font-medium text-foreground" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function initials(firstName?: string, lastName?: string): string {
  const first = firstName?.trim().charAt(0) ?? '';
  const last = lastName?.trim().charAt(0) ?? '';
  return `${first}${last}`.toUpperCase();
}

function formatDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
