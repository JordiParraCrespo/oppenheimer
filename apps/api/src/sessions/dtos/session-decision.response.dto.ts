import { ApiProperty } from '@nestjs/swagger';

/**
 * What a session's agent waits on the person for, as the runner read it
 * (`SessionDecision` in `@oppenheimer/shared`, `28-inbox.md` slice 4): an
 * `AskUserQuestion` call, or Claude Code's permission dialog. Answered with
 * `POST /sessions/{id}/decision`, naming its `id`.
 */
export class SessionDecisionQuestionOptionResponseDto {
  @ApiProperty({ example: 'Tokens and components' })
  label!: string;

  @ApiProperty({ nullable: true, type: String })
  description!: string | null;
}

export class SessionDecisionQuestionResponseDto {
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'The chip over it in the terminal.',
    example: 'Scope',
  })
  header!: string | null;

  @ApiProperty({ example: 'What should the design system cover?' })
  question!: string;

  @ApiProperty({ description: 'Several options may be picked.' })
  multiSelect!: boolean;

  @ApiProperty({ type: [SessionDecisionQuestionOptionResponseDto] })
  options!: SessionDecisionQuestionOptionResponseDto[];
}

/** An `AskUserQuestion` call the agent's transcript holds with no result yet. */
export class SessionQuestionDecisionResponseDto {
  @ApiProperty({ enum: ['question'] })
  kind!: 'question';

  @ApiProperty({ description: 'The call’s `tool_use_id`.' })
  id!: string;

  @ApiProperty({ type: [SessionDecisionQuestionResponseDto] })
  questions!: SessionDecisionQuestionResponseDto[];
}

export class SessionPermissionOptionResponseDto {
  @ApiProperty({ example: 'Yes' })
  label!: string;
}

/** Claude Code's permission dialog, read off the bottom of the agent's screen. */
export class SessionPermissionDecisionResponseDto {
  @ApiProperty({ enum: ['permission'] })
  kind!: 'permission';

  @ApiProperty({ description: 'A hash of what the dialog says: stable while it is on screen.' })
  id!: string;

  @ApiProperty({ example: 'Do you want to proceed?' })
  title!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'What it asks about, above the question: a command, a file.',
  })
  detail!: string | null;

  @ApiProperty({
    type: [SessionPermissionOptionResponseDto],
    description: 'In screen order; the answer names one by its index.',
  })
  options!: SessionPermissionOptionResponseDto[];
}

export type SessionDecisionResponseDto =
  | SessionQuestionDecisionResponseDto
  | SessionPermissionDecisionResponseDto;
