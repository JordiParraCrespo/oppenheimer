import { cn, ImageCarousel } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/**
 * The right half of the auth split: the photograph carousel from the MVP
 * screens, in a 28px frame. The frame is the artboard's box (468 by 588,
 * a 4:5 portrait) centred in the column and shrinking with it, never the
 * whole half of the viewport. Purely atmosphere: it is hidden below 900px,
 * where the form takes the full width.
 */
const SLIDES = [
  { file: 'oppenheimer-portrait', key: 'portrait', position: '50% 22%' },
  { file: 'oppenheimer-einstein', key: 'einstein', position: '50% 30%' },
  { file: 'calutron-operators', key: 'calutron', position: '50% 50%' },
  { file: 'oppenheimer-groves', key: 'groves', position: '50% 40%' },
  { file: 'los-alamos-gate', key: 'gate', position: '50% 50%' },
] as const;

export function AuthPanel({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <div className={cn('flex min-h-0 items-center justify-center', className)}>
      <ImageCarousel
        className="aspect-4/5 h-auto max-h-full w-full max-w-117"
        slides={SLIDES.map((slide) => ({
          src: `/imagery/${slide.file}.webp`,
          alt: t(`auth.art.slides.${slide.key}.alt`),
          caption: t(`auth.art.slides.${slide.key}.caption`),
          position: slide.position,
        }))}
      />
    </div>
  );
}
