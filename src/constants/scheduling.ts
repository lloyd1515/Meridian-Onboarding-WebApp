// Single source of truth for the office capacity rule (hybrid model:
// 130-seat office, warn when nearly full, max 3 office days per week).
// All checks are phrased against the TOTAL headcount including the person
// being added. Backend counterpart: server/app/core/constants.py — keep in sync.
export const OFFICE_CAPACITY = 130;
export const OFFICE_CAPACITY_WARNING = 124;
export const MAX_OFFICE_DAYS_PER_WEEK = 3;
