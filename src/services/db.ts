import { z } from 'zod';
import {
  API_URL,
  getCSRFToken,
  customFetch,
  credentialsOptions,
  EmployeeSchema,
  TaskSchema,
  Employee,
  Task,
  parseValid,
  SCHEDULER_DATES,
  mapEmployeeToFrontend,
  mapTaskToFrontend,
  mapEmployeeToBackend,
} from './db/shared';

export * from './db/shared';

export const BackupSchema = z.object({
  version: z.string(),
  employees: z.array(EmployeeSchema),
  checklists: z.record(z.string(), z.array(TaskSchema)),
  scheduler: z.record(z.string(), z.array(z.string())),
});

export interface AuditLogEntry {
  id: string;
  actorEmployeeId: string | null;
  actorName: string | null;
  action: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

export interface Question {
  id: string;
  employeeId: string;
  employeeName: string | null;
  subject: string;
  body: string;
  status: 'open' | 'answered';
  answer: string | null;
  createdAt: string;
  answeredAt: string | null;
}

export type BackupData = z.infer<typeof BackupSchema>;

export interface ChecklistTemplate {
  id: string;
  department: string | null;
  title: string;
  description: string | null;
  defaultStatus: string;
  milestoneOffsetDays: number;
  dependencyIndices: number[] | null;
  sortOrder: number;
}

export interface ChecklistTemplateInput {
  department: string | null;
  title: string;
  description: string | null;
  defaultStatus: string;
  milestoneOffsetDays: number;
  dependencyIndices: number[] | null;
  sortOrder: number;
}

export const getEmployees = async (): Promise<Employee[]> => {
  try {
    const res = await customFetch(`${API_URL}/employees`, credentialsOptions);
    if (!res.ok) {
      if (res.status === 403) {
        const meRes = await customFetch(`${API_URL}/employees/me`, credentialsOptions);
        if (meRes.ok) {
          const me = await meRes.json();
          return parseValid(EmployeeSchema, [mapEmployeeToFrontend(me)], 'employee');
        }
      }
      return [];
    }
    const data = await res.json();
    return parseValid(EmployeeSchema, data.map(mapEmployeeToFrontend), 'employee');
  } catch (e) {
    console.error('Error fetching employees:', e);
    return [];
  }
};

// Returns the one-time temporary password when this call created a brand
// new employee (undefined for an update to an existing one) -- the backend
// only ever populates temporary_password on creation.
export const saveEmployee = async (employee: Employee): Promise<string | undefined> => {
  const backendEmp = mapEmployeeToBackend(employee);
  const res = await customFetch(`${API_URL}/employees`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCSRFToken()
    },
    body: JSON.stringify(backendEmp),
    ...credentialsOptions
  });
  if (!res.ok) {
    const detail = await res.json();
    throw new Error(detail?.detail || 'Failed to save employee');
  }
  const data = await res.json();
  return data.temporary_password ?? undefined;
};

export type EmployeePatch = Partial<Pick<Employee, 'department' | 'buddyId' | 'hybridPreference' | 'assignedDesk'>>;

