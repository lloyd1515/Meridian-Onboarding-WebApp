// Shared office-capacity validation used by both HybridScheduler.tsx (HR admin
// drag-and-drop) and DashboardPage.tsx (self-service day toggle) so the two
// call sites can't drift on the capacity rules. See src/constants/scheduling.ts
// for the underlying numbers.
import { OFFICE_CAPACITY, MAX_OFFICE_DAYS_PER_WEEK } from '../constants/scheduling';

// Returns an error message if the employee is already scheduled the max
// number of office days this week, otherwise null.
export function getOfficeDayLimitError(scheduledDaysCount: number): string | null {
  if (scheduledDaysCount >= MAX_OFFICE_DAYS_PER_WEEK) {
    return `🔒 Strict limit reached: This employee is already scheduled for ${MAX_OFFICE_DAYS_PER_WEEK} office days this week.`;
  }
  return null;
}

// Returns an error message if adding one more employee would push a single
// day's occupancy over capacity, otherwise null. `occupancyAfterAdd` is the
// day's headcount including the employee being added.
export function getOfficeCapacityError(occupancyAfterAdd: number): string | null {
  if (occupancyAfterAdd > OFFICE_CAPACITY) {
    return `🔒 Capacity limit reached! The office cannot exceed ${OFFICE_CAPACITY} employees on any single day.`;
  }
  return null;
}
