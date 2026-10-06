import { ApiProperty } from '@nestjs/swagger';

/** What submitting a review did to the merge: what no later read of the pull request says about this request. */
export class ReviewSubmittedResponseDto {
  @ApiProperty({
    description:
      'Merged now; false for a comment, a change request, or an approval GitHub would not merge yet.',
  })
  merged!: boolean;
}
