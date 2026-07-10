# Business constants for the office capacity rule. Deliberately not in
# config.py/Settings — these are product rules, not deployment config.
# All checks are phrased against the TOTAL headcount including the person
# being added. Frontend counterpart: src/constants/scheduling.ts — keep in sync.
OFFICE_CAPACITY = 130
OFFICE_CAPACITY_WARNING = 124
MAX_OFFICE_DAYS_PER_WEEK = 3
