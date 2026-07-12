import { API_URL, customFetch, credentialsOptions } from './shared';

export interface AuditLogEntry {
  id: string;
  actorEmployeeId: string | null;
  actorName: string | null;
  action: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

function mapAuditLogEntryToFrontend(a: any): AuditLogEntry {
  return {
    id: a.id,
    actorEmployeeId: a.actor_employee_id,
    actorName: a.actor_name,
    action: a.action,
    detail: a.detail,
    createdAt: a.created_at,
  };
}

export const getAuditLog = async (): Promise<AuditLogEntry[]> => {
  try {
    const res = await customFetch(`${API_URL}/backup/audit-log`, credentialsOptions);
    if (!res.ok) return [];
    const data = await res.json();
    return data.map(mapAuditLogEntryToFrontend);
  } catch (e) {
    console.error('Error fetching audit log:', e);
    return [];
  }
};
