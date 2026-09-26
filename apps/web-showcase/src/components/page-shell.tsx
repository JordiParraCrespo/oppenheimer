import { Card } from '@oppenheimer/design-system-web/card';

/**
 * The main column, on the export's 1040px content measure. Side padding steps
 * 16 → 32 → 48 with the viewport. Carries the id the sidebar's scroll-spy
 * observes, since this element, not the window, is what scrolls.
 */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main
      id="main-scroll"
      className="min-h-0 flex-1 overflow-y-auto px-4 pt-8 pb-24 sm:px-8 sm:pt-11 lg:px-12"
    >
      <div className="mx-auto max-w-(--content-max)">{children}</div>
    </main>
  );
}

/** The page title at h1 over a lead line in the muted colour. */
export function PageHead({
  eyebrow,
  title,
  sub,
  action,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-60 flex-[1_1_320px]">
        {eyebrow ? <div className="eyebrow mb-3">{eyebrow}</div> : null}
        <h1 className="text-3xl font-semibold text-balance">{title}</h1>
        {sub ? <p className="mt-3 max-w-[60ch] text-lg text-pretty text-fg-muted">{sub}</p> : null}
      </div>
      {action ? <div className="flex-none">{action}</div> : null}
    </div>
  );
}

/** A group heading between families of specs: the 11px eyebrow over a hairline. */
export function GroupHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-24 mb-10 flex items-center gap-4 first:mt-0">
      <span className="eyebrow">{children}</span>
      <span className="h-px flex-1 bg-border-subtle" />
    </div>
  );
}

/**
 * Spec — one entry in the inventory: an h2 with its import path in mono, a
 * description, then the live demo on the canvas inside a flat card. `code`
 * adds a usage line in a hairline-divided footer. `bare` drops the card for a
 * demo that is itself a surface (the sidebar, the terminal).
 */
export function Spec({
  id,
  title,
  meta,
  desc,
  code,
  bare,
  children,
}: {
  id: string;
  title: string;
  meta?: string;
  desc?: string;
  code?: string;
  bare?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-16 scroll-mt-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-2xl font-semibold">{title}</h2>
        {meta ? <span className="figures text-xs text-fg-subtle">{meta}</span> : null}
      </div>
      {desc ? <p className="mt-2 max-w-[68ch] text-base text-pretty text-fg-muted">{desc}</p> : null}
      {bare ? (
        <div className="mt-5">{children}</div>
      ) : (
        <Card className="mt-5">
          <div className="flex flex-wrap items-start gap-6 p-5 sm:gap-8 sm:p-7">{children}</div>
          {code ? (
            <div className="border-t border-border-subtle px-5 py-3">
              <code className="figures text-xs whitespace-pre-wrap text-fg-muted">{code}</code>
            </div>
          ) : null}
        </Card>
      )}
    </section>
  );
}

/** A labelled specimen inside a Spec. */
export function Swatch({
  label,
  width,
  children,
}: {
  label?: string;
  width?: number | string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-2.5" style={width ? { width } : undefined}>
      <div className="flex min-h-10 items-center">{children}</div>
      {label ? <span className="text-xs text-fg-subtle">{label}</span> : null}
    </div>
  );
}

/**
 * Both themes side by side. The dark half is a `.dark` scope, so the same
 * markup re-themes through the aliases alone, which is the point being shown.
 */
export function ThemePair({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid w-full gap-4 md:grid-cols-2 ${className ?? ''}`}>
      <div className="rounded-lg border border-border-subtle bg-canvas p-5">{children}</div>
      <div className="dark rounded-lg border border-border-subtle bg-canvas p-5 text-fg">
        {children}
      </div>
    </div>
  );
}
