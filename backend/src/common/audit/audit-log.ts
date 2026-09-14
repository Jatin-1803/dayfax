import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../database/pool.js';
import { createId } from '../utils/id.js';
import { redactAuditValue } from './redact.js';

export interface AuditInput {
  actorType: 'admin' | 'user' | 'system';
  actorId?: string | null;
  action: string;
  module: string;
  entityType?: string | null;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  result?: 'SUCCESS' | 'FAILURE';
}

export async function writeAudit(input: AuditInput): Promise<void> {
  await getPool().execute(
    `INSERT INTO audit_logs (
       id, actor_type, actor_id, action, module, entity_type, entity_id,
       old_value, new_value, reason, ip_address, user_agent, request_id, result
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      createId(),
      input.actorType,
      input.actorId ?? null,
      input.action,
      input.module,
      input.entityType ?? null,
      input.entityId ?? null,
      input.oldValue == null ? null : JSON.stringify(redactAuditValue(input.oldValue)),
      input.newValue == null ? null : JSON.stringify(redactAuditValue(input.newValue)),
      input.reason ?? null,
      input.ipAddress ?? null,
      input.userAgent ?? null,
      input.requestId ?? null,
      input.result ?? 'SUCCESS',
    ],
  );
}

export async function listAuditLogs(input: {
  limit: number;
  offset: number;
  module?: string;
  entityId?: string;
}): Promise<{ total: number; rows: RowDataPacket[] }> {
  const filters: string[] = [];
  const params: Array<string | number> = [];
  if (input.module) {
    filters.push('module = ?');
    params.push(input.module);
  }
  if (input.entityId) {
    filters.push('entity_id = ?');
    params.push(input.entityId);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [countRows] = await getPool().query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM audit_logs ${where}`,
    params,
  );
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT id, actor_type, actor_id, action, module, entity_type, entity_id,
            old_value, new_value, reason, ip_address, request_id, result, created_at
     FROM audit_logs
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, input.limit, input.offset],
  );
  return { total: Number(countRows[0]?.total ?? 0), rows };
}
