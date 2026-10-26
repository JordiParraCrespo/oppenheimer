import { describe, expect, it } from 'vitest';
import {
  cleanPolished,
  VOICE_POLISH_SYSTEM_PROMPT,
  voicePolishMessage,
} from '../domain/voice-polish.policy';

/**
 * The polish's rules that are not the model's: what the model is sent, and
 * which answers are a tidied transcript rather than the model doing
 * something else with it. What the model makes of the brief is the eval's
 * (`scripts/evals/voice/`).
 */
describe('voice polish policy', () => {
  it("opens with the line the local stack's stub recognises the polish by", () => {
    // e2e/support/namer-stub.ts tidies a request whose brief starts this way and names any other.
    expect(VOICE_POLISH_SYSTEM_PROMPT.startsWith('You turn dictated speech')).toBe(true);
  });

  it('quotes the fillers and spoken commands of every language dictated here', () => {
    for (const word of ['"um"', '"o sea"', '"doncs"', '"punto y aparte"', '"punt i a part"']) {
      expect(VOICE_POLISH_SYSTEM_PROMPT).toContain(word);
    }
  });

  it('sends the transcript and the vocabulary fenced off as data', () => {
    expect(voicePolishMessage('fix it', ['oppenheimer', 'apps/web'])).toBe(
      '<vocabulary>\noppenheimer\napps/web\n</vocabulary>\n\n<transcript>\nfix it\n</transcript>',
    );
    expect(voicePolishMessage('fix it', [])).toBe('<transcript>\nfix it\n</transcript>');
  });

  it('keeps a tidied answer, unwrapping fences and quotes the model added', () => {
    expect(cleanPolished('Fix the login page.', 'um fix the login page')).toBe(
      'Fix the login page.',
    );
    expect(cleanPolished('<transcript>\nFix it.\n</transcript>', 'uh fix it')).toBe('Fix it.');
    expect(cleanPolished('"Fix it."', 'uh fix it')).toBe('Fix it.');
  });

  it('drops an empty answer, and one so much longer than what was said that it answered instead', () => {
    expect(cleanPolished('  ', 'um fix it')).toBeNull();
    expect(cleanPolished('Sure! Here is a plan. '.repeat(10), 'um fix it')).toBeNull();
  });
});
