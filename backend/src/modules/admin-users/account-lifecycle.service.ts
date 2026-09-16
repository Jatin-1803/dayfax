import type { RowDataPacket } from 'mysql2/promise';
import { writeAudit } from '../../common/audit/audit-log.js';
import { revokeUserSessions } from '../../common/auth/session-store.js';
import { getSessionPolicy } from '../../common/config/session-policy.js';
import { getPool } from '../../common/database/pool.js';
import { ConflictError, NotFoundError, ValidationError } from '../../common/errors/app-error.js';
import { createId } from '../../common/utils/id.js';

type AccountStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'SUSPENDED' | 'BANNED' | 'SECURITY_LOCKED';

const RESTORE_BLOCKED = new Set(['BANNED', 'BLOCKED']);

export class AccountLifecycleService {
  async changeStatus(input: {
    userId: string;
    adminId: string;
    status: AccountStatus;
    reason: string;
    expiresAt?: string | null;
    action: string;
    requestId?: string;
    ipAddress?: string | null;
  }) {
    const user = await this.requireUser(input.userId, true);
    if (user.status === input.status) {
      throw new ConflictError('Account is already in that state');
    }
    await getPool().execute(
      `UPDATE users
       SET status = ?, status_expires_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [input.status, input.expiresAt ?? null, input.userId],
    );
    await getPool().execute(
      `INSERT INTO user_status_events
        (id, user_id, previous_status, new_status, reason, admin_id, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        createId(),
        input.userId,
        user.status,
        input.status,
        input.reason,
        input.adminId,
        input.expiresAt ?? null,
      ],
    );

    const policy = await getSessionPolicy();
    if (policy.forceLogoutOnSecurityChange && input.status !== 'ACTIVE') {
      await getPool().execute(
        `UPDATE users SET sessions_valid_after = CURRENT_TIMESTAMP WHERE id = ?`,
        [input.userId],
      );
      await revokeUserSessions({ userId: input.userId, reason: input.action });
    }

    await writeAudit({
      actorType: 'admin',
      actorId: input.adminId,
      action: input.action,
      module: 'users',
      entityType: 'user',
      entityId: input.userId,
      oldValue: { status: user.status },
      newValue: { status: input.status, expiresAt: input.expiresAt ?? null },
      reason: input.reason,
      ipAddress: input.ipAddress,
      requestId: input.requestId,
    });
    return { id: input.userId, status: input.status };
  }

  async unsuspend(userId: string, adminId: string, reason: string, requestId?: string) {
    const user = await this.requireUser(userId, true);
    if (user.status !== 'SUSPENDED') throw new ConflictError('Account is not suspended');
    await getPool().execute(
      `UPDATE user_status_events
       SET revoked_at = CURRENT_TIMESTAMP, revoked_by = ?, revoke_reason = ?
       WHERE user_id = ? AND new_status = 'SUSPENDED' AND revoked_at IS NULL`,
      [adminId, reason, userId],
    );
    return this.changeStatus({
      userId,
      adminId,
      status: 'ACTIVE',
      reason,
      action: 'USER_UNSUSPENDED',
      requestId,
    });
  }

  async unban(userId: string, adminId: string, reason: string, requestId?: string) {
    const user = await this.requireUser(userId, true);
    if (user.status !== 'BANNED' && user.status !== 'BLOCKED') {
      throw new ConflictError('Account is not banned');
    }
    await getPool().execute(
      `UPDATE user_status_events
       SET revoked_at = CURRENT_TIMESTAMP, revoked_by = ?, revoke_reason = ?
       WHERE user_id = ? AND new_status IN ('BANNED', 'BLOCKED') AND revoked_at IS NULL`,
      [adminId, reason, userId],
    );
    return this.changeStatus({
      userId,
      adminId,
      status: 'ACTIVE',
      reason,
      action: 'USER_UNBANNED',
      requestId,
    });
  }

  async softDelete(userId: string, adminId: string, reason: string, requestId?: string) {
    const user = await this.requireUser(userId, true);
    await getPool().execute(
      `UPDATE users
       SET deleted_at = CURRENT_TIMESTAMP,
           status = 'INACTIVE',
           status_expires_at = NULL,
           sessions_valid_after = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND deleted_at IS NULL`,
      [userId],
    );
    await revokeUserSessions({ userId, reason: 'account_deleted' });
    await writeAudit({
      actorType: 'admin',
      actorId: adminId,
      action: 'USER_SOFT_DELETED',
      module: 'users',
      entityType: 'user',
      entityId: userId,
      oldValue: { status: user.status, deletedAt: null },
      newValue: { status: 'INACTIVE', deletedAt: 'now' },
      reason,
      requestId,
    });
    return { id: userId, deleted: true };
  }

