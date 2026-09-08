import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../common/database/pool.js';
import type { RoleCode } from '../../common/middleware/auth.js';
import type { AdminListUsersQuery } from './admin-users.schema.js';

export interface AdminUserRow {
  id: string;
  phone_country_code: string;
  phone: string;
  full_name: string | null;
  email: string | null;
  status: string;
  created_at: Date | null;
  last_login_at: Date | null;
}

export class AdminUsersRepository {
  constructor(private readonly db: Pool = getPool()) {}

  async countUsers(query: AdminListUsersQuery): Promise<number> {
    const { clauses, params, joinRoles } = this.buildFilters(query);
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT u.id) AS total
       FROM users u
       ${joinRoles}
       ${where}`,
      params,
    );
    return Number(rows[0]?.total ?? 0);
  }

  async listUsers(
    query: AdminListUsersQuery,
    limit: number,
    offset: number,
  ): Promise<AdminUserRow[]> {
    const { clauses, params, joinRoles } = this.buildFilters(query);
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT DISTINCT
          u.id, u.phone_country_code, u.phone, u.full_name, u.email, u.status,
          u.created_at, u.last_login_at
       FROM users u
       ${joinRoles}
       ${where}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    return rows as AdminUserRow[];
  }

  async findById(id: string): Promise<AdminUserRow | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id, phone_country_code, phone, full_name, email, status, created_at, last_login_at
       FROM users
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [id],
    );
    return (rows[0] as AdminUserRow) ?? null;
  }

  async countAdmins(): Promise<number> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM user_roles ur
       INNER JOIN roles r ON r.id = ur.role_id
       INNER JOIN users u ON u.id = ur.user_id AND u.deleted_at IS NULL
       WHERE r.code = 'ADMIN'`,
    );
    return Number(rows[0]?.total ?? 0);
  }

  async revokeRole(userId: string, role: RoleCode): Promise<boolean> {
    const [result] = await this.db.query<ResultSetHeader>(
      `DELETE ur FROM user_roles ur
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = ? AND r.code = ?`,
      [userId, role],
    );
    return result.affectedRows > 0;
  }

  private buildFilters(query: AdminListUsersQuery): {
    clauses: string[];
    params: unknown[];
    joinRoles: string;
  } {
    const clauses: string[] = ['u.deleted_at IS NULL'];
    const params: unknown[] = [];
    let joinRoles = '';

    if (query.role) {
      joinRoles = `
        INNER JOIN user_roles ur ON ur.user_id = u.id
        INNER JOIN roles r ON r.id = ur.role_id AND r.code = ?
      `;
      params.push(query.role);
    }

    if (query.q) {
      const q = `%${query.q}%`;
      clauses.push(`(u.phone LIKE ? OR u.full_name LIKE ? OR u.id = ?)`);
      params.push(q, q, query.q);
    }

    return { clauses, params, joinRoles };
  }
}
