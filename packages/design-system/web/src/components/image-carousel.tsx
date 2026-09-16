'use client';

import * as React from 'react';

import { cn } from '../lib/utils';

/**
 * ImageCarousel — the photo panel beside the auth forms: a 28px-radius frame,
 * slides cross-fading over 700ms every 5.2s, a caption per slide, and pill
 * dots that also jump to a slide. Autoplay pauses on hover and focus and stops
 * under reduced motion. The caption sits on a bottom scrim so it reads over any
 * photograph; that scrim is the system's one sanctioned gradient.
 *
 * The system ships no illustration and invents none: these are the historical
 * photographs from the design export, product-on-void, cool neutral grade.
 */
type CarouselSlide = {
  src: string;
  alt: string;
  caption?: React.ReactNode;
  /** CSS object-position for the crop ("50% 22%"). */
  position?: string;
};

function ImageCarousel({
  slides,
  interval = 5200,
  className,
  ...props
}: React.ComponentProps<'figure'> & { slides: CarouselSlide[]; interval?: number }) {
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    if (paused || slides.length < 2) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), interval);
    return () => clearInterval(id);
  }, [paused, slides.length, interval]);

  const current = slides[index] ?? slides[0];

  return (
    <figure
      data-slot="image-carousel"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn('relative m-0 h-full min-h-[360px] w-full overflow-hidden rounded-xl bg-[var(--op-gray-900)]', className)}
      {...props}
    >
      {slides.map((slide, i) => (
        // biome-ignore lint/performance/noImgElement: plain img keeps the package framework-free
        <img
          key={slide.src}
          src={slide.src}
          alt={i === index ? slide.alt : ''}
          aria-hidden={i !== index}
          draggable={false}
          style={{ objectPosition: slide.position }}
          className={cn(
            'absolute inset-0 size-full object-cover transition-opacity duration-700 ease-standard',
            i === index ? 'opacity-100' : 'opacity-0',
          )}
        />
      ))}
      <figcaption className="absolute inset-x-0 bottom-0 flex flex-col gap-3 bg-gradient-to-t from-black/55 to-transparent px-6 pt-16 pb-5">
        {current?.caption ? (
          <p className="m-0 text-sm text-white" aria-live="polite">
            {current.caption}
          </p>
        ) : null}
        {slides.length > 1 ? (
          <div className="flex gap-1.5" role="tablist" aria-label="Slides">
            {slides.map((slide, i) => (
              <button
                key={slide.src}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn(
                  'h-[3px] w-[22px] rounded-pill transition-colors duration-base',
                  i === index ? 'bg-white' : 'bg-white/35 hover:bg-white/60',
                )}
              />
            ))}
          </div>
        ) : null}
      </figcaption>
    </figure>
  );
}

export { ImageCarousel };
export type { CarouselSlide };
