import type { VoiceSettings } from '@oppenheimer/shared';

export interface VoiceSettingsRepositoryPort {
  /** The workspace's choices, or every one automatic when it saved none. */
  find(organizationId: string): Promise<VoiceSettings>;
  /** Replaces the workspace's choices whole. */
  put(organizationId: string, settings: VoiceSettings): Promise<void>;
}
