import { Badge, Card, cn, IconButton } from '@oppenheimer/design-system-web';
import { Check, Copy } from '@oppenheimer/design-system-web/icons';
import { useCopy } from '@/lib/use-copy';

/**
 * The layout vocabulary a settings-shaped screen is built from, ported
 * one-to-one from `design/crm/settings.css`.
 *
 * Every section is the same three shapes — a heading block, a card of rows, and
 * a footer holding the save action — so they live here rather than being
 * re-typed per pane. Settings and the profile page are both built from these,
 * which is why this sits at the top of `components/` rather than inside either
 * of them.
 */

/** `.setHead` — the 24px title and its line of secondary copy. */
export function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-[22px]">
      <h2 className="font-sans text-2xl font-medium text-ink-900">{title}</h2>
      <p className="mt-1.5 max-w-[560px] text-base leading-normal text-pretty text-ink-600">
        {sub}
      </p>
    </div>
  );
}

/**
 * The 14px medium heading that labels a group of cards inside a pane.
 *
 * `description` is the one line of secondary copy a group sometimes needs —
 * the tokens table's "Revoking a token takes effect immediately", which used to
 * live in a `CardHeader` the table no longer has. It stays out of the table's
 * own header on purpose: every table header in the app is one row of controls
 * at one height, and a second line of text there would break that.
 */
export function GroupHeading({
  children,
  action,
  description,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-2.5 flex items-center justify-between gap-4', className)}>
      <div className="min-w-0">
        <h3 className="text-base font-medium text-ink-900">{children}</h3>
        {description ? (
          <p className="mt-1 text-sm leading-normal text-ink-600">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/**
 * A card whose children are settings rows.
 *
 * The hairline between rows is declared here rather than on each row, matching
 * the design's `.row + .row` / `.fieldRow + .fieldRow` selectors: a separator
 * belongs to the seam between two rows, so only the parent can see both sides.
 */
export function SectionCard({
  className,
  ...props
}: React.ComponentProps<'div'> & { className?: string }) {
  return (
    <Card
      className={cn(
        'gap-0 py-0',
        '[&_[data-slot=section-row]+[data-slot=section-row]]:border-t [&_[data-slot=section-row]+[data-slot=section-row]]:border-border-subtle',
        '[&_[data-slot=section-field]+[data-slot=section-field]]:border-t [&_[data-slot=section-field]+[data-slot=section-field]]:border-border-subtle',
        className,
      )}
      {...props}
    />
  );
}

/** `.row` — media, a name/description block, and trailing controls. */
export function SectionRow({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="section-row"
      className={cn('flex items-center gap-3.5 px-[18px] py-4', className)}
      {...props}
    />
  );
}

/** `.rowMeta` + `.rowName` + `.rowDesc`. */
export function RowMeta({
  name,
  description,
  className,
}: {
  name: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0 flex-1', className)}>
      <div className="text-base font-medium text-ink-900">{name}</div>
      {description ? (
        <div className="mt-0.5 text-sm leading-[1.45] text-ink-600">{description}</div>
      ) : null}
    </div>
  );
}

/** `.sessIcon` — the 38px bordered tile a row's icon sits in. */
export function RowMedia({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'flex size-[38px] flex-none items-center justify-center rounded-[10px] border border-border-subtle bg-surface-card',
        className,
      )}
      {...props}
    />
  );
}

/** `.rowCtl` — the trailing cluster, never allowed to shrink. */
export function RowControl({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-none items-center gap-2.5', className)} {...props} />;
}

/** `.fieldRow` — a 180px label column beside a capped control column. */
export function FieldRow({
  label,
  hint,
  children,
  className,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="section-field" className={cn('flex items-start gap-6 p-[18px]', className)}>
      <div className="w-[180px] flex-none pt-2.5">
        <div className="text-base font-medium text-ink-900">{label}</div>
        {hint ? <div className="mt-[3px] text-xs leading-[1.45] text-ink-400">{hint}</div> : null}
      </div>
      <div className="min-w-0 max-w-[400px] flex-1">{children}</div>
    </div>
  );
}

/** `.cardFoot` — the sunken strip a card's save action sits in. */
export function CardFoot({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex justify-end gap-2.5 border-t border-border-subtle bg-surface-sunken px-[18px] py-3.5',
        className,
      )}
      {...props}
    />
  );
}

/** `.evtTag` — the quiet pill listing an event name. */
export function EventTag({ children, className, ...props }: React.ComponentProps<'span'>) {
  return (
    <Badge
      variant="neutral"
      className={cn(
        'border border-border-subtle px-[9px] py-[3px] font-mono tracking-wide',
        className,
      )}
      {...props}
    >
      {/* The pill is a flex box, so the ellipsis has to live on a block child;
          truncating the badge itself just clips mid-glyph. */}
      <span className="min-w-0 truncate">{children}</span>
    </Badge>
  );
}

/** `.codeBox` — a single line of copyable, monospaced configuration. */
export function CodeBox({ value, label }: { value: string; label?: string }) {
  return (
    <div className="flex items-center gap-2.5 overflow-hidden rounded-md border border-border-default bg-surface-sunken px-[13px] py-[11px] font-mono text-[12.5px] tracking-wide text-ink-900">
      <span className="min-w-0 flex-1 truncate">{label ?? value}</span>
      <CopyButton value={value} />
    </div>
  );
}

/**
 * `.copyBtn` — copies a value and flips to a check for a beat.
 *
 * The confirmation is the whole point: a clipboard write is silent, so without
 * it there is no way to tell a successful copy from a dead button.
 */
export function CopyButton({ value, label }: { value: string; label?: string }) {
  const { copied, copy } = useCopy();

  return (
    <IconButton
      type="button"
      variant="outline"
      className="size-7 rounded-[7px] border-border-subtle"
      aria-label={label ?? 'Copy'}
      onClick={() => copy(value)}
    >
      {copied ? <Check className="size-3.5 text-status-active" /> : <Copy className="size-3.5" />}
    </IconButton>
  );
}
