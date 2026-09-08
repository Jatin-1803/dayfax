import { paginatedMeta, parsePagination } from '../../common/utils/pagination.js';
import { AuthRepository } from '../auth/auth.repository.js';
import { AdminUsersRepository } from '../admin-users/admin-users.repository.js';
import type {
  CreateDeliveryPartnerInput,
  ListDeliveryPartnersQuery,
} from './admin.schema.js';

export class AdminService {
  constructor(
    private readonly authRepo = new AuthRepository(),
    private readonly usersRepo = new AdminUsersRepository(),
  ) {}

  async createOrPromoteDeliveryPartner(input: CreateDeliveryPartnerInput) {
    const result = await this.authRepo.createOrPromoteDeliveryPartner({
      phoneCountryCode: input.phoneCountryCode,
      phone: input.phone,
      fullName: input.fullName,
    });

    const roles = await this.authRepo.getUserRoles(result.user.id);
    return {
      id: result.user.id,
      phoneCountryCode: result.user.phone_country_code,
      phone: result.user.phone,
      fullName: result.user.full_name,
      email: result.user.email,
      avatarUrl: result.user.avatar_url,
      status: result.user.status,
      roles,
      created: result.created,
      roleAdded: result.roleAdded,
    };
  }

  async listDeliveryPartners(query: ListDeliveryPartnersQuery) {
    const { page, limit, offset } = parsePagination(
      { page: query.page, limit: query.limit },
      { limit: 50, maxLimit: 100 },
    );
    const filter = { q: query.q, role: 'DELIVERY_PARTNER' as const };
    const [total, rows] = await Promise.all([
      this.usersRepo.countUsers(filter),
      this.usersRepo.listUsers(filter, limit, offset),
    ]);
    const rolesByUser = await this.authRepo.getUserRolesForUsers(rows.map((row) => row.id));
    const items = rows.map((row) => ({
      id: row.id,
      phoneCountryCode: row.phone_country_code,
      phone: row.phone,
      fullName: row.full_name,
      email: row.email,
      status: row.status,
      roles: rolesByUser.get(row.id) ?? [],
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at,
    }));
    return { items, pagination: paginatedMeta(total, page, limit) };
  }
}
