import {
  Alert,
  AlertDescription,
  cn,
  Field,
  FieldError,
  FieldLabel,
  Separator,
} from '@oppenheimer/design-system-web';
import { ArrowLeft } from '@oppenheimer/design-system-web/icons';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * The shared vocabulary of the auth screens, expressed once so every page
 * inherits the same type ramp and rhythm: 24px/500 title, 14px ink-600
 * subtitle, 13px labels, 40px controls, pill CTAs.
 */

/**
 * The 40px control the auth forms use — between the design system's 36 and 44.
 *
 * These screens pin their own height rather than inheriting the `Input` /
 * `SelectTrigger` default, which is `default` (36px) so a dashboard field sits
 * level with the buttons and table bars around it. Auth has no such
 * neighbours — it is one column of fields — and stays at 40. The class lands
 * on the control's `className`, so tailwind-merge drops the variant's height:
 * the size prop is deliberately never passed on these screens.
 */
export const authControlClass = 'h-10 w-full';

/**
 * Inputs on these screens are 40px with 13px gutters and, unlike the rest of
 * the product, do show focus: a blue hairline and a soft ring. Sign-in is the
 * one place a keyboard user has nothing else to orient by.
 */
export const authInputClass = cn(
  authControlClass,
  'rounded-md px-[13px] text-base',
  'focus:border-accent-blue focus:ring-3 focus:ring-accent-blue/35',
);

export function AuthEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="mb-2.5 text-sm font-medium text-accent-blue">{children}</p>;
}

/**
 * `font-sans` overrides the design system's display cut for headings: these
 * screens are set entirely in the text cut, whose wider letterforms are what
 * decide where a title wraps.
 */
export function AuthTitle({ children, className }: React.ComponentProps<'h1'>) {
  return (
    <h1 className={cn('mb-1.5 font-sans text-2xl font-medium text-pretty text-ink-900', className)}>
      {children}
    </h1>
  );
}

export function AuthSubtitle({ children, className }: React.ComponentProps<'p'>) {
  return (
    <p className={cn('mb-8 text-base leading-normal text-pretty text-ink-600', className)}>
      {children}
    </p>
  );
}

/** The 52px disc that heads a terminal state (mail sent, password updated). */
export function AuthIconCircle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 flex size-13 items-center justify-center rounded-full border border-border-subtle bg-surface-sunken [&>svg]:size-6 [&>svg]:text-ink-900">
      {children}
    </div>
  );
}

/** A pill naming the address a flow is scoped to. */
export function AuthEmailChip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-7 inline-flex self-start items-center gap-2 rounded-full border border-border-subtle bg-surface-sunken px-3 py-2 text-sm text-ink-900 [&>svg]:size-[15px] [&>svg]:text-ink-600 [&>svg]:opacity-55">
      {children}
    </div>
  );
}

/** The quiet inset note under a "check your email" heading. */
export function AuthNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-6 rounded-md border border-border-subtle bg-surface-sunken px-3.5 py-3 text-sm leading-normal text-ink-600">
      {children}
    </p>
  );
}

/** Hairline · label · hairline, as used between the CTA and social sign-in. */
export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="my-[22px] flex items-center gap-3.5 text-xs text-ink-400">
      <Separator className="flex-1 bg-border-subtle" />
      {label}
      <Separator className="flex-1 bg-border-subtle" />
    </div>
  );
}

export function AuthBackLink({ children }: { children?: React.ReactNode }) {
  const { t } = useTranslation();

  return (
    <Link
      to="/login"
      className="mt-7 inline-flex self-start items-center gap-1.5 text-sm text-ink-600 transition-colors hover:text-ink-900"
    >
      <ArrowLeft className="size-3.5 opacity-55" />
      {children ?? t('auth.forgotPassword.backToSignIn')}
    </Link>
  );
}

/** The centred "Already have an account? Sign in" line at the foot of a form. */
export function AuthFooterNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-7 text-center text-sm text-ink-600">{children}</p>;
}

/**
 * Failed submissions surface here, above the first field. The design system's
 * `Alert` carries the destructive treatment and the `role="alert"` — this
 * wrapper only exists so the auth screens name the slot in their own
 * vocabulary.
 */
export function AuthFormError({ children }: { children: React.ReactNode }) {
  return (
    <Alert variant="destructive">
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

/**
 * Label + control + error, at the auth screens' 7px label gap. Wraps the
 * design system's `Field` so validation state and `data-invalid` behave
 * exactly as they do in the rest of the product.
 */
export function AuthField({
  label,
  htmlFor,
  error,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor: string;
  error?: { message?: string };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Field className={cn('gap-[7px]', className)} data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={htmlFor} className="leading-[15px]">
        {label}
      </FieldLabel>
      {children}
      <FieldError errors={[error]} />
    </Field>
  );
}
