import { ApiProperty } from '@nestjs/swagger';

/** A one-time code that records whoever sends it to the app in Slack as its owner. */
export class SlackOwnerLinkResponseDto {
  @ApiProperty({ example: 'link Q2xhdWRlIHdh', description: 'What to send the app in its DM.' })
  message!: string;

  @ApiProperty({
    format: 'uri',
    example: 'https://slack.com/app_redirect?channel=U0123ABCD&team=T0123ABCD',
    description: 'Opens the app’s direct messages in Slack.',
  })
  url!: string;

  @ApiProperty({
    format: 'date-time',
    description: 'When the code stops working: ten minutes after it was made.',
  })
  expiresAt!: string;
}
