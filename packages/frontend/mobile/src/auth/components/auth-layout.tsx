import { Text } from '@oppenheimer/design-system-mobile/text';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LanguageSwitcher } from '../../i18n';
import { ThemeToggle } from '../../theme';
import { BrandLogo } from './brand-logo';

export interface AuthLayoutProps {
  /** The wordmark's label; defaults to the product name. */
  brandLabel?: string;
  /** Optional translated legal copy pinned below the form. */
  legalNote?: ReactNode;
  children: ReactNode;
}

/**
 * The frame every auth screen sits in: wordmark and theme pill along the top,
 * the form centred in a 400px column, the language switch and any small print
 * at the foot.
 *
 * It is the mobile reading of `@oppenheimer/frontend-web`'s `AuthLayout` — the same
 * chrome in the same places, minus the aurora panel, which that layout already
 * drops below 900px because it carries atmosphere rather than information.
 *
 * Web mounts its copy once, on the `_auth` route, around an `<Outlet />`. Expo
 * Router's `(auth)` group is a `<Stack>`, and a navigator cannot live inside a
 * `ScrollView`, so here each screen mounts the layout itself.
 */
export function AuthLayout({ brandLabel, legalNote, children }: AuthLayoutProps) {
  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView className="flex-1">
        <ScrollView
          contentContainerClassName="min-h-full flex-grow px-6 pb-4 pt-3"
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-row items-center justify-between">
            <BrandLogo label={brandLabel} />
            <ThemeToggle />
          </View>

          <View className="w-full max-w-[400px] flex-1 justify-center self-center py-10">
            {children}
          </View>

          <View className="gap-3">
            {legalNote ? (
              <Text className="text-center text-xs text-ink-400">{legalNote}</Text>
            ) : null}
            <LanguageSwitcher />
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
