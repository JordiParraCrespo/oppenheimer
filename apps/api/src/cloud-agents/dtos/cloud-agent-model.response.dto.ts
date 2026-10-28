import { ApiProperty } from '@nestjs/swagger';

/** A model a vendor offers the caller's cloud agents, besides its own default. */
export class CloudAgentModelResponseDto {
  @ApiProperty({ example: 'grok-4.7' })
  id!: string;

  @ApiProperty({ example: 'Grok 4.7' })
  label!: string;
}

/** A repository the vendor can reach for the caller. */
export class CloudAgentRepositoryResponseDto {
  @ApiProperty({ example: 'https://github.com/acme/api' })
  url!: string;
}
