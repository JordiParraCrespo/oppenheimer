import { BOT_PROVIDER_CATALOG, type BotProvider } from '@oppenheimer/shared';

/**
 * How a bot names a model in a tool's input or its answer: by its catalog id
 * or by the label the model button shows ("Opus 5.5"), matched without case
 * or surrounding spaces. One rule for every field that takes a model (the
 * bot's model, its advisor), so they cannot drift apart.
 */

/**
 * The id of the `provider` model `asked` names, by id or label; only among
 * `among` when given (a model's advisors). Undefined when none matches.
 */
export function modelNamed(
  provider: BotProvider,
  asked: string,
  among?: readonly string[],
): string | undefined {
  const wanted = asked.trim().toLowerCase();
  return BOT_PROVIDER_CATALOG[provider].models.find(
    (row) =>
      (among === undefined || among.includes(row.id)) &&
      (row.id.toLowerCase() === wanted || row.label.toLowerCase() === wanted),
  )?.id;
}

/** The label the model button shows for `id`, or the id itself when the catalog has none. */
export function modelLabel(provider: BotProvider, id: string): string {
  return BOT_PROVIDER_CATALOG[provider].models.find((row) => row.id === id)?.label ?? id;
}