  async restore(userId: string, adminId: string, reason: string, requestId?: string) {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT id, status, deleted_at FROM users WHERE id = ? LIMIT 1`,
      [userId],
    );
    const user = rows[0];
    if (!user || !user.deleted_at) throw new ValidationError('Only deleted accounts can be restored');
    if (RESTORE_BLOCKED.has(user.status as string)) {
      throw new ConflictError('Banned accounts cannot be restored');
    }
    await getPool().execute(
      `UPDATE users SET deleted_at = NULL, status = 'ACTIVE', status_expires_at = NULL WHERE id = ?`,
      [userId],
    );
    await writeAudit({
      actorType: 'admin',
      actorId: adminId,
      action: 'USER_RESTORED',
      module: 'users',
      entityType: 'user',
      entityId: userId,
      reason,
      requestId,
    });
    return { id: userId, status: 'ACTIVE' };
  }

  async forceLogout(userId: string, adminId: string, reason: string, requestId?: string) {
    await this.requireUser(userId, false);
    await getPool().execute(
      `UPDATE users SET sessions_valid_after = CURRENT_TIMESTAMP WHERE id = ?`,
      [userId],
    );
    await revokeUserSessions({ userId, reason: 'force_logout' });
    await writeAudit({
      actorType: 'admin',
      actorId: adminId,
      action: 'PASSWORD_RESET_FORCED',
      module: 'users',
      entityType: 'user',
      entityId: userId,
      reason,
      requestId,
    });
    return { id: userId, loggedOut: true };
  }

  async revokeSession(userId: string, sessionId: string, adminId: string, reason: string, requestId?: string) {
    await this.requireUser(userId, false);
    await revokeUserSessions({ userId, sessionId, reason });
    await writeAudit({
      actorType: 'admin',
      actorId: adminId,
      action: 'SESSION_REVOKED',
      module: 'sessions',
      entityType: 'user_session',
      entityId: sessionId,
      reason,
      requestId,
    });
  }

  async setRisk(userId: string, adminId: string, riskStatus: string, reason: string, requestId?: string) {
    const user = await this.requireUser(userId, true);
    await getPool().execute(
      `UPDATE users
       SET risk_status = ?, suspicious_at = CASE WHEN ? IN ('SUSPICIOUS', 'RESTRICTED', 'WATCH') THEN CURRENT_TIMESTAMP ELSE suspicious_at END
       WHERE id = ?`,
      [riskStatus, riskStatus, userId],
    );
    await writeAudit({
      actorType: 'admin',
      actorId: adminId,
      action: riskStatus === 'NORMAL' ? 'SUSPICIOUS_CLEARED' : 'USER_MARKED_SUSPICIOUS',
      module: 'users',
      entityType: 'user',
      entityId: userId,
      oldValue: { riskStatus: user.risk_status },
      newValue: { riskStatus },
      reason,
      requestId,
    });
    return { id: userId, riskStatus };
  }

  async addNote(userId: string, adminId: string, body: string) {
    await this.requireUser(userId, true);
    const id = createId();
    await getPool().execute(
      `INSERT INTO user_admin_notes (id, user_id, admin_id, body) VALUES (?, ?, ?, ?)`,
      [id, userId, adminId, body],
    );
    return { id };
  }

  async sessions(userId: string) {
    await this.requireUser(userId, true);
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT id, device_id, platform, device_name, device_model, os_version, app_version,
              app_build, ip_address, created_at, last_active_at, expires_at, revoked_at, revoke_reason
       FROM user_sessions
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId],
    );
    return rows;
  }

  async activity(userId: string) {
    await this.requireUser(userId, true);
    const [security] = await getPool().query<RowDataPacket[]>(
      `SELECT event_type AS action, created_at, 'security' AS source
       FROM user_security_events WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 40`,
      [userId],
    );
    const [status] = await getPool().query<RowDataPacket[]>(
      `SELECT CONCAT(previous_status, '->', new_status) AS action, created_at, 'status' AS source
       FROM user_status_events WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 40`,
      [userId],
    );
    const [orders] = await getPool().query<RowDataPacket[]>(
      `SELECT CONCAT('ORDER_', status) AS action, created_at, order_number AS entity_id
       FROM orders WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 20`,
      [userId],
    );
    return [...security, ...status, ...orders].sort(
      (a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime(),
    );
  }

  async notes(userId: string) {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT id, admin_id, body, created_at
       FROM user_admin_notes WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      [userId],
    );
    return rows;
  }

  private async requireUser(userId: string, activeOnly: boolean) {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT id, status, deleted_at, risk_status FROM users WHERE id = ? LIMIT 1`,
      [userId],
    );
    const user = rows[0];
    if (!user) throw new NotFoundError('User not found');
    if (activeOnly && user.deleted_at) throw new NotFoundError('User not found');
    return user;
  }
}