export const updateEmployee = async (id: string, patch: EmployeePatch): Promise<void> => {
  const payload: Record<string, unknown> = {};
  if (patch.department !== undefined) payload.department = patch.department;
  if (patch.buddyId !== undefined) payload.buddy_id = patch.buddyId || null;
  if (patch.hybridPreference !== undefined) payload.hybrid_preference = patch.hybridPreference;
  if (patch.assignedDesk !== undefined) payload.assigned_desk = patch.assignedDesk || null;

  const res = await customFetch(`${API_URL}/employees/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCSRFToken()
    },
    body: JSON.stringify(payload),
    ...credentialsOptions
  });
  if (!res.ok) {
    const detail = await res.json();
    throw new Error(detail?.detail || 'Failed to update employee');
  }
};

export const getChecklists = async (): Promise<Record<string, Task[]>> => {
  try {
    const res = await customFetch(`${API_URL}/checklists/all`, credentialsOptions);
    if (!res.ok) return {};
    const data = await res.json();
    const byEmployee: Record<string, Task[]> = {};
    data.forEach((t: any) => {
      const parsed = TaskSchema.safeParse(mapTaskToFrontend(t));
      if (!parsed.success) {
        console.error('Discarding malformed task from API response:', parsed.error.issues, t);
        return;
      }
      if (!byEmployee[t.employee_id]) {
        byEmployee[t.employee_id] = [];
      }
      byEmployee[t.employee_id].push(parsed.data);
    });
    return byEmployee;
  } catch (e) {
    console.error('Error fetching all checklists:', e);
    return {};
  }
};

export const getEmployeeChecklist = async (employeeId: string): Promise<Task[]> => {
  try {
    const res = await customFetch(`${API_URL}/checklists/${employeeId}`, credentialsOptions);
    if (!res.ok) return [];
    const data = await res.json();
    return parseValid(TaskSchema, data.map(mapTaskToFrontend), 'task');
  } catch (e) {
    console.error('Error fetching employee checklist:', e);
    return [];
  }
};

export const saveEmployeeChecklist = async (employeeId: string, tasks: Task[]): Promise<void> => {
  const current = await getEmployeeChecklist(employeeId);
  const attempted: string[] = [];
  const failures: string[] = [];

  for (const t of tasks) {
    const prev = current.find(pt => pt.id === t.id);
    if (prev) {
      if (t.status === 'completed' && prev.status !== 'completed') {
        attempted.push(t.title || t.id);
        const res = await customFetch(`${API_URL}/checklists/${t.id}/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': getCSRFToken()
          },
          ...credentialsOptions
        });
        // The caller updates local state optimistically before this resolves,
        // so a failure (e.g. the server's hire-date gate 403ing for a
        // preboarding account) must be surfaced -- otherwise the UI keeps
        // showing "completed"/"skipped" for a change that was never
        // persisted, silently reverting only on the next page reload.
        if (!res.ok) {
          failures.push(t.title || t.id);
        }
      } else if (t.status === 'skipped' && prev.status !== 'skipped') {
        attempted.push(t.title || t.id);
        const res = await customFetch(`${API_URL}/checklists/${t.id}/skip`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': getCSRFToken()
          },
          body: JSON.stringify({ skip_reason: t.skipReason || 'Skipped via checklist' }),
          ...credentialsOptions
        });
        if (!res.ok) {
          failures.push(t.title || t.id);
        }
      }
    }
  }

  if (failures.length > 0) {
    const succeeded = attempted.length - failures.length;
    throw new Error(
      `Saved ${succeeded} of ${attempted.length} task updates -- ${failures.length} failed (${failures.slice(0, 5).join(', ')}${failures.length > 5 ? ', ...' : ''}). Please retry.`
    );
  }
};

export interface BuddyStuckTask {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
}

export interface BuddyHireEntry {
  employee: {
    id: string;
    name: string;
    department: string;
    hireDate: string;
  };
  stuckTasks: BuddyStuckTask[];
  totalTasks: number;
  completedTasks: number;
}

export const getBuddyView = async (): Promise<BuddyHireEntry[]> => {
  try {
    const res = await customFetch(`${API_URL}/employees/me/buddy-view`, credentialsOptions);
    if (!res.ok) return [];
    const data = await res.json();
    return data.hires.map((h: any) => ({
      employee: {
        id: h.employee.id,
        name: h.employee.name,
        department: h.employee.department,
        hireDate: h.employee.hire_date,
      },
      stuckTasks: h.stuck_tasks.map((t: any) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueDate: t.due_date,
      })),
      totalTasks: h.total_tasks,
      completedTasks: h.completed_tasks,
    }));
  } catch (e) {
    console.error('Error fetching buddy view:', e);
    return [];
  }
};

