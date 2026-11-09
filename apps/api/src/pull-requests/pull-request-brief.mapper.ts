import { Injectable } from '@nestjs/common';
import { imagesOf, type PullRequestBriefText } from './domain/pull-request-brief.policy';
import type { PullRequestBriefResponseDto } from './dtos/pull-request-brief.response.dto';

@Injectable()
export class PullRequestBriefMapper {
  toResponse(
    pull: { headSha: string; body: string },
    brief: PullRequestBriefText,
    source: PullRequestBriefResponseDto['source'],
  ): PullRequestBriefResponseDto {
    return {
      headSha: pull.headSha,
      source,
      headline: brief.headline,
      points: brief.points,
      lookFirst: brief.lookFirst,
      images: imagesOf(pull.body),
    };
  }
}
