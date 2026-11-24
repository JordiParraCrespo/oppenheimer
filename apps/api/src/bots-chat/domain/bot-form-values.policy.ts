import {
  BOT_FORM_DATE_PATTERN,
  BOT_FORM_TEXT_MAX,
  BOT_FORM_TEXTAREA_MAX,
  type BotFormField,
  type BotFormSpec,
  type BotFormValue,
  type BotFormValues,
} from '@oppenheimer/shared';

/**
 * What a form's fields take, checked where the shared schema cannot: over
 * the whole form (distinct ids, bounds in order, a default the field takes)
 * and over what the person sent, field by field against the spec. A value
 * is read the way the console sends it: words for every field, a number
 * (or numeric words) for a `number`; blank words are no value.
 */

/** A plain address check: something, an `@`, a domain with a dot. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Whether `YYYY-MM-DD` names a day the calendar has (no 31 February). */
function isCalendarDay(text: string): boolean {
  if (!BOT_FORM_DATE_PATTERN.test(text)) return false;
  const day = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === text;
}

/** The longest words a field takes. */
function textMax(field: BotFormField): number {
  return field.kind === 'textarea' ? BOT_FORM_TEXTAREA_MAX : BOT_FORM_TEXT_MAX;
}

/** Why one value cannot fill this field, or the value as stored. */
function readField(
  field: BotFormField,
  raw: unknown,
): { problem: string } | { value: BotFormValue } {
  const name = `"${field.label}"`;
  const blank = raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '');
  if (blank) return field.required ? { problem: `${name} is required` } : { value: null };
  if (field.kind === 'number') {
    const value =
      typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim()) : NaN;
    if (!Number.isFinite(value)) return { problem: `${name} takes a number` };
    if (field.min !== null && value < field.min)
      return { problem: `${name} is at least ${field.min}` };
    if (field.max !== null && value > field.max)
      return { problem: `${name} is at most ${field.max}` };
    return { value };
  }
  if (typeof raw !== 'string') return { problem: `${name} takes words` };
  const text = raw.trim();
  if (Array.from(text).length > textMax(field)) {
    return { problem: `${name} is longer than ${textMax(field)} characters` };
  }
  if (field.kind === 'email' && !EMAIL.test(text)) return { problem: `${name} takes an address` };
  if (field.kind === 'date' && !isCalendarDay(text)) return { problem: `${name} takes a day` };
  if (field.kind === 'select' && !field.options.includes(text)) {
    return { problem: `${name} takes one of its options` };
  }
  return { value: text };
}

/**
 * Why a form cannot be asked as it stands, in words; null when it can: two
 * fields share an id, a `number` bounds itself the wrong way round, or a
 * default is not a value its field takes.
 */
export function formSpecProblem(spec: BotFormSpec): string | null {
  const seen = new Set<string>();
  for (const field of spec.fields) {
    if (seen.has(field.id)) return `Two fields share the id "${field.id}"`;
    seen.add(field.id);
    if (
      field.kind === 'number' &&
      field.min !== null &&
      field.max !== null &&
      field.min > field.max
    ) {
      return `"${field.label}" has a min above its max`;
    }
    if (field.kind === 'select' && new Set(field.options).size !== field.options.length) {
      return `"${field.label}" lists an option twice`;
    }
    if (field.default !== null) {
      const read = readField({ ...field, required: false }, field.default);
      if ('problem' in read) return `"${field.label}" default does not fit`;
    }
  }
  return null;
}

/**
 * The values a person sent, read against the form: a value for every field
 * (null for one left blank), or why they do not fit. A key the form has no
 * field for is refused rather than dropped, so a stale form cannot pass.
 */
export function formValuesOf(
  spec: BotFormSpec,
  sent: Readonly<Record<string, unknown>>,
): { problem: string } | { values: BotFormValues } {
  const ids = new Set(spec.fields.map((field) => field.id));
  const stray = Object.keys(sent).find((key) => !ids.has(key));
  if (stray !== undefined) return { problem: `The form has no field "${stray}"` };
  const values: BotFormValues = {};
  for (const field of spec.fields) {
    const read = readField(field, sent[field.id]);
    if ('problem' in read) return read;
    values[field.id] = read.value;
  }
  return { values };
}

/** Each field's label and the value sent, in words: empty for a field left blank. */
export function formValuesInWords(
  spec: BotFormSpec,
  values: Readonly<BotFormValues> | null,
): { id: string; label: string; value: string }[] {
  return spec.fields.map((field) => {
    const value = values?.[field.id];
    return {
      id: field.id,
      label: field.label,
      value: value === null || value === undefined ? '' : String(value),
    };
  });
}
