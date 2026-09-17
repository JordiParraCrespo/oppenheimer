import { Avatar, AvatarFallback, AvatarImage } from '@oppenheimer/design-system-web';

/** The 64px preview tile, falling back to the initial. */
export function LogoPreview({ src, name }: { src: string | null; name: string }) {
  return (
    <Avatar
      size={64}
      className="flex-none rounded-[14px] border border-border-default bg-card after:rounded-[14px]"
    >
      {src && <AvatarImage src={src} alt="" className="rounded-[14px] object-contain" />}
      <AvatarFallback className="rounded-[14px] bg-card text-xl font-medium text-ink-400">
        {name.trim().charAt(0).toUpperCase() || '—'}
      </AvatarFallback>
    </Avatar>
  );
}
