import {
  API_URL,
  getCSRFToken,
  customFetch,
  credentialsOptions,
  EmployeeSchema,
  Employee,
  parseValid,
  SCHEDULER_DATES,
  mapEmployeeToFrontend,
  mapEmployeeToBackend,
} from './db/shared';

export * from './db/shared';
export * from './db/audit';
export * from './db/questions';
export * from './db/notifications';
export * from './db/templates';
export * from './db/ics';
export * from './db/backup';
export * from './db/checklist';

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

