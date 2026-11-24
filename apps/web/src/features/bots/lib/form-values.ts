import type { BotFormSpec, BotFormValues } from '@oppenheimer/shared/schemas/bot';

/** What a form's inputs start with: each field's default in words, or nothing. */
export function formInputDefaults(spec: BotFormSpec): Record<string, string> {
  return Object.fromEntries(
    spec.fields.map((field) => [field.id, field.default === null ? '' : String(field.default)]),
  );
}

/** The inputs as the API takes them: a number for a number field, null for a blank. */
export function formValuesOf(spec: BotFormSpec, input: Record<string, string>): BotFormValues {
  return Object.fromEntries(
    spec.fields.map((field) => {
      const text = (input[field.id] ?? '').trim();
      if (text === '') return [field.id, null];
      return [field.id, field.kind === 'number' ? Number(text) : text];
    }),
  );
}
