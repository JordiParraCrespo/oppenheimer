import './openapi-env';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createOpenApiDocument } from './openapi-document';
import { formatOpenApiJson } from './openapi-json';

async function generate() {
  const app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  const document = createOpenApiDocument(app);
  const outputPath = resolve(__dirname, '../openapi.json');
  writeFileSync(outputPath, formatOpenApiJson(document));
  console.log(`OpenAPI spec written to ${outputPath}`);

  await app.close();
  // Redis/BullMQ keep handles open even after the app closes, which would
  // leave this one-shot generator hanging; the document is already on disk.
  process.exit(0);
}

generate();
