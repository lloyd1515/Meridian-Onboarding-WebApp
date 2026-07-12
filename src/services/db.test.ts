import { describe, it, expect, vi, afterEach } from 'vitest';
import { taskMilestoneBucket, isTaskOverdue, Task, Employee, generateBackupExport, validateAndRestoreBackup, saveEmployee, saveScheduler, saveEmployeeChecklist, getSlackConfigured, sendSlackMessage, mapEmployeeToFrontend, getEmployees, getEmployeeChecklist } from './db';

const baseTask: Task = {
  id: 't1',
  title: 'Sample Task',
  description: '',
  status: 'pending',
  dependencies: [],
};

describe('taskMilestoneBucket', () => {
  it('buckets a 30-day offset as 30', () => {
    expect(taskMilestoneBucket({ milestoneOffsetDays: 30 })).toBe(30);
  });

  it('buckets a 60-day offset as 60', () => {
    expect(taskMilestoneBucket({ milestoneOffsetDays: 60 })).toBe(60);
  });

  it('buckets a 90-day offset as 90', () => {
    expect(taskMilestoneBucket({ milestoneOffsetDays: 90 })).toBe(90);
  });

  it('buckets an offset between milestones into the nearest higher bucket', () => {
    expect(taskMilestoneBucket({ milestoneOffsetDays: 45 })).toBe(60);
  });

  it('defaults to 90 when the offset is missing (department capstone tasks / legacy rows)', () => {
    expect(taskMilestoneBucket({ milestoneOffsetDays: null })).toBe(90);
    expect(taskMilestoneBucket({ milestoneOffsetDays: undefined })).toBe(90);
  });
});

describe('isTaskOverdue', () => {
  it('is true when the due date is before the reference date and the task is not completed', () => {
    const task: Task = { ...baseTask, dueDate: '2026-07-01', status: 'pending' };
    expect(isTaskOverdue(task, '2026-07-11')).toBe(true);
  });

  it('is false when the due date is in the future', () => {
    const task: Task = { ...baseTask, dueDate: '2026-08-01', status: 'pending' };
    expect(isTaskOverdue(task, '2026-07-11')).toBe(false);
  });

  it('is false when the task is already completed, even past its due date', () => {
    const task: Task = { ...baseTask, dueDate: '2026-07-01', status: 'completed' };
    expect(isTaskOverdue(task, '2026-07-11')).toBe(false);
  });

  it('is false when there is no due date', () => {
    const task: Task = { ...baseTask, dueDate: null, status: 'pending' };
    expect(isTaskOverdue(task, '2026-07-11')).toBe(false);
  });
});

describe('backup export/restore password round-trip', () => {
  const REAL_HASH = '$argon2id$v=19$m=65536,t=3,p=2$realhashforjanedoe';

  const exportResponse = {
    employees: [
      {
        id: 'emp-1',
        name: 'Jane Doe',
        email: 'jane.doe@meridian.com',
        slack_handle: '@jane.doe',
        role: 'employee',
        department: 'Engineering',
        hire_date: '2026-01-01',
        buddy_id: null,
        hybrid_preference: 'HYBRID',
        assigned_desk: null,
        hashed_password: REAL_HASH,
      },
    ],
    checklist_tasks: [],
    schedule_entries: [],
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('carries hashed_password through generateBackupExport as hashedPassword', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => exportResponse,
    }));

    const json = await generateBackupExport();
    const parsed = JSON.parse(json);

    expect(parsed.employees[0].hashedPassword).toBe(REAL_HASH);
  });

  it('round-trips an existing password through export -> restore unchanged', async () => {
    let restorePayload: any = null;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.toString().includes('/backup/export')) {
        return { ok: true, json: async () => exportResponse };
      }
      if (url.toString().includes('/backup/restore')) {
        restorePayload = JSON.parse(init!.body as string);
        return { ok: true, json: async () => ({ status: 'success' }) };
      }
      throw new Error(`Unexpected fetch to ${url}`);
    }));

    const exportedJson = await generateBackupExport();
    const result = await validateAndRestoreBackup(exportedJson, 'RESTORE');

    expect(result.success).toBe(true);
    expect(restorePayload.employees[0].hashed_password).toBe(REAL_HASH);
    expect(restorePayload.confirmation_phrase).toBe('RESTORE');
  });

  it('falls back to the placeholder hash for an employee with no password at all', async () => {
    let restorePayload: any = null;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      restorePayload = JSON.parse(init!.body as string);
      return { ok: true, json: async () => ({ status: 'success' }) };
    }));

    const newHireJson = JSON.stringify({
      version: '2.1',
      employees: [{
        id: 'emp-2',
        name: 'New Hire',
        email: 'new.hire@meridian.com',
        slackHandle: '@new.hire',
        role: 'Software Specialist',
        department: 'Engineering',
        hireDate: '2026-08-01',
        buddyId: null,
        hybridPreference: 'HYBRID',
        assignedDesk: null,
        // no hashedPassword field -- legitimate case, e.g. CSV/manual JSON add
      }],
      checklists: {},
      scheduler: {},
    });

    const result = await validateAndRestoreBackup(newHireJson, 'RESTORE');

    expect(result.success).toBe(true);
    expect(restorePayload.employees[0].hashed_password).toBe(
      '$argon2id$v=19$m=65536,t=3,p=2$supersecurepasswordplaceholder'
    );
  });
});

