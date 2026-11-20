import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { createBotEngine } from '@oppenheimer/backend-agents';
import { BotsModule } from '../bots/bots.module';
import { ChatgptSpeechResolver } from './application/chatgpt-speech.resolver';
import { SpeechKeyResolver } from './application/speech-key.resolver';
import { SpeechProviderRegistry } from './application/speech-provider.registry';
import { VoicePolishResolver } from './application/voice-polish.resolver';
import { VoiceTranscriptionResolver } from './application/voice-transcription.resolver';
import { SynthesizeSpeechCommandHandler } from './commands/synthesize-speech/synthesize-speech.command-handler';
import { TranscribeVoiceCommandHandler } from './commands/transcribe-voice/transcribe-voice.command-handler';
import { TranscribeVoiceHttpController } from './commands/transcribe-voice/transcribe-voice.http.controller';
import { ChatgptSpeechGateway } from './infrastructure/chatgpt-speech.gateway';
import { OpenAiCompatibleSpeechGateway } from './infrastructure/openai-compatible-speech.gateway';
import { OpenAiCompatibleSpeechSynthesisGateway } from './infrastructure/openai-compatible-speech-synthesis.gateway';
import { PolishLlmAdapter } from './infrastructure/polish-llm.adapter';
import { FindSpeechSynthesisQueryHandler } from './queries/find-speech-synthesis/find-speech-synthesis.query-handler';
import { FindVoiceStatusHttpController } from './queries/find-voice-status/find-voice-status.http.controller';
import { FindVoiceStatusQueryHandler } from './queries/find-voice-status/find-voice-status.query-handler';
import {
  CHATGPT_SPEECH,
  KEYED_SPEECH,
  POLISH_LLM,
  SPEECH_SYNTHESIS,
  VOICE_POLISH_ENGINE,
} from './voice.di-tokens';

/**
 * Dictation: a recording in, the text it says out; and the other way, a short
 * text spoken as a voice note for a bot (`SynthesizeSpeechCommand`, on the
 * deployment's `VOICE_TTS_*` server). It owns no table and keeps nothing. Who hears a recording is `SpeechProviderRegistry`: an ordered list
 * of `SpeechProvider`s, today the workspace's ChatGPT sign-in (the bots
 * module's, read through its `TURN_CREDENTIALS`) and the deployment's own
 * speech server (`VOICE_STT_*`).
 */
@Module({
  imports: [CqrsModule, BotsModule],
  controllers: [TranscribeVoiceHttpController, FindVoiceStatusHttpController],
  providers: [
    TranscribeVoiceCommandHandler,
    FindVoiceStatusQueryHandler,
    SynthesizeSpeechCommandHandler,
    FindSpeechSynthesisQueryHandler,
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
    { provide: SPEECH_SYNTHESIS, useClass: OpenAiCompatibleSpeechSynthesisGateway },
    { provide: VOICE_POLISH_ENGINE, useFactory: () => createBotEngine() },
    { provide: POLISH_LLM, useClass: PolishLlmAdapter },
  ],
})
export class VoiceModule {}
