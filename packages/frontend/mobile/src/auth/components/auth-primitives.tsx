import { Alert, AlertDescription } from '@oppenheimer/design-system-mobile/alert';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { ArrowLeft, CircleAlert } from '@oppenheimer/design-system-mobile/icons';
import { Separator } from '@oppenheimer/design-system-mobile/separator';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { cn } from '@oppenheimer/design-system-mobile/utils';
import { type Href, Link } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

/**
 * The shared vocabulary of the auth screens, the mobile half of
 * `@oppenheimer/frontend-web`'s `auth-primitives`. Same type ramp, same rhythm, same
 * names, so the two platforms' screens read as one design: 24px/500 title,
 * 14px ink-600 subtitle, 13px labels, pill CTAs.
 */

/**
 * The control height these screens pin.
 *
 * Web uses 40px; a tapped control does not. 48 is the height the platform's
 * own sign-in sheets use and comfortably clears the 44pt minimum target, so
 * the mobile screens keep their own number rather than inheriting web's.
 */
export const authControlClass = 'h-12 w-full';

/** Inputs are the same 48px, on the brand's 8px control radius. */
export const authInputClass = cn(authControlClass, 'rounded-md px-[13px] text-base');

export function AuthTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Text className={cn('mb-1.5 text-2xl font-medium text-ink-900', className)}>{children}</Text>
  );
}

export function AuthSubtitle({ children, className }: { children: ReactNode; className?: string }) {
  return <Text className={cn('mb-8 text-base text-ink-600', className)}>{children}</Text>;
}

/** The 52px disc that heads a terminal state (mail sent, password updated). */
export function AuthIconCircle({ children }: { children: ReactNode }) {
  return (
    <View className="mb-5 size-[52px] items-center justify-center rounded-full border border-border-subtle bg-surface-sunken">
      {children}
    </View>
  );
}

/** The quiet inset note under a "check your email" heading. */
export function AuthNote({ children }: { children: ReactNode }) {
  return (
    <View className="mb-6 rounded-md border border-border-subtle bg-surface-sunken px-3.5 py-3">
      <Text className="text-sm text-ink-600">{children}</Text>
    </View>
  );
}

/** Hairline · label · hairline, as used between the CTA and social sign-in. */
export function AuthDivider({ label }: { label: string }) {
  return (
    <View className="my-[22px] flex-row items-center gap-3.5">
      {/* `w-auto` is what lets the rule stretch: the design system's
          `Separator` is `w-full` for a block context, which in this flex row
          would be two hairlines each asking for the whole width. */}
      <Separator className="w-auto flex-1 bg-border-subtle" />
      <Text className="text-xs text-ink-400">{label}</Text>
      <Separator className="w-auto flex-1 bg-border-subtle" />
    </View>
  );
}

export function AuthBackLink({ children, href }: { children?: ReactNode; href: Href }) {
  const { t } = useTranslation();

  return (
    <Link href={href} asChild>
      <Pressable className="mt-7 flex-row items-center gap-1.5 self-start">
        <Icon as={ArrowLeft} size={14} className="text-ink-400" />
        <Text className="text-sm text-ink-600">
          {children ?? t('auth.forgotPassword.backToSignIn')}
        </Text>
      </Pressable>
    </Link>
  );
}

/** The centred "Already have an account? Sign in" line at the foot of a form. */
export function AuthFooterNote({ children }: { children: ReactNode }) {
  return <View className="mt-7 flex-row items-center justify-center gap-1">{children}</View>;
}

/**
 * The blue inline link these screens use — the footer's "Sign up", the note's
 * "try another email", the form's "Forgot your password?". Blue is the one
 * colour the brand lets carry meaning here.
 */
export function AuthLink({ className, ...props }: React.ComponentProps<typeof Text>) {
  return <Text className={cn('text-sm font-medium text-accent-blue', className)} {...props} />;
}

/**
 * Failed submissions surface here, above the first field — never in a native
 * `Alert.alert`, which buries the failure behind a dismissal and leaves the
 * form with nothing to show for it. The design system's `Alert` carries the
 * destructive treatment and the `role="alert"`.
 */
export function AuthFormError({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Alert icon={CircleAlert} variant="destructive" className={className}>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
