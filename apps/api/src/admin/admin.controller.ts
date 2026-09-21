import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import type { Request, Response } from 'express';
import { CheckPolicies, NoPolicy } from '../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../auth/guards/policies.guard';
import { AdminService } from './admin.service';
import {
  AdminCreateUserRequest,
  AdminUpdateUserRequest,
  BanUserRequest,
  RevokeSessionRequest,
  SetUserPasswordRequest,
  SetUserRoleRequest,
} from './dtos/admin.request.dto';
import {
  AdminSessionResponseDto,
  AdminSuccessResponseDto,
  AdminUserListResponseDto,
  AdminUserResponseDto,
} from './dtos/admin-user.response.dto';

/** Forward Better Auth's `Set-Cookie` headers (e.g. impersonation) to the client. */
function forwardCookies(headers: Headers, res: Response): void {
  const getSetCookie = (headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
  const cookies = getSetCookie ? getSetCookie.call(headers) : [];
  if (cookies.length > 0) res.setHeader('set-cookie', cookies);
}

/**
 * Super-admin user management — a typed, CASL-guarded REST surface delegating to
 * the Better Auth admin plugin (`auth.api.*`). Gated by `manage User`.
 */
@ApiTags('Admin')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@ApiProblemResponse({
  status: 404,
  description: 'The user does not exist',
  code: 'ADMIN_001',
})
@ApiProblemResponse({
  status: 403,
  description:
    'The account may not perform this administrative action, it targets the caller themselves, or the target is banned',
  code: ['ADMIN_003', 'ADMIN_004', 'ADMIN_006'],
})
@ApiProblemResponse({
  status: 409,
  description: 'A user with that email already exists',
  code: 'ADMIN_002',
})
@ApiProblemResponse({
  status: 400,
  description: 'The role is not assignable, or the request was otherwise rejected',
  code: ['ADMIN_005', 'ADMIN_007'],
})
@ApiProblemResponse({
  status: 502,
  description: 'The admin service failed to handle the request',
  code: 'ADMIN_008',
})
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  @Version('1')
  @RequireScopes('admin:read')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @ApiOperation({ summary: 'List users' })
  @ApiQuery({ name: 'searchValue', required: false })
  @ApiQuery({ name: 'searchField', required: false, enum: ['email', 'name'] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortDirection', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: 200, type: AdminUserListResponseDto })
  listUsers(
    @Req() req: Request,
    @Query('searchValue') searchValue?: string,
    @Query('searchField') searchField?: 'email' | 'name',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDirection') sortDirection?: 'asc' | 'desc',
  ): Promise<AdminUserListResponseDto> {
    return this.admin.listUsers(req.headers, {
      searchValue,
      searchField,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      sortBy,
      sortDirection,
    });
  }

  @Post('users')
  @Version('1')
  @RequireScopes('admin:write')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @ApiOperation({ summary: 'Create a user' })
  @ApiResponse({ status: 201, type: AdminUserResponseDto })
  createUser(
    @Req() req: Request,
    @Body() body: AdminCreateUserRequest,
  ): Promise<AdminUserResponseDto> {
    return this.admin.createUser(req.headers, body);
  }

  @Post('stop-impersonating')
  @NoPolicy('ends the caller’s own impersonation session; holding no admin power is the point')
  @Version('1')
  @RequireScopes('admin:write')
  @ApiOperation({ summary: 'Stop impersonating and restore the admin session' })
  @ApiResponse({ status: 200, type: AdminUserResponseDto })
  async stopImpersonating(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AdminUserResponseDto> {
    const { user, headers } = await this.admin.stopImpersonating(req.headers);
    forwardCookies(headers, res);
    return user;
  }

  @Post('users/:id/sessions/revoke')
  @Version('1')
  @RequireScopes('admin:write')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @ApiOperation({ summary: "Revoke one of a user's sessions by id" })
  @ApiResponse({ status: 200, type: AdminSuccessResponseDto })
  @ApiProblemResponse({
    status: 404,
    description: 'Session not found',
    code: 'ADMIN_009',
  })
  revokeSession(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RevokeSessionRequest,
  ): Promise<AdminSuccessResponseDto> {
    return this.admin.revokeSession(req.headers, id, body.sessionId);
  }

  @Get('users/:id')
  @Version('1')
  @RequireScopes('admin:read')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @ApiOperation({ summary: 'Get a user' })
  @ApiResponse({ status: 200, type: AdminUserResponseDto })
  getUser(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminUserResponseDto> {
    return this.admin.getUser(req.headers, id);
  }

  @Patch('users/:id')
  @Version('1')
  @RequireScopes('admin:write')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @ApiOperation({ summary: "Update a user's profile fields" })
  @ApiResponse({ status: 200, type: AdminUserResponseDto })
  updateUser(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AdminUpdateUserRequest,
  ): Promise<AdminUserResponseDto> {
    return this.admin.updateUser(req.headers, id, body);
  }

  @Delete('users/:id')
  @Version('1')
  @RequireScopes('admin:write')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 200, type: AdminSuccessResponseDto })
  removeUser(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminSuccessResponseDto> {
    return this.admin.remove(req.headers, id);
  }

  @Post('users/:id/role')
  @Version('1')
  @RequireScopes('admin:write')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @ApiOperation({ summary: "Set a user's global role" })
  @ApiResponse({ status: 200, type: AdminUserResponseDto })
  setRole(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetUserRoleRequest,
  ): Promise<AdminUserResponseDto> {
    return this.admin.setRole(req.headers, id, body.role);
  }

  @Post('users/:id/ban')
  @Version('1')
  @RequireScopes('admin:write')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @ApiOperation({ summary: 'Ban a user' })
  @ApiResponse({ status: 200, type: AdminUserResponseDto })
  ban(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: BanUserRequest,
  ): Promise<AdminUserResponseDto> {
    return this.admin.ban(req.headers, id, body);
  }

  @Post('users/:id/unban')
  @Version('1')
  @RequireScopes('admin:write')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @ApiOperation({ summary: 'Unban a user' })
  @ApiResponse({ status: 200, type: AdminUserResponseDto })
  unban(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminUserResponseDto> {
    return this.admin.unban(req.headers, id);
  }

  @Post('users/:id/impersonate')
  @Version('1')
  @RequireScopes('admin:write')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @ApiOperation({
    summary: 'Impersonate a user (issues an impersonation session)',
  })
  @ApiResponse({ status: 200, type: AdminUserResponseDto })
  async impersonate(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminUserResponseDto> {
    const { user, headers } = await this.admin.impersonate(req.headers, id);
    forwardCookies(headers, res);
    return user;
  }

  @Get('users/:id/sessions')
  @Version('1')
  @RequireScopes('admin:read')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @ApiOperation({
    // Named explicitly because the default collides with the sessions module's
    // own `listSessions`, and the generated client resolves a collision by
    // suffixing a digit — which is how the console's work-session list ended up
    // being called `listSessions2`. This one lists *a user's* sign-in sessions.
    operationId: 'listUserSessions',
    summary: "List a user's sessions",
  })
  @ApiResponse({ status: 200, type: [AdminSessionResponseDto] })
  listSessions(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminSessionResponseDto[]> {
    return this.admin.listSessions(req.headers, id);
  }

  @Post('users/:id/revoke-sessions')
  @Version('1')
  @RequireScopes('admin:write')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @ApiOperation({ summary: "Revoke all of a user's sessions" })
  @ApiResponse({ status: 200, type: AdminSuccessResponseDto })
  revokeSessions(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminSuccessResponseDto> {
    return this.admin.revokeAllSessions(req.headers, id);
  }

  @Post('users/:id/set-password')
  @Version('1')
  @RequireScopes('admin:write')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @ApiOperation({ summary: "Set a user's password" })
  @ApiResponse({ status: 200, type: AdminSuccessResponseDto })
  setPassword(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetUserPasswordRequest,
  ): Promise<AdminSuccessResponseDto> {
    return this.admin.setPassword(req.headers, id, body.newPassword);
  }
}
