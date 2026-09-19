import { type ArgumentMetadata, Injectable, type PipeTransform } from '@nestjs/common';

/**
 * Strips HTML out of everything a client sent.
 *
 * It rebuilds objects as it goes, which is right for a JSON body and wrong for
 * anything that is not one — a `Map`, a `Set`, a `Date` or any class instance
 * survives `Object.entries` as an empty object with its prototype gone. So it
 * only ever touches the three parameter kinds that carry the request: a body, a
 * query string and a route parameter.
 *
 * A **custom** parameter does not come off the wire at all. It is whatever a
 * `createParamDecorator` read off the request — the caller's ability, their
 * resolved access scope, the session — and those are already-trusted values
 * this pipe has nothing to add to and, until it stopped, quietly flattened.
 */
@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type === 'custom') return value;
    return this.sanitize(value);
  }

  private sanitize(value: unknown): unknown {
    if (typeof value === 'string') {
      return this.stripHtml(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item));
    }

    if (value !== null && typeof value === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = this.sanitize(val);
      }
      return sanitized;
    }

    return value;
  }

  private stripHtml(input: string): string {
    return input.replace(/<[^>]*>/g, '').replace(/[<>]/g, '');
  }
}
