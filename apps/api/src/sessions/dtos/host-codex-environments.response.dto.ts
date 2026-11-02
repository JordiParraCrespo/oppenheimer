import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** One Codex cloud environment of the host's ChatGPT account. */
export class HostCodexEnvironmentResponseDto {
  @ApiProperty({
    description: 'Its id, what `codex cloud exec --env` is given.',
    example: 'e_6845a1b2c3d4',
  })
  id!: string;

  @ApiPropertyOptional({
    description: 'The name its owner gave it on chatgpt.com/codex.',
    nullable: true,
    type: String,
    example: 'Oppenheimer web',
  })
  label!: string | null;

  @ApiProperty({ description: 'Pinned on chatgpt.com/codex.' })
  pinned!: boolean;

  @ApiProperty({ description: 'Linked to the repository the list was asked for.' })
  repository!: boolean;
}

/**
 * The Codex cloud environments a host's ChatGPT account has, for the
 * composer's picker (`product/next-steps/cloud-agents.md`, "Which Codex
 * environment"), read by the host just now with its own sign-in.
 */
export class HostCodexEnvironmentsResponseDto {
  @ApiProperty({
    type: [HostCodexEnvironmentResponseDto],
    description: 'Those linked to the repository first, then pinned, then by label.',
  })
  environments!: HostCodexEnvironmentResponseDto[];

  @ApiPropertyOptional({
    description:
      'The environment a session started with none picked runs in: the one linked to the repository, else one labelled with its name. Null when none is.',
    nullable: true,
    type: String,
  })
  recommended!: string | null;

  @ApiProperty({
    enum: ['chatgpt', 'tasks'],
    description:
      '`chatgpt`: every environment of the account. `tasks`: only those its recent tasks ran in, when the host could not ask ChatGPT.',
  })
  source!: 'chatgpt' | 'tasks';
}
