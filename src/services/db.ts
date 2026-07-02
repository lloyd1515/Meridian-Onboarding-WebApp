import { z } from 'zod';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8090';

// Helper to get CSRF token from cookies
function getCSRFToken(): string {
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : '';
}

const credentialsOptions = {
  credentials: 'include' as const
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
  hybridPreference: z.enum(['BIROU', 'REMOTE', 'HIBRID']),
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
});

export const BackupSchema = z.object({
  version: z.string(),
  employees: z.array(EmployeeSchema),
  checklists: z.record(z.string(), z.array(TaskSchema)),
  scheduler: z.record(z.string(), z.array(z.string())),
});

export type Employee = z.infer<typeof EmployeeSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type BackupData = z.infer<typeof BackupSchema>;

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
    hybridPreference: emp.hybrid_preference || 'HIBRID',
    assignedDesk: emp.assigned_desk,
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
    hashed_password: '' // handled on server or in seed
  };
}

export const initializeDb = async (forceReset = false): Promise<void> => {
  // Database initialization is done backend-side via migrations and seed script
  return Promise.resolve();
};

export const getEmployees = async (): Promise<Employee[]> => {
  try {
    const res = await fetch(`${API_URL}/employees`, credentialsOptions);
    if (!res.ok) {
      if (res.status === 403) {
        // Fallback: regular employee can fetch their own profile details
        const meRes = await fetch(`${API_URL}/employees/me`, credentialsOptions);
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
  const res = await fetch(`${API_URL}/employees`, {
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

export const getChecklists = async (): Promise<Record<string, Task[]>> => {
  // Not used globally in a full stack setup since checklists are queried per-employee,
  // but to preserve mock type signature:
  return {};
};

export const getEmployeeChecklist = async (employeeId: string): Promise<Task[]> => {
  try {
    const res = await fetch(`${API_URL}/checklists/${employeeId}`, credentialsOptions);
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description || '',
      status: t.status,
      skipReason: t.skip_reason,
      blockedBy: t.blocked_by,
      dependencies: t.dependencies || [],
    }));
  } catch (e) {
    console.error('Error fetching employee checklist:', e);
    return [];
  }
};

export const saveEmployeeChecklist = async (employeeId: string, tasks: Task[]): Promise<void> => {
  // Intelligently compare status updates to run backendcomplete/skip triggers
  const current = await getEmployeeChecklist(employeeId);
  for (const t of tasks) {
    const prev = current.find(pt => pt.id === t.id);
    if (prev) {
      if (t.status === 'completed' && prev.status !== 'completed') {
        await fetch(`${API_URL}/checklists/${t.id}/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': getCSRFToken()
          },
          ...credentialsOptions
        });
      } else if (t.status === 'skipped' && prev.status !== 'skipped') {
        await fetch(`${API_URL}/checklists/${t.id}/skip`, {
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

export const getScheduler = async (): Promise<Record<string, string[]>> => {
  const columns: Record<string, string[]> = {
    '0': [], '1': [], '2': [], '3': [], '4': []
  };
  try {
    const res = await fetch(`${API_URL}/scheduler`, credentialsOptions);
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
  // Sync the scheduler with the backend
  // Find all employees to identify their assignments
  const employees = await getEmployees();
  for (const emp of employees) {
    const bookings = SCHEDULER_DATES.map((dateStr, idx) => {
      const isOffice = (scheduler[idx.toString()] || []).includes(emp.id);
      return {
        date: dateStr,
        status: isOffice ? 'office' : 'remote'
      };
    });
    
    await fetch(`${API_URL}/scheduler`, {
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
  }
};

export interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

export const validateAndRestoreBackup = async (jsonString: string): Promise<ValidationResult> => {
  const result: ValidationResult = {
    success: false,
    errors: [],
    warnings: [],
  };

  try {
    const rawData = JSON.parse(jsonString);
    
    // Convert keys to backend structure
    const backendEmployees = (rawData.employees || []).map((e: any) => ({
      id: e.id,
      name: e.name,
      email: e.email,
      slack_handle: e.slackHandle,
      role: e.role === 'HR Manager' ? 'hr_admin' : (e.role === 'Senior Software Engineer' ? 'buddy' : 'employee'),
      department: e.department,
      hire_date: e.hireDate,
      buddy_id: e.buddyId || null,
      hybrid_preference: e.hybridPreference || 'HIBRID',
      assigned_desk: e.assignedDesk || null,
      hashed_password: e.hashed_password || '$argon2id$v=19$m=65536,t=3,p=2$supersecurepasswordplaceholder'
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
      schedule_entries: backendSchedules
    };

    const res = await fetch(`${API_URL}/backup/restore`, {
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
  const res = await fetch(`${API_URL}/backup/export`, credentialsOptions);
  if (!res.ok) throw new Error('Failed to export backup');
  
  const data = await res.json();
  
  // Format backend export data into frontend backup format
  const employees = data.employees.map(mapEmployeeToFrontend);
  
  const checklists: Record<string, Task[]> = {};
  data.checklist_tasks.forEach((t: any) => {
    if (!checklists[t.employee_id]) {
      checklists[t.employee_id] = [];
    }
    checklists[t.employee_id].push({
      id: t.id,
      title: t.title,
      description: t.description || '',
      status: t.status,
      skipReason: t.skip_reason,
      blockedBy: t.blocked_by,
      dependencies: t.dependencies || []
    });
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
