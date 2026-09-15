import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

/**
 * Super-admin REST module — a delegating façade over the Better Auth admin
 * plugin (`auth.api.*`). Exposes `/v1/admin/users` (list/get/create/update/
 * set-role/ban/unban/impersonate/remove/sessions/set-password), gated by CASL
 * `manage User`. Better Auth remains the source of truth; this only adds a
 * typed, Swagger-documented surface for the generated api-client.
 */
@Module({
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
