'use client';

import { Toggle as TogglePrimitive } from '@base-ui/react/toggle';
import { ToggleGroup as ToggleGroupPrimitive } from '@base-ui/react/toggle-group';

import {
  type BotFaceParts,
  FACE_EYES,
  FACE_HATS,
  FACE_MOUTHS,
  faceFor,
} from '../internal/bot-face';
import { cn } from '../lib/utils';
import { type AvatarColor, BotAvatar } from './avatar-picker';
import { Button } from './button';

type Part = keyof BotFaceParts;

const PARTS: { part: Part; options: readonly string[] }[] = [
  { part: 'hat', options: FACE_HATS },
  { part: 'eyes', options: FACE_EYES },
  { part: 'mouth', options: FACE_MOUTHS },
];

/**
 * BotFacePicker — a bot's face, on BotSettings' Profile under its colour:
 * three rows, Hat, Eyes and Mouth, each its options drawn as 36px faces
 * that change only that part, in the bot's colour, the worn one ringed in
 * ink with the card's gap inside the ring as the colour swatches are. Arrow
 * keys move along a row. `value` is the face its owner picked; `null` is the
 * one its id (`seed`) picks, which the rows show as worn until a pick, and
 * which Use its own face goes back to. A pick applies at once; the caller
 * saves it.
 */
function BotFacePicker({
  value,
  onValueChange,
  color,
  seed,
  labels,
  optionNames,
  disabled,
  className,
}: {
  value: BotFaceParts | null;
  onValueChange: (value: BotFaceParts | null) => void;
  color: AvatarColor;
  /** The bot's id, which picks the face it wears until its owner picks one. */
  seed: string;
  /** Each row's heading, and the button back to the id's own face; the caller's language. */
  labels: Record<Part, string> & { reset: string };
  /** Each option's accessible name ("Fedora"); the caller's language. */
  optionNames: {
    hat: Record<BotFaceParts['hat'], string>;
    eyes: Record<BotFaceParts['eyes'], string>;
    mouth: Record<BotFaceParts['mouth'], string>;
  };
  disabled?: boolean;
  className?: string;
}) {
  const worn = value ?? faceFor(seed);
  const names = optionNames as Record<Part, Record<string, string>>;
  return (
    <div data-slot="bot-face-picker" className={cn('flex flex-col gap-4', className)}>
      {PARTS.map(({ part, options }) => (
        <div key={part} className="flex flex-col gap-2">
          <span className="text-[12px] text-fg-muted">{labels[part]}</span>
          <ToggleGroupPrimitive
            value={[worn[part]]}
            disabled={disabled}
            onValueChange={(next) => {
              const picked = next.find((v) => v !== worn[part]);
              if (typeof picked === 'string' && options.includes(picked)) {
                onValueChange({ ...worn, [part]: picked } as BotFaceParts);
              }
            }}
            aria-label={labels[part]}
            className="flex flex-wrap gap-3"
          >
            {options.map((option) => (
              <TogglePrimitive
                key={option}
                value={option}
                aria-label={names[part][option]}
                title={names[part][option]}
                className={cn(
                  'rounded-sm outline-none transition-shadow duration-instant focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
                  'data-pressed:shadow-[0_0_0_2px_var(--card),0_0_0_4px_var(--fg)]',
                )}
              >
                <BotAvatar
                  option={{ initials: '' }}
                  size={36}
                  face={{ color, seed, parts: { ...worn, [part]: option } as BotFaceParts }}
                />
              </TogglePrimitive>
            ))}
          </ToggleGroupPrimitive>
        </div>
      ))}
      {value ? (
        <div>
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onValueChange(null)}>
            {labels.reset}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export { BotFacePicker };
