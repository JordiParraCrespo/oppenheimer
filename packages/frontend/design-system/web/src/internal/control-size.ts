/**
 * A field's box on each rung of the control ramp (`--control-h-*`): height,
 * side padding and type. `Input` draws it, and every trigger that stands in a
 * form beside one (`DatePicker`, `FieldSelect`'s field look) takes the same
 * classes, so the three never disagree on a rung.
 */
export const FIELD_SIZE = {
  sm: 'h-(--control-h-sm) px-2.5 text-sm',
  md: 'h-(--control-h-md) px-3 text-operate',
  lg: 'h-(--control-h-lg) px-3.5 text-lg',
} as const;

export type FieldSize = keyof typeof FIELD_SIZE;
