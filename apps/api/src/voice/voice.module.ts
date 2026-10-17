import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { createBotEngine } from '@oppenheimer/backend-agents';
import { BotsModule } from '../bots/bots.module';
import { VoicePolishResolver } from './application/voice-polish.resolver';
import { VoiceTranscriptionResolver } from './application/voice-transcription.resolver';
import { TranscribeVoiceCommandHandler } from './commands/transcribe-voice/transcribe-voice.command-handler';
import { TranscribeVoiceHttpController } from './commands/transcribe-voice/transcribe-voice.http.controller';
import { ChatgptSpeechGateway } from './infrastructure/chatgpt-speech.gateway';
import { OpenAiCompatibleSpeechGateway } from './infrastructure/openai-compatible-speech.gateway';
import { CHATGPT_SPEECH, KEYED_SPEECH, VOICE_POLISH_ENGINE } from './voice.di-tokens';

/**
 * Dictation (`product/next-steps/voice.md`): a recording in, the text it
 * says out. It owns no table and keeps nothing: the workspace's ChatGPT
 * sign-in is the bots module's, read through its `TURN_CREDENTIALS`, and the
 * deployment's speech server is configuration (`VOICE_STT_*`).
 */
@Module({
  imports: [CqrsModule, BotsModule],
  controllers: [TranscribeVoiceHttpController],
  providers: [
    TranscribeVoiceCommandHandler,
    VoiceTranscriptionResolver,
    VoicePolishResolver,
    { provide: CHATGPT_SPEECH, useClass: ChatgptSpeechGateway },
    { provide: KEYED_SPEECH, useClass: OpenAiCompatibleSpeechGateway },
    { provide: VOICE_POLISH_ENGINE, useFactory: () => createBotEngine() },
  ],
})
export class VoiceModule {}
