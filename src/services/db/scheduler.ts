import {
  API_URL,
  getCSRFToken,
  customFetch,
  credentialsOptions,
  SCHEDULER_DATES,
} from './shared';
import { getEmployees } from './employees';

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
