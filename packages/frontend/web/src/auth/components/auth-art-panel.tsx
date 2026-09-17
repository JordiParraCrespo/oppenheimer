import { cn } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/** The check bullet on the aurora panel — a translucent disc with a white tick. */
function CheckDot() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      role="presentation"
      className="shrink-0"
    >
      <circle cx="9" cy="9" r="9" fill="rgba(255,255,255,.22)" />
      <path
        d="M5.2 9.2l2.4 2.4 5.2-5.2"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The right half of the auth split: an aurora gradient with three blurred
 * blobs behind bottom-aligned copy. Purely decorative — it is hidden below
 * 900px, where the form takes the full width.
 */
export function AuthArtPanel({
  className,
  copy = 'consumer',
}: {
  className?: string;
  /** Which product's promise the panel makes: the workspace's or the control plane's. */
  copy?: 'consumer' | 'control';
}) {
  const { t } = useTranslation();

  const features = [
    t(copy === 'control' ? 'control.auth.features.users' : 'auth.art.features.workspaces'),
    t(copy === 'control' ? 'control.auth.features.roles' : 'auth.art.features.team'),
    t(copy === 'control' ? 'control.auth.features.security' : 'auth.art.features.security'),
  ];

  return (
    <div
      className={cn(
        'relative flex flex-col justify-end overflow-hidden p-14',
        'bg-[linear-gradient(135deg,#A7C7FF_0%,#C9B8FF_42%,#FFB6D9_78%,#FFD98A_100%)]',
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute -top-[120px] -left-[90px] size-[420px] rounded-full bg-[#9FD3FF] opacity-75 blur-[46px]"
      />
      <span
        aria-hidden
        className="absolute top-[38%] -right-[100px] size-[360px] rounded-full bg-[#FFC0A8] opacity-75 blur-[46px]"
      />
      <span
        aria-hidden
        className="absolute -bottom-[80px] left-[24%] size-[300px] rounded-full bg-[#C9B8FF] opacity-75 blur-[46px]"
      />

      {/* `font-sans` overrides the design system's display cut for headings:
          this panel is set in the text cut, whose wider letterforms are what
          break the headline over three lines. */}
      <h2 className="relative z-10 mb-4 max-w-[460px] font-sans text-[34px] leading-tight font-medium tracking-[-0.4px] text-white">
        {t(copy === 'control' ? 'control.auth.headline' : 'auth.art.headline')}
      </h2>
      <p className="relative z-10 mb-[30px] max-w-[400px] text-base leading-normal text-white/[0.82]">
        {t(copy === 'control' ? 'control.auth.body' : 'auth.art.body')}
      </p>
      <ul className="relative z-10 flex max-w-[380px] list-none flex-col gap-3.5 p-0">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-[11px] text-base text-white">
            <CheckDot />
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}
