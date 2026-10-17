import { ApiProperty } from '@nestjs/swagger';
import { CHATGPT_LOGIN_STATUSES, type ChatgptLoginStatus } from '@oppenheimer/shared';

/** A ChatGPT sign-in, started: the code the person types, where, and the handle to poll with. */
export class ChatgptLoginResponseDto {
  @ApiProperty({
    description: 'The sign-in, sealed: opaque to the console, handed back on every poll.',
  })
  flowId!: string;

  @ApiProperty({ description: 'The code the person types on `verificationUrl`.' })
  userCode!: string;

  @ApiProperty({ description: "OpenAI's page where the code is typed." })
  verificationUrl!: string;

  @ApiProperty({ description: 'How long to wait between polls, in seconds.' })
  intervalSeconds!: number;

  @ApiProperty({ type: String, format: 'date-time', description: 'When the code stops working.' })
  expiresAt!: string;
}

/** One poll of a ChatGPT sign-in: still waiting for the person, or stored for the workspace. */
export class ChatgptLoginStatusResponseDto {
  @ApiProperty({ enum: CHATGPT_LOGIN_STATUSES })
  status!: ChatgptLoginStatus;
}
