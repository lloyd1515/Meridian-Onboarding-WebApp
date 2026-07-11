import { describe, it, expect } from 'vitest';
import { taskMilestoneBucket, isTaskOverdue, Task } from './db';

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
