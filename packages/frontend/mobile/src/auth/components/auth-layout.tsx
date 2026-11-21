import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export interface AuthLayoutProps {
  /** What sits at the foot of the screen: the legal line, "Already have an account?". */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * The frame every auth screen after Welcome sits in, as `Mobile.dc.html`
 * draws its email screen: the system's navigation bar (transparent, its back
 * button Liquid Glass on iOS 26) over a large title, the form under it, and
 * a foot pinned to the bottom of the scroll.
 *
 * Expo Router's `(auth)` group is a `<Stack>`, and a navigator cannot live
 * inside a `ScrollView`, so each screen mounts the layout itself.
 */
export function AuthLayout({ footer, children }: AuthLayoutProps) {
  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView edges={['bottom']} className="flex-1">
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerClassName="min-h-full flex-grow gap-6 px-5 pb-4 pt-4"
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-6">{children}</View>
          <View className="flex-1" />
          {footer ? <View className="gap-3">{footer}</View> : null}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
