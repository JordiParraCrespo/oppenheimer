import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { ProblemDetailsDto } from '@oppenheimer/backend-core';
import { patchNestJsSwagger } from 'nestjs-zod';

// Zod DTOs describe themselves to Swagger through this patch, so it is applied
// wherever the document is built, before any controller is read.
patchNestJsSwagger();

/**
 * The API's OpenAPI document, built one way for both readers: Swagger UI in
 * `main.ts` and `apps/api/openapi.json`, which the console's client is
 * generated from.
 */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Oppenheimer API')
    .setDescription('Oppenheimer REST API documentation')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const handlers = new Map<string, Set<string>>();
  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controller, method) => {
      const id = operationIdFor(controller, method);
      handlers.set(id, (handlers.get(id) ?? new Set()).add(`${controller}.${method}`));
      return id;
    },
    // Every error response references this schema (RFC 7807), so it must be in
    // the document even if a route documents its failures loosely.
    extraModels: [ProblemDetailsDto],
  });

  // Two handlers on one name would reach the client numbered (`list2`), and a
  // numbered function names nothing, so the document is refused instead.
  const collisions = [...handlers]
    .filter(([, named]) => named.size > 1)
    .map(([id, named]) => `  ${id}: ${[...named].join(', ')}`);
  if (collisions.length > 0) {
    throw new Error(
      `Operation ids name more than one handler; rename one of each:\n${collisions.join('\n')}`,
    );
  }
  return document;
}

/**
 * What an operation is called, and so what the client's function is called.
 *
 * A slice's controller, `<UseCase>HttpController`, holds one use case, and the
 * operation takes its name: `FindHostsHttpController` is `findHosts`. A
 * controller that holds several operations names each by its method.
 */
export function operationIdFor(controller: string, method: string): string {
  const useCase = /^(\w+)HttpController$/.exec(controller)?.[1];
  if (!useCase) return method;
  return useCase.charAt(0).toLowerCase() + useCase.slice(1);
}
