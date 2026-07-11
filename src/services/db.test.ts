import { describe, it, expect, vi, afterEach } from 'vitest';
import { taskMilestoneBucket, isTaskOverdue, Task, generateBackupExport, validateAndRestoreBackup } from './db';

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
