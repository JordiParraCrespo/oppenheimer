import { ConfigService } from '@nestjs/config';
import { retentionConfig } from '../retention.config';
import { throttlingConfig } from '../throttling.config';

/**
 * The sections a unit spec may need, as a deployment that sets nothing gets
 * them: each factory parsed against an empty environment, so a spec asserts
 * against the real defaults instead of repeating their numbers.
 */
const factories = { retention: retentionConfig, throttling: throttlingConfig };

type Sections = { [K in keyof typeof factories]: ReturnType<(typeof factories)[K]> };

/** Every section above at its defaults, parsed with `process.env` emptied for the call. */
export function configDefaults(): Sections {
  const saved = process.env;
  process.env = {};
  try {
    return {
      retention: factories.retention(),
      throttling: factories.throttling(),
    };
  } finally {
    process.env = saved;
  }
}

/** A `ConfigService` over the defaults, with any section's keys overridden. */
export function configStub(overrides: { [K in keyof Sections]?: Partial<Sections[K]> } = {}) {
  const defaults = configDefaults();
  return new ConfigService({
    retention: { ...defaults.retention, ...overrides.retention },
    throttling: { ...defaults.throttling, ...overrides.throttling },
  });
}
