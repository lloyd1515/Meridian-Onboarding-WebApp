import {
  API_URL,
  getCSRFToken,
  customFetch,
  credentialsOptions,
  TaskSchema,
  Task,
  parseValid,
  mapTaskToFrontend,
} from './shared';

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
