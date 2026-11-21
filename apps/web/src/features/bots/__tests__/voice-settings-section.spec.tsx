import { DEFAULT_VOICE_SETTINGS, type VoiceSettingsDto } from '@oppenheimer/shared/schemas/voice';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VoiceSettingsSection } from '../sections/voice-settings';

/**
 * Settings → Model providers, Voice. What breaks this: a row offering a
 * provider the workspace has no key for as if it worked, a model select on a
 * provider that takes none (ChatGPT, this server), or the voice select gone
 * when the voice-note provider has voices to pick.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      values ? `${key} ${Object.values(values).join(' ')}` : key,
  }),
}));

const state = vi.hoisted(() => ({ data: null as unknown as VoiceSettingsDto }));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useSuspenseVoiceSettings: () => ({ data: state.data }),
  useUpdateVoiceSettings: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
}));

vi.mock('@oppenheimer/frontend-web', () => ({
  ErrorAlert: () => null,
  useZodResolver: () => undefined,
}));

vi.mock('@oppenheimer/design-system-web', async (original) => ({
  ...(await original<object>()),
  FieldSelect: ({
    'aria-label': label,
    value,
    options,
  }: {
    'aria-label': string;
    value: string | null;
    options: { value: string; label: string }[];
  }) => (
    <div role="listbox" aria-label={label} data-value={value ?? ''}>
      {options.map((option) => (
        <span key={option.value}>{option.label}</span>
      ))}
    </div>
  ),
}));

const available: VoiceSettingsDto['available'] = {
  transcription: ['chatgpt', 'openai'],
  synthesis: ['openai', 'speech_key'],
  polish: ['openai', 'chatgpt'],
};

afterEach(cleanup);

describe('VoiceSettingsSection', () => {
  it('offers Automatic and the providers available now, and no model where a provider takes none', () => {
    state.data = { ...DEFAULT_VOICE_SETTINGS, transcriptionProvider: 'chatgpt', available };
    render(<VoiceSettingsSection />);

    const row = screen.getByTestId('voice-transcription');
    const provider = within(row).getByRole('listbox', {
      name: 'settings.modelProviders.voice.transcription.providerLabel',
    });
    expect(provider.dataset.value).toBe('chatgpt');
    expect(
      within(provider)
        .getAllByText(/./)
        .map((option) => option.textContent),
    ).toEqual(['settings.modelProviders.voice.automatic', 'ChatGPT', 'OpenAI']);
    expect(
      within(row).queryByRole('listbox', {
        name: 'settings.modelProviders.voice.transcription.modelLabel',
      }),
    ).toBeNull();
  });

  it('keeps a chosen provider whose key is gone, said as not connected', () => {
    state.data = { ...DEFAULT_VOICE_SETTINGS, transcriptionProvider: 'groq', available };
    render(<VoiceSettingsSection />);
    expect(
      within(screen.getByTestId('voice-transcription')).getByText(
        'settings.modelProviders.voice.notConnected Groq',
      ),
    ).toBeTruthy();
  });

  it("shows the voice-note provider's model and voice, its defaults until chosen", () => {
    state.data = { ...DEFAULT_VOICE_SETTINGS, synthesisProvider: 'openai', available };
    render(<VoiceSettingsSection />);
    const row = screen.getByTestId('voice-synthesis');
    expect(
      within(row).getByRole('listbox', {
        name: 'settings.modelProviders.voice.synthesis.modelLabel',
      }).dataset.value,
    ).toBe('gpt-4o-mini-tts');
    expect(
      within(row).getByRole('listbox', {
        name: 'settings.modelProviders.voice.synthesis.voiceLabel',
      }).dataset.value,
    ).toBe('alloy');
  });
});