export const getScheduler = async (): Promise<Record<string, string[]>> => {
  const columns: Record<string, string[]> = {
    '0': [], '1': [], '2': [], '3': [], '4': []
  };
  try {
    const res = await customFetch(`${API_URL}/scheduler`, credentialsOptions);
    if (!res.ok) return columns;
    
    const entries = await res.json();
    entries.forEach((e: any) => {
      if (e.status === 'office') {
        const dayIdx = SCHEDULER_DATES.indexOf(e.date);
        if (dayIdx !== -1) {
          columns[dayIdx.toString()].push(e.employee_id);
        }
      }
    });
  } catch (e) {
    console.error('Error fetching scheduler:', e);
  }
  return columns;
};

export const saveScheduler = async (scheduler: Record<string, string[]>): Promise<void> => {
  const employees = await getEmployees();
  const failures: string[] = [];

  for (const emp of employees) {
    const bookings = SCHEDULER_DATES.map((dateStr, idx) => {
      const isOffice = (scheduler[idx.toString()] || []).includes(emp.id);
      return {
        date: dateStr,
        status: isOffice ? 'office' : 'remote'
      };
    });

    const res = await customFetch(`${API_URL}/scheduler`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCSRFToken()
      },
      body: JSON.stringify({
        employee_id: emp.id,
        bookings: bookings
      }),
      ...credentialsOptions
    });

    // Each employee is saved via its own request, so a failure for one
    // employee must not be silently swallowed while the rest succeed --
    // otherwise the caller would report a blanket "saved successfully"
    // even though most of the changes never persisted (e.g. rate limiting).
    if (!res.ok) {
      failures.push(emp.name || emp.id);
    }
  }

  if (failures.length > 0) {
    const succeeded = employees.length - failures.length;
    throw new Error(
      `Saved ${succeeded} of ${employees.length} employees -- ${failures.length} failed (${failures.slice(0, 5).join(', ')}${failures.length > 5 ? ', ...' : ''}). Please retry.`
    );
  }
};

// Downloads the current user's first-week agenda as a real .ics file.
// A plain <a href> to this endpoint would 401 -- cookie auth here requires
// `credentials: 'include'`, which a bare anchor navigation never sends -- so
// this fetches the file as a blob and triggers the save via a temporary,
// programmatically-clicked link instead.
export const downloadAgendaIcs = async (): Promise<void> => {
  const res = await customFetch(`${API_URL}/employees/me/agenda.ics`, credentialsOptions);
  if (!res.ok) {
    throw new Error('Failed to download agenda calendar file.');
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'agenda.ics';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

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

function mapQuestionToFrontend(q: any): Question {
  return {
    id: q.id,
    employeeId: q.employee_id,
    employeeName: q.employee_name,
    subject: q.subject,
    body: q.body,
    status: q.status,
    answer: q.answer,
    createdAt: q.created_at,
    answeredAt: q.answered_at,
  };
}

export const getQuestions = async (): Promise<Question[]> => {
  try {
    const res = await customFetch(`${API_URL}/questions`, credentialsOptions);
    if (!res.ok) return [];
    const data = await res.json();
    return data.map(mapQuestionToFrontend);
  } catch (e) {
    console.error('Error fetching questions:', e);
    return [];
  }
};

export const askQuestion = async (subject: string, body: string): Promise<Question> => {
  const res = await customFetch(`${API_URL}/questions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCSRFToken()
    },
    body: JSON.stringify({ subject, body }),
    ...credentialsOptions
  });
  if (!res.ok) {
    const detail = await res.json();
    throw new Error(detail?.detail || 'Failed to submit question');
  }
  return mapQuestionToFrontend(await res.json());
};

export const answerQuestion = async (questionId: string, answer: string): Promise<Question> => {
  const res = await customFetch(`${API_URL}/questions/${questionId}/answer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCSRFToken()
    },
    body: JSON.stringify({ answer }),
    ...credentialsOptions
  });
  if (!res.ok) {
    const detail = await res.json();
    throw new Error(detail?.detail || 'Failed to submit answer');
  }
  return mapQuestionToFrontend(await res.json());
};

