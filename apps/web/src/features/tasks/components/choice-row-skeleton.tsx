import { Chip, Skeleton } from '@oppenheimer/design-system-web';

/**
 * A `ChoiceRow` before its choices answer: the label written in the left
 * column at the field height, the choices that need no data written as
 * unpicked pills (`written`), and a pill bar for each one the read answers.
 */
export function ChoiceRowSkeleton({
  label,
  written = [],
  widths = [],
}: {
  label: string;
  written?: readonly string[];
  widths?: readonly string[];
}) {
  return (
    <div className="grid grid-cols-[96px_1fr] items-start gap-3">
      <span className="flex h-(--control-h-md) items-center text-sm text-fg-muted">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {written.map((choice) => (
          <Chip key={choice} variant="solid" size="md">
            {choice}
          </Chip>
        ))}
        {widths.map((width, index) => (
          <Skeleton
            // biome-ignore lint/suspicious/noArrayIndexKey: a pill's place is its identity.
            key={index}
            shape="pill"
            className={`h-(--control-h-md) ${width}`}
          />
        ))}
      </div>
    </div>
  );
}