describe('primary read path Zod validation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const validServerEmployee = {
    id: 'emp-1',
    name: 'Jane Doe',
    email: 'jane.doe@meridian.com',
    slack_handle: '@jane.doe',
    role: 'employee',
    department: 'Engineering',
    hire_date: '2026-01-15',
    buddy_id: null,
    hybrid_preference: 'HYBRID',
    assigned_desk: null,
  };

  it('getEmployees drops a malformed record (e.g. missing @meridian.com email) instead of returning it as-is', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const malformedServerEmployee = { ...validServerEmployee, id: 'emp-2', email: 'not-a-meridian-email@example.com' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [validServerEmployee, malformedServerEmployee],
    }));

    const employees = await getEmployees();

    expect(employees).toHaveLength(1);
    expect(employees[0].id).toBe('emp-1');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Discarding malformed employee'),
      expect.anything(),
      expect.anything()
    );
    consoleErrorSpy.mockRestore();
  });

  it('getEmployeeChecklist drops a malformed task (e.g. invalid status) instead of returning it as-is', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const validTask = { id: 't-1', title: 'Set up laptop', description: '', status: 'pending', dependencies: [] };
    const malformedTask = { id: 't-2', title: 'Bad task', description: '', status: 'not-a-real-status', dependencies: [] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [validTask, malformedTask],
    }));

    const tasks = await getEmployeeChecklist('emp-1');

    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe('t-1');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Discarding malformed task'),
      expect.anything(),
      expect.anything()
    );
    consoleErrorSpy.mockRestore();
  });
});

describe('saveEmployee', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const newHire: Employee = {
    id: 'emp-new-1',
    name: 'New Hire',
    email: 'new.hire@meridian.com',
    slackHandle: '@new.hire',
    role: 'Software Specialist',
    department: 'Engineering',
    hireDate: '2026-08-01',
    buddyId: null,
    hybridPreference: 'HYBRID',
    assignedDesk: null,
  };

  // Regression test for the critical bug: mapEmployeeToBackend used to always
  // send hashed_password: '' for a new hire, which the backend then hashed
  // as the real stored credential -- permanently locking the new hire out.
  // The fix is that the frontend no longer sends any password field at all;
  // the server generates and returns a temp password instead.
  it('does not send a hashed_password field when creating a new employee', async () => {
    let sentBody: any = null;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      sentBody = JSON.parse(init!.body as string);
      return { ok: true, json: async () => ({ id: 'emp-new-1', temporary_password: 'abc123XYZ789' }) };
    }));

    await saveEmployee(newHire);

    expect(sentBody).not.toHaveProperty('hashed_password');
  });

  it('resolves with the server-generated temporary_password on creation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'emp-new-1', temporary_password: 'abc123XYZ789' }),
    }));

    await expect(saveEmployee(newHire)).resolves.toBe('abc123XYZ789');
  });

  it('resolves with undefined when the response has no temporary_password (an update)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'emp-new-1', temporary_password: null }),
    }));

    await expect(saveEmployee(newHire)).resolves.toBeUndefined();
  });
});

describe('saveScheduler', () => {
  const makeEmployees = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: `emp-${i}`,
      name: `Employee ${i}`,
      email: `employee.${i}@meridian.com`,
      slack_handle: `@employee.${i}`,
      role: 'employee',
      department: 'Engineering',
      hire_date: '2025-01-01',
      buddy_id: null,
      hybrid_preference: 'HYBRID',
      assigned_desk: null,
    }));

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves without error when every per-employee POST succeeds', async () => {
    const employees = makeEmployees(210);
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      if (url.toString().includes('/employees')) {
        return { ok: true, json: async () => employees };
      }
      return { ok: true, json: async () => ({ status: 'success', warnings: [] }) };
    }));

    await expect(saveScheduler({})).resolves.toBeUndefined();
  });

  it('throws a partial-failure summary instead of silently reporting success when some POSTs fail (e.g. rate limited)', async () => {
    // Regression test: this used to be the shape of the demo-breaking bug --
    // HybridScheduler.tsx POSTs to /scheduler once per employee, and with the
    // full 210-employee seed dataset most of those requests came back 429
    // while the UI still showed a blanket "saved successfully" message.
    const employees = makeEmployees(210);
    let postCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      if (url.toString().includes('/employees')) {
        return { ok: true, json: async () => employees };
      }
      postCount += 1;
      // First 5 succeed, the rest are rate limited (429), mirroring a
      // partial-failure bulk save.
      if (postCount <= 5) {
        return { ok: true, json: async () => ({ status: 'success', warnings: [] }) };
      }
      return { ok: false, status: 429, json: async () => ({ message: 'Too many requests' }) };
    }));

    await expect(saveScheduler({})).rejects.toThrow(/Saved 5 of 210.*205 failed/);
  });
});

