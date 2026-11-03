import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { createBotEngine } from '@oppenheimer/backend-agents';
import { BotsModule } from '../bots/bots.module';
import { ChatgptSpeechResolver } from './application/chatgpt-speech.resolver';
import { SpeechKeyResolver } from './application/speech-key.resolver';
import { SpeechProviderRegistry } from './application/speech-provider.registry';
import { VoicePolishResolver } from './application/voice-polish.resolver';
import { VoiceTranscriptionResolver } from './application/voice-transcription.resolver';
import { StartVoiceLiveCommandHandler } from './commands/start-voice-live/start-voice-live.command-handler';
import { StartVoiceLiveHttpController } from './commands/start-voice-live/start-voice-live.http.controller';
import { TranscribeVoiceCommandHandler } from './commands/transcribe-voice/transcribe-voice.command-handler';
import { TranscribeVoiceHttpController } from './commands/transcribe-voice/transcribe-voice.http.controller';
import { ChatgptSpeechGateway } from './infrastructure/chatgpt-speech.gateway';
import { OpenAiCompatibleSpeechGateway } from './infrastructure/openai-compatible-speech.gateway';
import { OpenAiLiveSpeechGateway } from './infrastructure/openai-live-speech.gateway';
import { PolishLlmAdapter } from './infrastructure/polish-llm.adapter';
import { FindVoiceStatusHttpController } from './queries/find-voice-status/find-voice-status.http.controller';
import { FindVoiceStatusQueryHandler } from './queries/find-voice-status/find-voice-status.query-handler';
import {
  CHATGPT_SPEECH,
  KEYED_SPEECH,
  LIVE_SPEECH,
  POLISH_LLM,
  VOICE_POLISH_ENGINE,
} from './voice.di-tokens';

/**
 * Dictation (`product/next-steps/voice.md`): a recording in, the text it
 * says out. It owns no table and keeps nothing. Who hears a recording is
 * `SpeechProviderRegistry`: an ordered list of `SpeechProvider`s, today the
 * workspace's ChatGPT sign-in (the bots module's, read through its
 * `TURN_CREDENTIALS`) and the deployment's own speech server (`VOICE_STT_*`).
 * Live dictation (`POST /voice/live`) mints a realtime session on the
 * deployment's OpenAI key (`VOICE_LIVE_*`) for the console to stream into.
 */
@Module({
  imports: [CqrsModule, BotsModule],
  controllers: [
    TranscribeVoiceHttpController,
    StartVoiceLiveHttpController,
    FindVoiceStatusHttpController,
  ],
  providers: [
    TranscribeVoiceCommandHandler,
    StartVoiceLiveCommandHandler,
    FindVoiceStatusQueryHandler,
    VoiceTranscriptionResolver,
    ChatgptSpeechResolver,
    SpeechKeyResolver,
    // The providers, in the order a dictation tries them. A new one is a
    // `SpeechProvider` class, its id in `VOICE_PROVIDERS`, and a place here.
    {
      provide: SpeechProviderRegistry,
      inject: [ChatgptSpeechResolver, SpeechKeyResolver],
      useFactory: (chatgpt: ChatgptSpeechResolver, key: SpeechKeyResolver) =>
        new SpeechProviderRegistry([chatgpt, key]),
    },
    VoicePolishResolver,
    { provide: CHATGPT_SPEECH, useClass: ChatgptSpeechGateway },
    { provide: KEYED_SPEECH, useClass: OpenAiCompatibleSpeechGateway },
    { provide: LIVE_SPEECH, useClass: OpenAiLiveSpeechGateway },
    { provide: VOICE_POLISH_ENGINE, useFactory: () => createBotEngine() },
    { provide: POLISH_LLM, useClass: PolishLlmAdapter },
  ],
})
export class VoiceModule {}
