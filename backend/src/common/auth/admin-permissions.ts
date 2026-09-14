import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../database/pool.js';

const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; roles: string[]; permissions: Set<string> }>();

export function invalidateAdminPermissionCache(adminId?: string): void {
  if (adminId) cache.delete(adminId);
  else cache.clear();
}

export async function loadAdminAccess(adminId: string): Promise<{
  roles: string[];
  permissions: Set<string>;
}> {
  const hit = cache.get(adminId);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return { roles: hit.roles, permissions: hit.permissions };
  }

  const [roleRows] = await getPool().query<RowDataPacket[]>(
    `SELECT r.code
     FROM admin_user_roles ur
     INNER JOIN admin_roles r ON r.id = ur.role_id
     WHERE ur.admin_user_id = ?`,
    [adminId],
  );
  const roles = roleRows.map((row) => row.code as string);
  const permissions = new Set<string>();
  if (roles.includes('SUPER_ADMIN')) {
    permissions.add('*');
  } else if (roles.length > 0) {
    const [permRows] = await getPool().query<RowDataPacket[]>(
      `SELECT DISTINCT p.code
       FROM admin_user_roles ur
       INNER JOIN admin_role_permissions rp ON rp.role_id = ur.role_id
       INNER JOIN admin_permissions p ON p.id = rp.permission_id
       WHERE ur.admin_user_id = ?`,
      [adminId],
    );
    for (const row of permRows) permissions.add(row.code as string);
  }

  cache.set(adminId, { at: Date.now(), roles, permissions });
  return { roles, permissions };
}

export function hasPermission(permissions: Set<string>, code: string): boolean {
  return permissions.has('*') || permissions.has(code);
}
