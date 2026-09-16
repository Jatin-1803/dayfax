import bcrypt from 'bcryptjs';
import { writeAudit } from '../../common/audit/audit-log.js';
import { revokeUserSessions } from '../../common/auth/session-store.js';
import { NotFoundError, ValidationError } from '../../common/errors/app-error.js';
import { paginatedMeta, parsePagination } from '../../common/utils/pagination.js';
import type { RoleCode } from '../../common/middleware/auth.js';
import { AuthRepository } from '../auth/auth.repository.js';
import { AccountLifecycleService } from './account-lifecycle.service.js';
import { AdminUsersRepository } from './admin-users.repository.js';
import type {
  AdminGrantRoleInput,
  AdminListUsersQuery,
  AdminResetPasswordInput,
} from './admin-users.schema.js';

const BCRYPT_COST = 12;

function mapUser(
  row: Awaited<ReturnType<AdminUsersRepository['findById']>>,
  roles: RoleCode[],
) {
  if (!row) return null;
  return {
    id: row.id,
    phoneCountryCode: row.phone_country_code,
    phone: row.phone,
    fullName: row.full_name,
    email: row.email,
    status: row.status,
    roles,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

export class AdminUsersService {
  constructor(
    private readonly repo = new AdminUsersRepository(),
    private readonly authRepo = new AuthRepository(),
    private readonly lifecycle = new AccountLifecycleService(),
  ) {}

  async list(query: AdminListUsersQuery) {
    const { page, limit, offset } = parsePagination(
      { page: query.page, limit: query.limit },
      { limit: 20, maxLimit: 50 },
    );
    const [total, rows] = await Promise.all([
      this.repo.countUsers(query),
      this.repo.listUsers(query, limit, offset),
    ]);
    const rolesByUser = await this.authRepo.getUserRolesForUsers(rows.map((row) => row.id));
    const items = rows.map((row) => mapUser(row, rolesByUser.get(row.id) ?? [])!);
    return { items, pagination: paginatedMeta(total, page, limit) };
  }

  async getOne(id: string) {
    const row = await this.repo.findById(id);
    if (!row) {
      throw new NotFoundError('User not found');
    }
    const roles = await this.authRepo.getUserRoles(id);
    return mapUser(row, roles)!;
  }

  async grantRole(id: string, input: AdminGrantRoleInput) {
    const row = await this.repo.findById(id);
    if (!row) {
      throw new NotFoundError('User not found');
    }
    await this.authRepo.ensureRole(id, input.role);
    return this.getOne(id);
  }

  async softDelete(id: string, adminId: string, reason: string, requestId?: string) {
    const row = await this.repo.findById(id);
    if (!row) {
      throw new NotFoundError('User not found');
    }
    const roles = await this.authRepo.getUserRoles(id);
    if (roles.includes('ADMIN')) {
      const adminCount = await this.repo.countAdmins();
      if (adminCount <= 1) {
        throw new ValidationError('Cannot delete the last ADMIN account');
      }
    }
    return this.lifecycle.softDelete(id, adminId, reason, requestId);
  }

  async adminResetPassword(
    id: string,
    adminId: string,
    input: AdminResetPasswordInput,
    requestId?: string,
    ipAddress?: string | null,
  ) {
    const row = await this.repo.findById(id);
    if (!row) {
      throw new NotFoundError('User not found');
    }
    const hash = await bcrypt.hash(input.password, BCRYPT_COST);
    await this.authRepo.setPasswordHash(id, hash);
    await revokeUserSessions({ userId: id, reason: 'admin_password_reset' });
    await writeAudit({
      actorType: 'admin',
      actorId: adminId,
      action: 'USER_PASSWORD_RESET_BY_ADMIN',
      module: 'users',
      entityType: 'user',
      entityId: id,
      reason: input.reason,
      ipAddress,
      requestId,
    });
    return { id, passwordUpdated: true };
  }

  async revokeRole(id: string, role: RoleCode) {
    const row = await this.repo.findById(id);
    if (!row) {
      throw new NotFoundError('User not found');
    }
    const roles = await this.authRepo.getUserRoles(id);
    if (!roles.includes(role)) {
      throw new ValidationError('User does not have this role');
    }
    if (role === 'ADMIN') {
      const adminCount = await this.repo.countAdmins();
      if (adminCount <= 1) {
        throw new ValidationError('Cannot revoke the last ADMIN role');
      }
    }
    await this.repo.revokeRole(id, role);
    return this.getOne(id);
  }
}
