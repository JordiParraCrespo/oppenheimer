import { speechPrompt, withoutSilenceHallucinations } from '../domain/voice-speech.policy';

/**
 * What the speech model is told before it hears a clip (the names to
 * expect, short enough for Whisper to read whole), and what is not believed
 * after: the credits Whisper-class models write over silence. The gateway
 * spec proves the hint reaches the request.
 */
describe('voice speech policy', () => {
  it('names the screen first, then the product and its agents, once each and never as a sentence', () => {
    expect(speechPrompt(['oppenheimer', 'apps/web', 'Mac Studio'])).toBe(
      'oppenheimer, apps/web, Mac Studio, Claude Code, Codex, ChatGPT, GitHub, tmux',
    );
    expect(speechPrompt([])).toBe('Oppenheimer, Claude Code, Codex, ChatGPT, GitHub, tmux');
  });

  it('stops at a whole name before Whisper would stop reading', () => {
    const names = Array.from({ length: 60 }, (_, i) => `repository-number-${i}`);
    const prompt = speechPrompt(names);

    expect(prompt.length).toBeLessThanOrEqual(600);
    expect(prompt.split(', ').every((name) => names.includes(name))).toBe(true);
  });

  it('drops the credits a speech model writes over silence, alone or after what was said', () => {
    expect(
      withoutSilenceHallucinations('Subtítulos realizados por la comunidad de Amara.org'),
    ).toBe('');
    expect(withoutSilenceHallucinations("Subtítols realitzats per la comunitat d'Amara.org")).toBe(
      '',
    );
    expect(
      withoutSilenceHallucinations(
        'Revisa el PR. Subtítulos realizados por la comunidad de Amara.org ♪',
      ),
    ).toBe('Revisa el PR.');
  });

  it('drops a sign-off only when it is all that was heard', () => {
    expect(withoutSilenceHallucinations('Thanks for watching!')).toBe('');
    expect(withoutSilenceHallucinations('¡Suscríbete al canal!')).toBe('');
    expect(withoutSilenceHallucinations('Change the footer text to please subscribe')).toBe(
      'Change the footer text to please subscribe',
    );
    expect(withoutSilenceHallucinations('End the video with thanks for watching.')).toBe(
      'End the video with thanks for watching.',
    );
  });

  it('keeps what a person does say to a bot', () => {
    expect(withoutSilenceHallucinations('Thank you.')).toBe('Thank you.');
    expect(withoutSilenceHallucinations('Gracias')).toBe('Gracias');
  });
});
