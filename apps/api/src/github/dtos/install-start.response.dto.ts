import { ApiProperty } from '@nestjs/swagger';

export class InstallStartResponseDto {
  @ApiProperty({
    description:
      'The GitHub App’s installation page, with `state` already on it. Send the browser here.',
    example:
      'https://github.com/apps/oppenheimer/installations/new?state=kX9_mZq-4vR2tY7wB1nC3dE5fG8hJ0kLpQ6sU2xV4yA',
  })
  url!: string;

  @ApiProperty({
    description:
      'Single use, 15 minutes, bound to the caller and the workspace. GitHub echoes it on the install redirect; post it back as `state` on `POST /installations`.',
  })
  state!: string;

  @ApiProperty()
  expiresAt!: Date;
}
