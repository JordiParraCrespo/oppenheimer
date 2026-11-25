import type { Type } from '@nestjs/common';
import type { ApplicationConfig, HttpAdapterHost } from '@nestjs/core';
import { mountRawBodyParser } from '../../config/raw-body-parser';

/**
 * GitHub's own cap: "Payloads are capped at 25 MB", and a larger event is
 * never delivered. The app-wide JSON parser's 100 kB default refused ordinary
 * `push` and `pull_request` deliveries.
 */
export const GITHUB_WEBHOOK_BODY_LIMIT_BYTES = 25 * 1024 * 1024;

/**
 * Reads the webhook's body as raw bytes, up to GitHub's cap
 * (`mountRawBodyParser`). Any content type, since GitHub also sends
 * `application/x-www-form-urlencoded`.
 */
export function mountGithubWebhookBodyParser(
  adapterHost: HttpAdapterHost,
  config: ApplicationConfig,
  controller: Type,
  method: string,
): void {
  mountRawBodyParser(adapterHost, config, controller, method, GITHUB_WEBHOOK_BODY_LIMIT_BYTES);
}
