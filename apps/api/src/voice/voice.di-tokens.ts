export const CHATGPT_SPEECH = Symbol('CHATGPT_SPEECH');
export const KEYED_SPEECH = Symbol('KEYED_SPEECH');
/** The bot engine the polish runs on a ChatGPT sign-in with (`@oppenheimer/backend-agents`). */
export const VOICE_POLISH_ENGINE = Symbol('VOICE_POLISH_ENGINE');
/** The `LlmService` a clip's polish runs on (`PolishLlmPort`). */
export const POLISH_LLM = Symbol('POLISH_LLM');
/** The deployment's text-to-speech server (`SpeechSynthesisPort`). */
export const SPEECH_SYNTHESIS = Symbol('SPEECH_SYNTHESIS');
/** Speech on a workspace's own OpenAI key (`OpenAiSpeechPort`). */
export const OPENAI_SPEECH = Symbol('OPENAI_SPEECH');
/** Transcription on a workspace's own Groq key (`GroqSpeechPort`). */
export const GROQ_SPEECH = Symbol('GROQ_SPEECH');
/** Speech on a workspace's own ElevenLabs key (`ElevenlabsSpeechPort`). */
export const ELEVENLABS_SPEECH = Symbol('ELEVENLABS_SPEECH');
/** The workspace's voice choices (`VoiceSettingsRepositoryPort`). */
export const VOICE_SETTINGS_REPOSITORY = Symbol('VOICE_SETTINGS_REPOSITORY');
/** What spoken audio sounds like once decoded (`SpokenAudioPort`). */
export const SPOKEN_AUDIO = Symbol('SPOKEN_AUDIO');
