import { z } from 'zod';
import {
  API_URL,
  getCSRFToken,
  customFetch,
  credentialsOptions,
  EmployeeSchema,
  TaskSchema,
  Task,
  SCHEDULER_DATES,
  mapEmployeeToFrontend,
  mapTaskToFrontend,
} from './shared';

export const BackupSchema = z.object({
  version: z.string(),
  employees: z.array(EmployeeSchema),
  checklists: z.record(z.string(), z.array(TaskSchema)),
  scheduler: z.record(z.string(), z.array(z.string())),
});

export type BackupData = z.infer<typeof BackupSchema>;

export interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

export const validateAndRestoreBackup = async (jsonString: string, confirmationPhrase: string): Promise<ValidationResult> => {
  const result: ValidationResult = {
    success: false,
    errors: [],
    warnings: [],
  };

  try {
    const rawData = JSON.parse(jsonString);

    const backendEmployees = (rawData.employees || []).map((e: any) => ({
      id: e.id,
      name: e.name,
      email: e.email,
      slack_handle: e.slackHandle,
      role: e.role === 'HR Manager' ? 'hr_admin' : (e.role === 'Senior Software Engineer' ? 'buddy' : 'employee'),
      department: e.department,
      hire_date: e.hireDate,
      buddy_id: e.buddyId || null,
      hybrid_preference: e.hybridPreference || 'HYBRID',
      assigned_desk: e.assignedDesk || null,
      // hashedPassword (camelCase) is what generateBackupExport emits for an
      // employee that already had a password. A row with no hashedPassword
      // at all (e.g. hand-written JSON or a CSV-derived entry) legitimately
      // has none yet, so it still falls back to the placeholder hash.
      hashed_password: e.hashedPassword || '$argon2id$v=19$m=65536,t=3,p=2$supersecurepasswordplaceholder'
    }));

    const backendTasks: any[] = [];
    const checklists = rawData.checklists || {};
    Object.keys(checklists).forEach(empId => {
      (checklists[empId] || []).forEach((t: any) => {
        backendTasks.push({
          id: t.id,
          employee_id: empId,
          title: t.title,
          description: t.description || '',
          status: t.status,
          skip_reason: t.skipReason || null,
          blocked_by: t.blockedBy || null,
          dependencies: t.dependencies || []
        });
      });
    });

    const backendSchedules: any[] = [];
    const scheduler = rawData.scheduler || {};
    Object.keys(scheduler).forEach(dayIdxStr => {
      const dayIdx = parseInt(dayIdxStr, 10);
      const dateStr = SCHEDULER_DATES[dayIdx];
      if (dateStr) {
        (scheduler[dayIdxStr] || []).forEach((empId: string) => {
          backendSchedules.push({
            id: crypto.randomUUID ? crypto.randomUUID() : 'gen-uuid-' + Math.random(),
            employee_id: empId,
            date: dateStr,
            status: 'office'
          });
        });
      }
    });

    const payload = {
      version: "1.0",
      exported_at: new Date().toISOString(),
      employees: backendEmployees,
      checklist_tasks: backendTasks,
      schedule_entries: backendSchedules,
      confirmation_phrase: confirmationPhrase
    };

    const res = await customFetch(`${API_URL}/backup/restore`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCSRFToken()
      },
      body: JSON.stringify(payload),
      ...credentialsOptions
    });

    if (res.ok) {
      result.success = true;
    } else {
      const detail = await res.json();
      result.errors = [detail?.detail || 'Database restore failed'];
    }
  } catch (err: any) {
    result.errors = [err?.message || 'Invalid JSON format or structure'];
  }

  return result;
};

export const generateBackupExport = async (): Promise<string> => {
  const res = await customFetch(`${API_URL}/backup/export`, credentialsOptions);
  if (!res.ok) throw new Error('Failed to export backup');

  const data = await res.json();
  // The v2.1 export is otherwise just mapEmployeeToFrontend's camelCase shape,
  // but restore needs each employee's existing password hash to survive the
  // round trip -- mapEmployeeToFrontend itself is shared with getEmployees/
  // addEmployee/updateScheduler (see impact() HIGH-risk fan-out) and must not
  // grow a password field, so it's appended here instead, backup-export-only.
  const employees = data.employees.map((e: any) => ({
    ...mapEmployeeToFrontend(e),
    hashedPassword: e.hashed_password,
  }));

  const checklists: Record<string, Task[]> = {};
  data.checklist_tasks.forEach((t: any) => {
    if (!checklists[t.employee_id]) {
      checklists[t.employee_id] = [];
    }
    checklists[t.employee_id].push(mapTaskToFrontend(t));
  });

  const scheduler: Record<string, string[]> = {
    '0': [], '1': [], '2': [], '3': [], '4': []
  };
  data.schedule_entries.forEach((s: any) => {
    if (s.status === 'office') {
      const dayIdx = SCHEDULER_DATES.indexOf(s.date);
      if (dayIdx !== -1) {
        scheduler[dayIdx.toString()].push(s.employee_id);
      }
    }
  });

  const backup = {
    version: '2.1',
    employees,
    checklists,
    scheduler
  };

  return JSON.stringify(backup, null, 2);
};