describe('saveEmployeeChecklist', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const currentTasks = [
    { ...baseTask, id: 't1', status: 'pending' as const },
  ];

  it('resolves without error when the complete request succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      if (url.toString().includes('/checklists/t1/complete')) {
        return { ok: true, json: async () => ({}) };
      }
      return { ok: true, json: async () => currentTasks };
    }));

    await expect(
      saveEmployeeChecklist('emp-1', [{ ...baseTask, id: 't1', status: 'completed' }])
    ).resolves.toBeUndefined();
  });

  it('throws instead of silently reporting success when the backend rejects the change (e.g. preboarding 403)', async () => {
    // Regression test: this used to be the shape of the demo-breaking bug --
    // saveEmployeeChecklist never checked res.ok, so a preboarding account's
    // "Complete Task"/"Skip Task" clicks showed full UI success even though
    // the server 403'd and discarded the change; only a reload revealed it.
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      if (url.toString().includes('/checklists/t1/complete')) {
        return { ok: false, status: 403, json: async () => ({ detail: 'Checklist tasks can only be completed from your start date onward' }) };
      }
      return { ok: true, json: async () => currentTasks };
    }));

    await expect(
      saveEmployeeChecklist('emp-1', [{ ...baseTask, id: 't1', status: 'completed' }])
    ).rejects.toThrow(/Saved 0 of 1 task updates -- 1 failed/);
  });
});

describe('mapEmployeeToFrontend', () => {
  // Regression test: AuthContext.syncSession used to hand-roll a duplicate
  // copy of this mapping; it now reuses this exported helper, so both
  // callers must map identically.
  it('maps a snake_case server employee record to the camelCase frontend shape', () => {
    const serverEmployee = {
      id: 'emp-1',
      name: 'Jane Doe',
      email: 'jane.doe@meridian.com',
      slack_handle: '@jane.doe',
      role: 'hr_admin',
      department: 'Engineering',
      hire_date: '2022-01-15',
      buddy_id: 'buddy-1',
      hybrid_preference: 'REMOTE',
      assigned_desk: 'D-12',
    };

    expect(mapEmployeeToFrontend(serverEmployee)).toEqual({
      id: 'emp-1',
      name: 'Jane Doe',
      email: 'jane.doe@meridian.com',
      slackHandle: '@jane.doe',
      role: 'HR Manager',
      department: 'Engineering',
      hireDate: '2022-01-15',
      buddyId: 'buddy-1',
      hybridPreference: 'REMOTE',
      assignedDesk: 'D-12',
    });
  });

  it('defaults hybridPreference to HYBRID when the server omits it', () => {
    const serverEmployee = {
      id: 'emp-2',
      name: 'New Hire',
      email: 'new.hire@meridian.com',
      slack_handle: null,
      role: 'employee',
      department: 'Engineering',
      hire_date: '2026-08-01',
      buddy_id: null,
      hybrid_preference: null,
      assigned_desk: null,
    };

    expect(mapEmployeeToFrontend(serverEmployee).hybridPreference).toBe('HYBRID');
  });
});

describe('getSlackConfigured', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true when the backend reports the webhook is configured', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sent: false, configured: true }),
    }));

    await expect(getSlackConfigured()).resolves.toBe(true);
  });

  it('returns false when the backend reports the webhook is not configured', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sent: false, configured: false }),
    }));

    await expect(getSlackConfigured()).resolves.toBe(false);
  });

  it('returns false (not an error) when the status request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(getSlackConfigured()).resolves.toBe(false);
  });
});

describe('sendSlackMessage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves true when the backend confirms delivery', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sent: true, configured: true }),
    }));

    await expect(sendSlackMessage('Hi @buddy!')).resolves.toBe(true);
  });

  it('resolves false when the webhook is not configured (graceful no-op)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sent: false, configured: false }),
    }));

    await expect(sendSlackMessage('Hi @buddy!')).resolves.toBe(false);
  });

  it('resolves false when the request itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(sendSlackMessage('Hi @buddy!')).resolves.toBe(false);
  });
});
