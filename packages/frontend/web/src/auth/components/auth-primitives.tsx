import {
  cn,
  Field,
  FieldAction,
  FieldDescription,
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
 * inherits the same rhythm from the MVP artboards: a display heading over a
 * muted lead, 13px labels, the 42px control size (`size="lg"`), links in link
 * blue.
 */

export function AuthTitle({ children, className }: React.ComponentProps<'h1'>) {
  return (
    <h1
      className={cn(
        'mb-2 font-display text-[38px] leading-[1.1] font-semibold tracking-[-0.024em] text-pretty text-fg',
        className,
      )}
    >
      {children}
    </h1>
  );
}

export function AuthSubtitle({ children, className }: React.ComponentProps<'p'>) {
  return <p className={cn('mb-7 text-base text-pretty text-fg-muted', className)}>{children}</p>;
}

/** The muted line under a form's primary action ("Saving signs you out of every other device."). */
export function AuthNote({ children, className }: React.ComponentProps<'p'>) {
  return <p className={cn('mt-4 text-xs text-pretty text-fg-subtle', className)}>{children}</p>;
}

/** The 52px disc that heads a terminal state (mail sent, password updated). */
export function AuthIconCircle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 flex size-13 items-center justify-center rounded-full border border-border-subtle bg-surface-sunken [&>svg]:size-6 [&>svg]:text-fg">
      {children}
    </div>
  );
}

/** Hairline · OR · hairline, between the social buttons and the email form. */
export function AuthDivider({ label }: { label?: string }) {
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
  children,
  className,
}: {
  to: string;
  /** Optional so `Trans` can pass the element and fill it from the catalog. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <TextLink className={className} render={<Link to={to} />}>
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
        <FieldDescription>{hint}</FieldDescription>
      ) : null}
    </Field>
  );
}
