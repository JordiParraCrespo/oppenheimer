#!/usr/bin/env node
/**
 * Plants the eval fixture for the hexagon-audit routine: realistic violations
 * of apps/api's hexagon contract, plus decoys that look suspicious but are
 * allowed. Every expected verdict is in `cases.json`.
 *
 * Run it in a throwaway worktree, never in your own checkout:
 *
 *   git worktree add ../hexagon-eval origin/main
 *   node .agents/routines/evals/hexagon-audit/plant.mjs ../hexagon-eval
 *   (cd ../hexagon-eval && git commit -qam "feat(users): planted fixture")
 *
 * Each edit anchors on an exact string. When the code under an anchor moves,
 * the script fails and names the case, so the eval breaks loudly instead of
 * silently testing nothing. Update the anchor and re-run the eval.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const api = (p) => join(root, 'apps/api/src', p);

function edit(caseId, file, anchor, replacement) {
  const text = readFileSync(file, 'utf8');
  const count = text.split(anchor).length - 1;
  if (count !== 1) {
    console.error(`${caseId}: anchor found ${count}× in ${file} — update plant.mjs`);
    process.exit(1);
  }
  // A function replacement, so `$'` and friends in the fixture stay literal.
  writeFileSync(file, text.replace(anchor, () => replacement));
}

// P1 HEX-CMD-RETURN: a command handler returns the entity, not the id.
edit(
  'P1',
  api('users/commands/update-user/update-user.command-handler.ts'),
  `    await this.userRepository.save(user);
    return user.id;`,
  `    // Return the saved user so the controller can skip the follow-up query.
    return this.userRepository.save(user);`,
);
edit(
  'P1',
  api('users/commands/update-user/update-user.command-handler.ts'),
  `  async execute(command: UpdateUserCommand): Promise<AggregateID> {`,
  `  async execute(command: UpdateUserCommand): Promise<UserEntity> {`,
);
edit(
  'P1',
  api('users/commands/update-user/update-user.command-handler.ts'),
  `import { UserErrors } from '../../domain/user.errors';`,
  `import type { UserEntity } from '../../domain/user.entity';
import { UserErrors } from '../../domain/user.errors';`,
);

// P2 HEX-THIN-CONTROLLER: the controller decides a business rule itself.
edit(
  'P2',
  api('users/commands/delete-user/delete-user.http.controller.ts'),
  `  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.commandBus.execute`,
  `  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('confirm') confirm?: string,
  ): Promise<void> {
    // Accounts created in the last 24h can be removed without confirmation;
    // anything older needs ?confirm=yes so support can't fat-finger it.
    const createdAt = new Date(Number.parseInt(id.slice(0, 8), 16) * 1000);
    const isFresh = Date.now() - createdAt.getTime() < 24 * 60 * 60 * 1000;
    if (!isFresh && confirm !== 'yes') {
      return;
    }
    await this.commandBus.execute`,
);
edit(
  'P2',
  api('users/commands/delete-user/delete-user.http.controller.ts'),
  `import { Controller, Delete, Param, ParseUUIDPipe, UseGuards, Version } from '@nestjs/common';`,
  `import {
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  Version,
} from '@nestjs/common';`,
);

// P3 HEX-ERRORS: a bare Nest exception in a handler, so the response has no code.
edit(
  'P3',
  api('users/commands/delete-user/delete-user.command-handler.ts'),
  `    const user = found.unwrap();
    user.delete();`,
  `    const user = found.unwrap();
    if (user.role === 'admin') {
      throw new ForbiddenException('Admins cannot be deleted through this endpoint');
    }
    user.delete();`,
);
edit(
  'P3',
  api('users/commands/delete-user/delete-user.command-handler.ts'),
  `import { Inject } from '@nestjs/common';`,
  `import { ForbiddenException, Inject } from '@nestjs/common';`,
);

// P4 HEX-PORT-OPTION: a new port lookup returns T | null.
edit(
  'P4',
  api('users/database/user.repository.port.ts'),
  `  findOneByEmail(email: string): Promise<Option<UserEntity>>;`,
  `  findOneByEmail(email: string): Promise<Option<UserEntity>>;
  /** Used by the GitHub link flow to find the account a login belongs to. */
  findOneByPhone(phone: string): Promise<UserEntity | null>;`,
);

// P5 HEX-QUERY-WRITE + HEX-ENCAPSULATION: a query mutates props and saves.
edit(
  'P5',
  api('users/queries/find-user-by-id/find-user-by-id.query-handler.ts'),
  `    if (found.isNone()) throw new AppError(UserErrors.NOT_FOUND);
    return found.unwrap();`,
  `    if (found.isNone()) throw new AppError(UserErrors.NOT_FOUND);
    const user = found.unwrap();
    // Reading a profile counts as activity: re-activate dormant accounts.
    if (!user.isActive) {
      user.getProps().isActive = true;
      await this.userRepository.save(user);
    }
    return user;`,
);

// P6 HEX-ERRORS: request data interpolated into the catalog title.
edit(
  'P6',
  api('users/commands/update-user/update-user.command-handler.ts'),
  `    if (found.isNone()) throw new AppError(UserErrors.NOT_FOUND);`,
  `    if (found.isNone()) {
      throw new AppError({ ...UserErrors.NOT_FOUND, message: \`User \${command.userId} not found\` });
    }`,
);

// P7 HEX-EVENTS: an event raised without a reason, then emitted straight from
// the handler instead of going through the outbox.
edit(
  'P7',
  api('users/commands/delete-user/delete-user.command-handler.ts'),
  `    await this.userRepository.delete(user);`,
  `    await this.userRepository.delete(user);
    this.events.emit(
      'UserDeletedDomainEvent',
      new UserDeletedDomainEvent({ aggregateId: user.id, email: user.email }),
    );`,
);
edit(
  'P7',
  api('users/commands/delete-user/delete-user.command-handler.ts'),
  `    private readonly userRepository: UserRepositoryPort,
  ) {}`,
  `    private readonly userRepository: UserRepositoryPort,
    private readonly events: EventEmitter2,
  ) {}`,
);
edit(
  'P7',
  api('users/commands/delete-user/delete-user.command-handler.ts'),
  `import { UserErrors } from '../../domain/user.errors';`,
  `import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserDeletedDomainEvent } from '../../domain/events/user-deleted.domain-event';
import { UserErrors } from '../../domain/user.errors';`,
);

// P8 mechanical (domain-stays-pure): a value object throws a Nest exception.
edit(
  'P8',
  api('users/domain/value-objects/email.value-object.ts'),
  `      throw new ArgumentInvalidException(\`Invalid email address: \${value}\`);`,
  `      throw new BadRequestException(\`Invalid email address: \${value}\`);`,
);
edit(
  'P8',
  api('users/domain/value-objects/email.value-object.ts'),
  `import {
  ArgumentInvalidException,`,
  `import { BadRequestException } from '@nestjs/common';
import {`,
);

// P9 HEX-ALWAYS-VALID: a subclass redeclares the base-owned _id, and a state
// change skips validate().
edit(
  'P9',
  api('users/domain/user.entity.ts'),
  `export class UserEntity extends AggregateRoot<UserProps> {
  static create(`,
  `export class UserEntity extends AggregateRoot<UserProps> {
  protected _id!: string;

  static create(`,
);
edit(
  'P9',
  api('users/domain/user.entity.ts'),
  `  /** Mark the user for deletion and raise the corresponding domain event. */`,
  `  /** Rename in one go, e.g. from the GitHub profile. */
  rename(fullName: string): void {
    const [first, ...rest] = fullName.split(' ');
    this.props.firstName = first ?? '';
    this.props.lastName = rest.join(' ');
  }

  /** Mark the user for deletion and raise the corresponding domain event. */`,
);

// P10 HEX-LEGACY-SHAPE: a new route added to a ledgered legacy controller.
edit(
  'P10',
  api('admin/admin.controller.ts'),
  `  @Patch('users/:id')
  @Version('1')`,
  `  @Get('users/:id/impersonations')
  @Version('1')
  @RequireScopes('admin:read')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @ApiOperation({ summary: "List a user's active impersonation sessions" })
  @ApiResponse({ status: 200, type: AdminUserResponseDto })
  listImpersonations(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminUserResponseDto> {
    return this.admin.getUser(req.headers, id);
  }

  @Patch('users/:id')
  @Version('1')`,
);

// P11 ledger drift + HEX-PORT-INJECTION: a query handler injects the concrete
// repository, and a new pathNot silences the rule that would catch it.
edit(
  'P11',
  api('users/queries/find-users/find-users.query-handler.ts'),
  `import type { UserRepositoryPort } from '../../database/user.repository.port';`,
  `import type { UserRepository } from '../../database/user.repository';`,
);
edit(
  'P11',
  api('users/queries/find-users/find-users.query-handler.ts'),
  `    private readonly userRepository: UserRepositoryPort,`,
  `    private readonly userRepository: UserRepository,`,
);
edit(
  'P11',
  join(root, 'apps/api/.dependency-cruiser.cjs'),
  `        path: '^src/[^/]+/(commands|queries|application)/',
        pathNot: TESTS,`,
  `        path: '^src/[^/]+/(commands|queries|application)/',
        pathNot: [...TESTS, '^src/users/queries/find-users/find-users\\\\.query-handler\\\\.ts$'],`,
);

// N1 decoy: a plain Error on a path that never answers HTTP. Allowed.
edit(
  'N1',
  api('queue/infrastructure/email.processor.ts'),
  `    this.logger.log(\`Processing email job \${job.id}: \${job.name}\`);`,
  `    this.logger.log(\`Processing email job \${job.id}: \${job.name}\`);
    if (!job.data) throw new Error(\`Email job \${job.id} has no payload\`);`,
);

// N2 decoy: a new domain method that mutates state and re-validates. Correct.
edit(
  'N2',
  api('users/domain/user.entity.ts'),
  `  public validate(): void {`,
  `  /** Clear the optional contact fields in one step. */
  clearContactDetails(): void {
    this.props.phone = null;
    this.props.jobTitle = null;
    this.setUpdatedAt(new Date());
    this.validate();
  }

  public validate(): void {`,
);

console.log('planted P1–P11 and decoys N1–N2 in', root);
