import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { HybridScheduler } from './HybridScheduler';
import type { Employee } from '../../services/db';

const scheduledEmployee: Employee = {
  id: 'emp-scheduled',
  name: 'Scheduled Sam',
  email: 'scheduled.sam@meridian.com',
  slackHandle: '@scheduled.sam',
  role: 'Software Specialist',
  department: 'Engineering',
  hireDate: '2022-01-15',
  buddyId: null,
  hybridPreference: 'HYBRID',
};

const unassignedEmployee: Employee = {
  id: 'emp-unassigned',
  name: 'Unassigned Uma',
  email: 'unassigned.uma@meridian.com',
  slackHandle: '@unassigned.uma',
  role: 'Software Specialist',
  department: 'Engineering',
  hireDate: '2022-01-15',
  buddyId: null,
  hybridPreference: 'HYBRID',
};

// Stable references (not recreated per useDb() call) -- HybridScheduler syncs
// `scheduler` into local state via a useEffect keyed on it, so a fresh object
// identity on every render would loop indefinitely.
const mockScheduler = { '0': ['emp-scheduled'], '1': [], '2': [], '3': [], '4': [] };
const mockEmployees = [scheduledEmployee, unassignedEmployee];

vi.mock('../../context/DbContext', () => ({
  useDb: () => ({
    employees: mockEmployees,
    scheduler: mockScheduler,
    isLoading: false,
    refreshData: vi.fn(),
    addEmployee: vi.fn(),
    updateEmployee: vi.fn(),
    updateScheduler: vi.fn(),
  }),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    currentUser: scheduledEmployee,
    role: 'admin',
    isPreboarding: false,
    simulationDate: '2026-07-11',
    setRole: vi.fn(),
    setSimulationDate: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe('HybridScheduler unassigned pool', () => {
  it('places an employee already scheduled on a day into that day column, not the unassigned pool', () => {
    render(<HybridScheduler />);

    const unassignedGroup = screen.getByRole('group', { name: /unassigned pool/i });
    expect(within(unassignedGroup).queryByText('Scheduled Sam')).not.toBeInTheDocument();
    expect(within(unassignedGroup).getByText('Unassigned Uma')).toBeInTheDocument();

    const mondayGroup = screen.getByRole('group', { name: /^monday/i });
    expect(within(mondayGroup).getByText('Scheduled Sam')).toBeInTheDocument();
  });
});
