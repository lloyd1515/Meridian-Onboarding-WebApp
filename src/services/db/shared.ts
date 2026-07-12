import { z } from 'zod';

export const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8090';

// Helper to get CSRF token from cookies
export function getCSRFToken(): string {
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : '';
}

export const credentialsOptions = {
  credentials: 'include' as const
};

let refreshPromise: Promise<boolean> | null = null;

export const customFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const urlString = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const isRefreshRequest = urlString.includes('/auth/refresh');

  const simDate = localStorage.getItem('simulationDate');
  let updatedInit = init || {};
  if (simDate) {
    const headersObj = new Headers(updatedInit.headers);
    headersObj.set('X-Simulation-Date', simDate);
    updatedInit = { ...updatedInit, headers: headersObj };
  }

  const response = await fetch(input, updatedInit);

  if (response.status === 401 && !isRefreshRequest) {
    if (!refreshPromise) {
      refreshPromise = (async () => {
        try {
          const refreshHeaders: Record<string, string> = {
            'X-CSRF-Token': getCSRFToken()
          };
          if (simDate) {
            refreshHeaders['X-Simulation-Date'] = simDate;
          }
          const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: refreshHeaders,
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
      let retryInit = updatedInit || {};
      const method = (retryInit.method || 'GET').toUpperCase();
      const headersObj = new Headers(retryInit.headers);
      if (['POST', 'PUT', 'DELETE'].includes(method)) {
        headersObj.set('X-CSRF-Token', getCSRFToken());
      }
      retryInit = { ...retryInit, headers: headersObj };
      return fetch(input, retryInit);
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

export type Employee = z.infer<typeof EmployeeSchema>;
export type Task = z.infer<typeof TaskSchema>;

// Validates mapped API records against their Zod schema so a malformed
// backend response fails loudly (a console.error, not a silent shape
// mismatch) instead of corrupting UI state. Previously only the backup/CSV
// import path (BackupRestore.tsx) enforced these schemas; this applies the
// same guarantee to the primary API read path (getEmployees/getEmployeeChecklist).
// Malformed records are dropped rather than aborting the whole list so one
// bad row doesn't blank out the entire directory/checklist.
export function parseValid<T>(schema: z.ZodType<T>, items: unknown[], label: string): T[] {
  const valid: T[] = [];
  for (const item of items) {
    const parsed = schema.safeParse(item);
    if (parsed.success) {
      valid.push(parsed.data);
    } else {
      console.error(`Discarding malformed ${label} from API response:`, parsed.error.issues, item);
    }
  }
  return valid;
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
export const SCHEDULER_DATES = [
  '2026-07-06', // Monday (0)
  '2026-07-07', // Tuesday (1)
  '2026-07-08', // Wednesday (2)
  '2026-07-09', // Thursday (3)
  '2026-07-10', // Friday (4)
];

// Helper to convert snake_case keys from server to camelCase for frontend
export function mapEmployeeToFrontend(emp: any): Employee {
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
export function mapTaskToFrontend(t: any): Task {
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

// Helper to convert camelCase keys from frontend to snake_case for server.
// No password field is sent here: POST /employees (save_employee) never
// accepts a client-supplied password -- a new hire's temp password is
// generated server-side and returned once by saveEmployee, and the update
// path doesn't support setting a password at all.
export function mapEmployeeToBackend(emp: Employee): any {
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
  };
}
