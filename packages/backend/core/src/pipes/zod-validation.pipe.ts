import { type ArgumentMetadata, Injectable, type PipeTransform } from '@nestjs/common';
import { ZodValidationException } from 'nestjs-zod';
import type { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema?: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    const schema =
      this.schema ||
      ((metadata.metatype as Record<string, unknown> | undefined)?.zodSchema as
        | ZodSchema
        | undefined);
    if (!schema) return value;

    const result = schema.safeParse(value);
    if (!result.success) {
      throw new ZodValidationException(result.error);
    }
    return result.data;
  }
}
