import {
  Alert,
  AlertDescription,
  cn,
  Field,
  FieldAction,
  FieldError,
  FieldLabel,
  FieldRow,
  Separator,
  Link as TextLink,
} from '@oppenheimer/design-system-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * The shared vocabulary of the auth screens, expressed once so every page
 * inherits the same rhythm from the MVP artboards: a 40px display heading over
 * a 15px muted lead, 13px labels, the 42px control size, links in link blue.
 */

/**
 * Legacy: the previous system pinned auth controls at 40px through these
 * classes. Controls now take `size="lg"`; the names stay so the screens not
 * yet rebuilt (onboarding, accept-invitation) keep compiling.
 */
export const authControlClass = 'w-full';
export const authInputClass = 'w-full';

export function AuthEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow figures mb-3">{children}</p>;
}

export function AuthTitle({ children, className }: React.ComponentProps<'h1'>) {
  return (
    <h1 className={cn('mb-2 font-display text-2xl font-semibold text-pretty text-fg', className)}>
      {children}
    </h1>
  );
}

export function AuthSubtitle({ children, className }: React.ComponentProps<'p'>) {
  return <p className={cn('mb-7 text-base text-pretty text-fg-muted', className)}>{children}</p>;
}

/** The muted line under a form's primary action ("Signing in ends any other sessions…"). */
export function AuthNote({ children, className }: React.ComponentProps<'p'>) {
  return <p className={cn('mt-4 text-xs text-pretty text-fg-subtle', className)}>{children}</p>;
}

/** Hairline · OR · hairline, between the social buttons and the email form. */
export function AuthDivider({ label }: { label: string }) {
  const { t } = useTranslation();

  return <Separator className="my-5">{label ?? t('common.or')}</Separator>;
}

/** A line of secondary navigation under the form ("No account? Create one"). */
export function AuthFooterNote({ children, className }: React.ComponentProps<'p'>) {
  return <p className={cn('mt-5 text-sm text-fg-muted', className)}>{children}</p>;
}

/** A router link in the auth screens' voice: the link blue, underline on hover. */
export function AuthLink({
  to,
  search,
  children,
  className,
}: {
  to: string;
  search?: Record<string, unknown>;
  /** Optional so `Trans` can pass the element and fill it from the catalog. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <TextLink className={className} render={<Link to={to} search={search as never} />}>
      {children}
    </TextLink>
  );
}

/** A standalone link on its own line ("Back to sign in"). */
export function AuthBackLink({ children }: { children?: React.ReactNode }) {
  const { t } = useTranslation();

  return (
    <p className="mt-5 text-sm">
      <AuthLink to="/login">{children ?? t('auth.forgotPassword.backToSignIn')}</AuthLink>
    </p>
  );
}

/**
 * Failed submissions surface here, above the first field. The design system's
 * `Alert` carries the destructive treatment and the `role="alert"`.
 */
export function AuthFormError({ children }: { children: React.ReactNode }) {
  return (
    <Alert variant="destructive">
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

/**
 * Label, an optional action beside it ("Forgot password?"), the control, then
 * a hint or the error. Wraps the design system's `Field` so validation state
 * and `data-invalid` behave as they do in the rest of the product.
 */
export function AuthField({
  label,
  htmlFor,
  action,
  hint,
  error,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor: string;
  action?: React.ReactNode;
  hint?: React.ReactNode;
  error?: { message?: string };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Field className={className} data-invalid={Boolean(error)}>
      {action ? (
        <FieldRow>
          <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
          <FieldAction>{action}</FieldAction>
        </FieldRow>
      ) : (
        <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      )}
      {children}
      {error ? (
        <FieldError errors={[error]} />
      ) : hint ? (
        <p className="text-xs text-fg-subtle">{hint}</p>
      ) : null}
    </Field>
  );
}
