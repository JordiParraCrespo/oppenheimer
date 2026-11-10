import { ApiProperty } from '@nestjs/swagger';
import { BRIEF_MAX_IMAGES, BRIEF_MAX_POINTS } from '../domain/pull-request-brief.policy';

export class PullRequestBriefImageDto {
  @ApiProperty({ description: 'The picture’s `https` address, as the description wrote it.' })
  url!: string;

  @ApiProperty({ description: 'Its alternative text; empty when the author gave none.' })
  alt!: string;
}

/** What the review deck leads a pull request with: a sentence, a few points, its pictures. */
export class PullRequestBriefResponseDto {
  @ApiProperty({ description: 'The head commit the brief was written for.' })
  headSha!: string;

  @ApiProperty({
    enum: ['model', 'description'],
    description:
      '`model`: written by the deployment’s language model from the description and the diff. `description`: taken from the author’s own description, when no model is configured or it did not answer.',
  })
  source!: 'model' | 'description';

  @ApiProperty({ description: 'One sentence: what the pull request changes.' })
  headline!: string;

  @ApiProperty({ type: [String], maxItems: BRIEF_MAX_POINTS })
  points!: string[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The riskiest part, or where to start reading; null when nothing stands out.',
  })
  lookFirst!: string | null;

  @ApiProperty({
    type: [PullRequestBriefImageDto],
    maxItems: BRIEF_MAX_IMAGES,
    description: 'The pictures in the description, in the order written.',
  })
  images!: PullRequestBriefImageDto[];
}
