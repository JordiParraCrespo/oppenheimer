/**
 * What the speech model is told before it hears a clip, and what it is not
 * believed about after (`product/next-steps/voice.md`, step 1).
 */

/**
 * Names every dictation here may say, whatever the screen: the product, the
 * agents and the tools around them. Speech models hear them as common words
 * ("cloud code", "codecs", "team ux") without a hint.
 */
const ALWAYS_SAID = ['Oppenheimer', 'Claude Code', 'Codex', 'ChatGPT', 'GitHub', 'tmux'];

/**
 * The longest hint sent. Whisper reads only the last 224 tokens of its
 * prompt; names run about three characters a token, so this keeps all of it
 * in reach on every OpenAI-compatible server.
 */
const SPEECH_PROMPT_MAX = 600;

/**
 * The `prompt` an OpenAI-compatible `/audio/transcriptions` takes: the
 * screen's names first, then {@link ALWAYS_SAID}, comma-separated and cut
 * at a whole name. A list of names rather than a sentence, because a
 * sentence in one language pulls the model towards transcribing in it, and
 * dictation here is Spanish, Catalan and English, often in one breath.
 */
export function speechPrompt(vocabulary: readonly string[]): string {
  const names: string[] = [];
  const seen = new Set<string>();
  let length = 0;
  for (const name of [...vocabulary, ...ALWAYS_SAID]) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    const added = name.length + (names.length ? 2 : 0);
    if (length + added > SPEECH_PROMPT_MAX) break;
    seen.add(key);
    names.push(name);
    length += added;
  }
  return names.join(', ');
}

/**
 * What Whisper-class models write when they hear silence or noise: the
 * subtitle credits and video sign-offs they were trained on. None is
 * something a person dictates into a prompt, so each is dropped wherever it
 * closes a transcript. "Thank you" and "gracias" are not here: a person
 * does say those to a bot.
 */
const SILENCE_HALLUCINATIONS = [
  'subt[ií]tulos? (?:realizados? )?por la comunidad de amara\\.org',
  "subt[ií]tols? (?:realitzats? )?per la comunitat d'amara\\.org",
  'subtitles? by the amara\\.org community',
  '(?:thanks|thank you)(?: so much)? for watching',
  '(?:please|like and) subscribe(?: to (?:my|the|our) channel)?',
  'gracias por ver (?:el|este) v[ií]deo',
  '¡?suscr[ií]bete al canal',
  '[♪♫]+',
];

/**
 * Any one of {@link SILENCE_HALLUCINATIONS} closing the text: at its start or
 * after a space or a mark, with only punctuation after it.
 */
const HALLUCINATED_ENDING = new RegExp(
  `(?:^|(?<=[\\s.,!?¡¿]))(?:${SILENCE_HALLUCINATIONS.join('|')})[\\s.,!?]*$`,
  'i',
);

/**
 * The transcript without what the model made up from silence: each known
 * hallucination is dropped from the end, as often as they stack, and a
 * transcript that was only that is empty.
 */
export function withoutSilenceHallucinations(raw: string): string {
  let text = raw.trim();
  for (let match = HALLUCINATED_ENDING.exec(text); match; match = HALLUCINATED_ENDING.exec(text)) {
    text = text.slice(0, match.index).trim();
  }
  return text;
}
