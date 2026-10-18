import { describe, expect, it } from 'vitest';
import { cleanPolished, needsPolish, voicePolishMessage } from '../domain/voice-polish.policy';

/**
 * The polish's rules that are not the model's: when a transcript is worth a
 * call, what the model is sent, and which answers are a tidied transcript
 * rather than the model doing something else with it.
 */
describe('voice polish policy', () => {
  it('skips the call for a short, clean dictation, and not for one with fillers or a correction', () => {
    expect(needsPolish('')).toBe(false);
    expect(needsPolish('fix the login page')).toBe(false);
    expect(needsPolish('um fix the login page')).toBe(true);
    expect(needsPolish('fix the login, no wait, the signup page')).toBe(true);
    expect(needsPolish('fix the login redirect loop that sends people back to the start')).toBe(
      true,
    );
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
