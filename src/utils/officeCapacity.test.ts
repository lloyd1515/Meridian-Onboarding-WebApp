import { describe, it, expect } from 'vitest';
import { getOfficeDayLimitError, getOfficeCapacityError } from './officeCapacity';
import { OFFICE_CAPACITY, MAX_OFFICE_DAYS_PER_WEEK } from '../constants/scheduling';

describe('getOfficeDayLimitError', () => {
  it('returns null when under the weekly office-day limit', () => {
    expect(getOfficeDayLimitError(MAX_OFFICE_DAYS_PER_WEEK - 1)).toBeNull();
  });

  it('returns an error message once the weekly office-day limit is reached', () => {
    expect(getOfficeDayLimitError(MAX_OFFICE_DAYS_PER_WEEK)).toContain('Strict limit reached');
  });
});

describe('getOfficeCapacityError', () => {
  it('returns null when occupancy is at or below capacity', () => {
    expect(getOfficeCapacityError(OFFICE_CAPACITY)).toBeNull();
  });

  it('returns an error message once occupancy would exceed capacity', () => {
    expect(getOfficeCapacityError(OFFICE_CAPACITY + 1)).toContain('Capacity limit reached');
  });
});
