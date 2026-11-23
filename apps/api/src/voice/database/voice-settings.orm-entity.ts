import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Check, Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * How a workspace hears and speaks (`1795289421947-AddVoiceSettings`): one row
 * per workspace, every choice nullable, null being automatic.
 */
@Entity('voice_settings')
@Check(
  'CHK_voice_settings_transcription_provider',
  `"transcriptionProvider" IN ('chatgpt', 'openai', 'groq', 'elevenlabs', 'speech_key')`,
)
@Check(
  'CHK_voice_settings_synthesis_provider',
  `"synthesisProvider" IN ('openai', 'elevenlabs', 'speech_key')`,
)
@Check(
  'CHK_voice_settings_polish_provider',
  `"polishProvider" IN ('anthropic', 'glm', 'openai', 'chatgpt', 'xai', 'off')`,
)
export class VoiceSettingsOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  transcriptionProvider!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  transcriptionModel!: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  synthesisProvider!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  synthesisModel!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  synthesisVoice!: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  polishProvider!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  polishModel!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
