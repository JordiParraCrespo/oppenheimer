import { ApiProperty } from '@nestjs/swagger';

/** What creating a bot's Slack app takes: where its events go, and Slack's "Create an app" with the manifest filled in. */
export class SlackAppSetupResponseDto {
  @ApiProperty({
    format: 'uri',
    example: 'https://api.example.com/api/v1/slack/events?bot=9f1c…',
    description: 'The address Slack sends the app’s events to: this bot’s.',
  })
  eventsUrl!: string;

  @ApiProperty({
    format: 'uri',
    description: 'Opens Slack’s "Create an app" with the manifest below filled in.',
  })
  createUrl!: string;

  @ApiProperty({ description: 'The app’s manifest, as JSON: its name, scopes and events.' })
  manifest!: string;
}
