import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createBotEngine } from '@oppenheimer/backend-agents';
import { BotsModule } from '../bots/bots.module';
import { ChatgptSpeechResolver } from './application/chatgpt-speech.resolver';
import { ElevenlabsSpeechResolver } from './application/elevenlabs-speech.resolver';
import { ElevenlabsSynthesisResolver } from './application/elevenlabs-synthesis.resolver';
import { GroqSpeechResolver } from './application/groq-speech.resolver';
import { OpenAiSpeechResolver } from './application/openai-speech.resolver';
import { OpenAiSynthesisResolver } from './application/openai-synthesis.resolver';
import { PolishModelResolver } from './application/polish-model.resolver';
import { SpeechKeyResolver } from './application/speech-key.resolver';
import { SpeechKeySynthesisResolver } from './application/speech-key-synthesis.resolver';
import { SpeechProviderRegistry } from './application/speech-provider.registry';
import { SynthesisProviderRegistry } from './application/synthesis-provider.registry';
import { VoicePolishResolver } from './application/voice-polish.resolver';
import { VoiceSynthesisResolver } from './application/voice-synthesis.resolver';
import { VoiceTranscriptionResolver } from './application/voice-transcription.resolver';
import { SynthesizeSpeechCommandHandler } from './commands/synthesize-speech/synthesize-speech.command-handler';
import { TranscribeVoiceCommandHandler } from './commands/transcribe-voice/transcribe-voice.command-handler';
import { TranscribeVoiceHttpController } from './commands/transcribe-voice/transcribe-voice.http.controller';
import { UpdateVoiceSettingsCommandHandler } from './commands/update-voice-settings/update-voice-settings.command-handler';
import { UpdateVoiceSettingsHttpController } from './commands/update-voice-settings/update-voice-settings.http.controller';
import { VoiceSettingsOrmEntity } from './database/voice-settings.orm-entity';
import { VoiceSettingsRepository } from './database/voice-settings.repository';
import { ChatgptSpeechGateway } from './infrastructure/chatgpt-speech.gateway';
import { ElevenlabsSpeechGateway } from './infrastructure/elevenlabs-speech.gateway';
import { GroqSpeechGateway } from './infrastructure/groq-speech.gateway';
import { OpenAiCompatibleSpeechGateway } from './infrastructure/openai-compatible-speech.gateway';
import { OpenAiCompatibleSpeechSynthesisGateway } from './infrastructure/openai-compatible-speech-synthesis.gateway';
import { OpenAiSpeechGateway } from './infrastructure/openai-speech.gateway';
import { PolishLlmAdapter } from './infrastructure/polish-llm.adapter';
import { FindSpeechSynthesisQueryHandler } from './queries/find-speech-synthesis/find-speech-synthesis.query-handler';
import { FindVoiceSettingsHttpController } from './queries/find-voice-settings/find-voice-settings.http.controller';
import { FindVoiceSettingsQueryHandler } from './queries/find-voice-settings/find-voice-settings.query-handler';
import { FindVoiceStatusHttpController } from './queries/find-voice-status/find-voice-status.http.controller';
import { FindVoiceStatusQueryHandler } from './queries/find-voice-status/find-voice-status.query-handler';
import {
  CHATGPT_SPEECH,
  ELEVENLABS_SPEECH,
  GROQ_SPEECH,
  KEYED_SPEECH,
  OPENAI_SPEECH,
  POLISH_LLM,
  SPEECH_SYNTHESIS,
  VOICE_POLISH_ENGINE,
  VOICE_SETTINGS_REPOSITORY,
} from './voice.di-tokens';

/**
 * Dictation: a recording in, the text it says out; and the other way, a short
 * text spoken as a voice note for a bot (`SynthesizeSpeechCommand`). Who hears
 * a recording is `SpeechProviderRegistry`, who speaks a note
 * `SynthesisProviderRegistry`: ordered lists of the workspace's own
 * credentials (Settings → Model providers, read through the bots module's
 * `TURN_CREDENTIALS`) and the deployment's own servers (`VOICE_STT_*`,
 * `VOICE_TTS_*`). The one table it owns is `voice_settings`, the workspace's
 * choice of provider, model and voice for each, and of the polish's model.
 * The audio and the transcript are never kept.
 */
@Module({
  imports: [CqrsModule, BotsModule, TypeOrmModule.forFeature([VoiceSettingsOrmEntity])],
  controllers: [
    TranscribeVoiceHttpController,
    FindVoiceStatusHttpController,
    FindVoiceSettingsHttpController,
    UpdateVoiceSettingsHttpController,
  ],
  providers: [
    TranscribeVoiceCommandHandler,
    FindVoiceStatusQueryHandler,
    SynthesizeSpeechCommandHandler,
    FindSpeechSynthesisQueryHandler,
    FindVoiceSettingsQueryHandler,
    UpdateVoiceSettingsCommandHandler,
    VoiceTranscriptionResolver,
    VoiceSynthesisResolver,
    ChatgptSpeechResolver,
    OpenAiSpeechResolver,
    GroqSpeechResolver,
    ElevenlabsSpeechResolver,
    SpeechKeyResolver,
    OpenAiSynthesisResolver,
    ElevenlabsSynthesisResolver,
    SpeechKeySynthesisResolver,
    // The providers, one per id; their order is the shared catalog's
    // (`VOICE_PROVIDERS`, `SYNTHESIS_PROVIDERS`), declared there alone. A new
    // one is a class, its id in that list, and its entry here.
    {
      provide: SpeechProviderRegistry,
      inject: [
        ChatgptSpeechResolver,
        OpenAiSpeechResolver,
        GroqSpeechResolver,
        ElevenlabsSpeechResolver,
        SpeechKeyResolver,
      ],
      useFactory: (
        chatgpt: ChatgptSpeechResolver,
        openai: OpenAiSpeechResolver,
        groq: GroqSpeechResolver,
        elevenlabs: ElevenlabsSpeechResolver,
        speechKey: SpeechKeyResolver,
      ) =>
        SpeechProviderRegistry.inCatalogOrder({
          chatgpt,
          openai,
          groq,
          elevenlabs,
          speech_key: speechKey,
        }),
    },
    {
      provide: SynthesisProviderRegistry,
      inject: [OpenAiSynthesisResolver, ElevenlabsSynthesisResolver, SpeechKeySynthesisResolver],
      useFactory: (
        openai: OpenAiSynthesisResolver,
        elevenlabs: ElevenlabsSynthesisResolver,
        speechKey: SpeechKeySynthesisResolver,
      ) => SynthesisProviderRegistry.inCatalogOrder({ openai, elevenlabs, speech_key: speechKey }),
    },
    VoicePolishResolver,
    PolishModelResolver,
    { provide: VOICE_SETTINGS_REPOSITORY, useClass: VoiceSettingsRepository },
    { provide: CHATGPT_SPEECH, useClass: ChatgptSpeechGateway },
    { provide: OPENAI_SPEECH, useClass: OpenAiSpeechGateway },
    { provide: GROQ_SPEECH, useClass: GroqSpeechGateway },
    { provide: ELEVENLABS_SPEECH, useClass: ElevenlabsSpeechGateway },
    { provide: KEYED_SPEECH, useClass: OpenAiCompatibleSpeechGateway },
    { provide: SPEECH_SYNTHESIS, useClass: OpenAiCompatibleSpeechSynthesisGateway },
    { provide: VOICE_POLISH_ENGINE, useFactory: () => createBotEngine() },
    { provide: POLISH_LLM, useClass: PolishLlmAdapter },
  ],
})
export class VoiceModule {}