export const getSlackConfigured = async (): Promise<boolean> => {
  try {
    const res = await customFetch(`${API_URL}/notifications/slack/status`, credentialsOptions);
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.configured);
  } catch (e) {
    console.error('Error checking Slack configuration:', e);
    return false;
  }
};

export const sendSlackMessage = async (message: string): Promise<boolean> => {
  const res = await customFetch(`${API_URL}/notifications/slack`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCSRFToken()
    },
    body: JSON.stringify({ message }),
    ...credentialsOptions
  });
  if (!res.ok) return false;
  const data = await res.json();
  return Boolean(data.sent);
};

function mapChecklistTemplateToFrontend(t: any): ChecklistTemplate {
  return {
    id: t.id,
    department: t.department,
    title: t.title,
    description: t.description,
    defaultStatus: t.default_status,
    milestoneOffsetDays: t.milestone_offset_days,
    dependencyIndices: t.dependency_indices,
    sortOrder: t.sort_order,
  };
}

function mapChecklistTemplateToBackend(t: ChecklistTemplateInput): any {
  return {
    department: t.department,
    title: t.title,
    description: t.description,
    default_status: t.defaultStatus,
    milestone_offset_days: t.milestoneOffsetDays,
    dependency_indices: t.dependencyIndices,
    sort_order: t.sortOrder,
  };
}

export const getChecklistTemplates = async (): Promise<ChecklistTemplate[]> => {
  const res = await customFetch(`${API_URL}/checklist-templates`, credentialsOptions);
  if (!res.ok) throw new Error('Failed to fetch checklist templates');
  const data = await res.json();
  return data.map(mapChecklistTemplateToFrontend);
};

export const createChecklistTemplate = async (template: ChecklistTemplateInput): Promise<ChecklistTemplate> => {
  const res = await customFetch(`${API_URL}/checklist-templates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCSRFToken()
    },
    body: JSON.stringify(mapChecklistTemplateToBackend(template)),
    ...credentialsOptions
  });
  if (!res.ok) {
    const detail = await res.json();
    throw new Error(detail?.detail || 'Failed to create checklist template');
  }
  return mapChecklistTemplateToFrontend(await res.json());
};

export const updateChecklistTemplate = async (id: string, template: Partial<ChecklistTemplateInput>): Promise<ChecklistTemplate> => {
  const payload: Record<string, unknown> = {};
  if (template.department !== undefined) payload.department = template.department;
  if (template.title !== undefined) payload.title = template.title;
  if (template.description !== undefined) payload.description = template.description;
  if (template.defaultStatus !== undefined) payload.default_status = template.defaultStatus;
  if (template.milestoneOffsetDays !== undefined) payload.milestone_offset_days = template.milestoneOffsetDays;
  if (template.dependencyIndices !== undefined) payload.dependency_indices = template.dependencyIndices;
  if (template.sortOrder !== undefined) payload.sort_order = template.sortOrder;

  const res = await customFetch(`${API_URL}/checklist-templates/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCSRFToken()
    },
    body: JSON.stringify(payload),
    ...credentialsOptions
  });
  if (!res.ok) {
    const detail = await res.json();
    throw new Error(detail?.detail || 'Failed to update checklist template');
  }
  return mapChecklistTemplateToFrontend(await res.json());
};

export const deleteChecklistTemplate = async (id: string): Promise<void> => {
  const res = await customFetch(`${API_URL}/checklist-templates/${id}`, {
    method: 'DELETE',
    headers: {
      'X-CSRF-Token': getCSRFToken()
    },
    ...credentialsOptions
  });
  if (!res.ok) {
    const detail = await res.json();
    throw new Error(detail?.detail || 'Failed to delete checklist template');
  }
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
