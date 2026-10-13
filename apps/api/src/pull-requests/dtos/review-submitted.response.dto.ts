import { ApiProperty } from '@nestjs/swagger';

/** What submitting a review did to the merge: what no later read of the pull request says about this request. */
export class ReviewSubmittedResponseDto {
  @ApiProperty({
    description:
      'Merged now; false for a comment, a change request, an approval alone, or an approve-and-merge GitHub would not merge yet.',
  })
  merged!: boolean;

  @ApiProperty({
    description:
      'Approve and merge only: GitHub will merge it once its required checks pass. False when the repository does not allow auto-merge, so it waits.',
  })
  autoMerge!: boolean;
}
