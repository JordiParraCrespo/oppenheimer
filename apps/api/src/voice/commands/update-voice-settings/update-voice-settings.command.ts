import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { VoiceSettings } from '@oppenheimer/shared';

export class UpdateVoiceSettingsCommand extends CommandBase {
  readonly organizationId: string;
  readonly settings: VoiceSettings;

  constructor(props: CommandProps<UpdateVoiceSettingsCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.settings = props.settings;
  }
}
