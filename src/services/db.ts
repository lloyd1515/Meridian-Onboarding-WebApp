import { z } from 'zod';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8090';

// Helper to get CSRF token from cookies
export function getCSRFToken(): string {
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : '';
}

const credentialsOptions = {
  credentials: 'include' as const
};

let refreshPromise: Promise<boolean> | null = null;

export const customFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const urlString = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const isRefreshRequest = urlString.includes('/auth/refresh');

  const response = await fetch(input, init);

  if (response.status === 401 && !isRefreshRequest) {
    if (!refreshPromise) {
      refreshPromise = (async () => {
        try {
          const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: {
              'X-CSRF-Token': getCSRFToken()
            },
            ...credentialsOptions
          });
          return refreshRes.ok;
        } catch (e) {
          console.error('Error during token refresh:', e);
          return false;
        } finally {
          refreshPromise = null;
        }
      })();
    }

    const refreshSuccess = await refreshPromise;

    if (refreshSuccess) {
      let updatedInit = init || {};
      const method = (updatedInit.method || 'GET').toUpperCase();
      const headersObj = new Headers(updatedInit.headers);
      if (['POST', 'PUT', 'DELETE'].includes(method)) {
        headersObj.set('X-CSRF-Token', getCSRFToken());
      }
      updatedInit = { ...updatedInit, headers: headersObj };
      return fetch(input, updatedInit);
    }
  }

  return response;
};

// Zod Schemas for Data Integrity Validation
export const EmployeeSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address").endsWith("@meridian.com", "Email must end with @meridian.com"),
  slackHandle: z.string().min(1, "Slack handle is required").startsWith("@", "Slack handle must start with @"),
  role: z.string(),
  department: z.string(),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Hire date must be in YYYY-MM-DD format"),
  buddyId: z.string().nullable().optional(),
  hybridPreference: z.enum(['OFFICE', 'REMOTE', 'HYBRID']),
  assignedDesk: z.string().nullable().optional(),
});

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'skipped', 'blocked']),
  skipReason: z.string().nullable().optional(),
  blockedBy: z.string().nullable().optional(),
  dependencies: z.array(z.string()).default([]),
  dueDate: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  milestoneOffsetDays: z.number().nullable().optional(),
});

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

export type Employee = z.infer<typeof EmployeeSchema>;
export type Task = z.infer<typeof TaskSchema>;
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

// An employee counts as a "new hire" as long as their start date hasn't
// arrived yet relative to the app's simulated current date -- the same
// signal AuthContext uses for isPreboarding, rather than guessing from the
// shape of their id (which broke once new-hire ids became real UUIDs).
export function isNewHire(emp: Employee, referenceDate: string): boolean {
  return new Date(emp.hireDate).getTime() > new Date(referenceDate).getTime();
}

// Real due-date-driven replacement for the old title-matching milestone
// inference: the server now stores milestone_offset_days per task
// (server/app/core/checklist_templates.py), computed at seed time from
// hire_date. Bucketing off the offset directly (rather than re-deriving it
// from dueDate - hireDate) means call sites no longer need the employee's
// hireDate on hand just to group tasks.
export function taskMilestoneBucket(task: Pick<Task, 'milestoneOffsetDays'>): 30 | 60 | 90 {
  const offset = task.milestoneOffsetDays;
  if (offset == null) return 90;
  if (offset <= 30) return 30;
  if (offset <= 60) return 60;
  return 90;
}

// True once a task's due date has passed and it hasn't been completed.
export function isTaskOverdue(task: Pick<Task, 'dueDate' | 'status'>, referenceDate: string): boolean {
  if (!task.dueDate || task.status === 'completed') return false;
  return new Date(task.dueDate).getTime() < new Date(referenceDate).getTime();
}

// Baseline scheduler date mapping helper
const SCHEDULER_DATES = [
  '2026-07-06', // Monday (0)
  '2026-07-07', // Tuesday (1)
  '2026-07-08', // Wednesday (2)
  '2026-07-09', // Thursday (3)
  '2026-07-10', // Friday (4)
];

// Helper to convert snake_case keys from server to camelCase for frontend
function mapEmployeeToFrontend(emp: any): Employee {
  return {
    id: emp.id,
    name: emp.name,
    email: emp.email,
    slackHandle: emp.slack_handle,
    role: emp.role === 'hr_admin' ? 'HR Manager' : (emp.role === 'buddy' ? 'Senior Software Engineer' : 'Software Specialist'),
    department: emp.department,
    hireDate: emp.hire_date,
    buddyId: emp.buddy_id,
    hybridPreference: emp.hybrid_preference || 'HYBRID',
    assignedDesk: emp.assigned_desk,
  };
}

// Helper to convert snake_case checklist task keys from server to camelCase
function mapTaskToFrontend(t: any): Task {
  return {
    id: t.id,
    title: t.title,
    description: t.description || '',
    status: t.status,
    skipReason: t.skip_reason,
    blockedBy: t.blocked_by,
    dependencies: t.dependencies || [],
    dueDate: t.due_date,
    completedAt: t.completed_at,
    milestoneOffsetDays: t.milestone_offset_days,
  };
}

// Helper to convert camelCase keys from frontend to snake_case for server
function mapEmployeeToBackend(emp: Employee): any {
  return {
    id: emp.id,
    name: emp.name,
    email: emp.email,
    slack_handle: emp.slackHandle,
    role: emp.role === 'HR Manager' ? 'hr_admin' : (emp.role === 'Senior Software Engineer' ? 'buddy' : 'employee'),
    department: emp.department,
    hire_date: emp.hireDate,
    buddy_id: emp.buddyId || null,
    hybrid_preference: emp.hybridPreference,
    assigned_desk: emp.assignedDesk || null,
    hashed_password: ''
  };
}

export const getEmployees = async (): Promise<Employee[]> => {
  try {
    const res = await customFetch(`${API_URL}/employees`, credentialsOptions);
    if (!res.ok) {
      if (res.status === 403) {
        const meRes = await customFetch(`${API_URL}/employees/me`, credentialsOptions);
        if (meRes.ok) {
          const me = await meRes.json();
          return [mapEmployeeToFrontend(me)];
        }
      }
      return [];
    }
    const data = await res.json();
    return data.map(mapEmployeeToFrontend);
  } catch (e) {
    console.error('Error fetching employees:', e);
    return [];
  }
};

export const saveEmployee = async (employee: Employee): Promise<void> => {
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
      const task: Task = mapTaskToFrontend(t);
      if (!byEmployee[t.employee_id]) {
        byEmployee[t.employee_id] = [];
      }
      byEmployee[t.employee_id].push(task);
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
    return data.map(mapTaskToFrontend);
  } catch (e) {
    console.error('Error fetching employee checklist:', e);
    return [];
  }
};

export const saveEmployeeChecklist = async (employeeId: string, tasks: Task[]): Promise<void> => {
  const current = await getEmployeeChecklist(employeeId);
  for (const t of tasks) {
    const prev = current.find(pt => pt.id === t.id);
    if (prev) {
      if (t.status === 'completed' && prev.status !== 'completed') {
        await customFetch(`${API_URL}/checklists/${t.id}/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': getCSRFToken()
          },
          ...credentialsOptions
        });
      } else if (t.status === 'skipped' && prev.status !== 'skipped') {
        await customFetch(`${API_URL}/checklists/${t.id}/skip`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': getCSRFToken()
          },
          body: JSON.stringify({ skip_reason: t.skipReason || 'Skipped via checklist' }),
          ...credentialsOptions
        });
      }
    }
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
