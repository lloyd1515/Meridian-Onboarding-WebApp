import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmployeeDirectory } from './EmployeeDirectory';
import type { Employee } from '../../services/db';

const existingBuddy: Employee = {
  id: 'buddy-existing-1',
  name: 'Alice Existing',
  email: 'alice.existing@meridian.com',
  slackHandle: '@alice.existing',
  role: 'Senior Software Engineer',
  department: 'Engineering',
  hireDate: '2022-01-15',
  buddyId: null,
  hybridPreference: 'HYBRID',
};

const editTarget: Employee = {
  id: 'employee-edit-target-1',
  name: 'Sam Editable',
  email: 'sam.editable@meridian.com',
  slackHandle: '@sam.editable',
  role: 'Software Specialist',
  department: 'Sales',
  hireDate: '2022-03-10',
  buddyId: 'buddy-existing-1',
  hybridPreference: 'OFFICE',
  assignedDesk: 'D-1',
};

const mockAddEmployee = vi.fn();
const mockUpdateEmployee = vi.fn();

vi.mock('../../context/DbContext', () => ({
  useDb: () => ({
    employees: [existingBuddy, editTarget],
    scheduler: { '0': [], '1': [], '2': [], '3': [], '4': [] },
    isLoading: false,
    refreshData: vi.fn(),
    addEmployee: mockAddEmployee,
    updateEmployee: mockUpdateEmployee,
    updateScheduler: vi.fn(),
  }),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    currentUser: existingBuddy,
    role: 'admin',
    isPreboarding: false,
    simulationDate: '2026-06-25',
    setRole: vi.fn(),
    setSimulationDate: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('EmployeeDirectory search filter', () => {
  it('filters the list to matching employees by name and hides non-matches', async () => {
    const user = userEvent.setup();
    render(<EmployeeDirectory />);

    expect(screen.getByText('Alice Existing')).toBeInTheDocument();
    expect(screen.getByText('Sam Editable')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/search by name or role/i), 'Sam');

    expect(screen.getByText('Sam Editable')).toBeInTheDocument();
    expect(screen.queryByText('Alice Existing')).not.toBeInTheDocument();
  });
});

describe('EmployeeDirectory Add New Hire', () => {
  beforeEach(() => {
    mockAddEmployee.mockReset();
    mockAddEmployee.mockResolvedValue(undefined);
    mockUpdateEmployee.mockReset();
    mockUpdateEmployee.mockResolvedValue(undefined);
  });

  it('offers every existing employee as a selectable buddy', async () => {
    const user = userEvent.setup();
    render(<EmployeeDirectory />);

    await user.click(screen.getByRole('button', { name: /add new hire/i }));

    const buddySelect = screen.getByLabelText(/associate buddy/i);
    expect(within(buddySelect).getByRole('option', { name: 'Alice Existing' })).toBeInTheDocument();
  });

  // Regression test for the P0.2 bug: new hires were created with a
  // non-UUID id (`emp-${Date.now()}`), which the backend rejected outright.
  it('registers a new hire with a real UUID id', async () => {
    const user = userEvent.setup();
    render(<EmployeeDirectory />);

    await user.click(screen.getByRole('button', { name: /add new hire/i }));

    await user.type(screen.getByLabelText(/full name/i), 'New Hire Person');
    await user.type(screen.getByLabelText(/email/i), 'new.hire@meridian.com');
    await user.type(screen.getByLabelText(/slack handle/i), '@new.hire');
    await user.type(screen.getByLabelText(/corporate role/i), 'Software Specialist');

    await user.click(screen.getByRole('button', { name: /register hire/i }));

    expect(mockAddEmployee).toHaveBeenCalledTimes(1);
    const submitted = mockAddEmployee.mock.calls[0][0];
    expect(submitted.id).toMatch(UUID_V4_REGEX);
    expect(submitted.name).toBe('New Hire Person');
    expect(submitted.email).toBe('new.hire@meridian.com');
  });

  // Regression test for the critical bug fix: a new hire's temp password is
  // now generated server-side and must be surfaced to the HR admin exactly
  // once, since there is no other way for the new hire to learn it.
  it('shows the returned temporary password in a one-time banner after creation', async () => {
    mockAddEmployee.mockResolvedValue('R4nd0m-Temp-Pw');
    const user = userEvent.setup();
    render(<EmployeeDirectory />);

    await user.click(screen.getByRole('button', { name: /add new hire/i }));
    await user.type(screen.getByLabelText(/full name/i), 'New Hire Person');
    await user.type(screen.getByLabelText(/email/i), 'new.hire@meridian.com');
    await user.type(screen.getByLabelText(/slack handle/i), '@new.hire');
    await user.type(screen.getByLabelText(/corporate role/i), 'Software Specialist');
    await user.click(screen.getByRole('button', { name: /register hire/i }));

    expect(await screen.findByText('R4nd0m-Temp-Pw')).toBeInTheDocument();
    expect(screen.getByText(/new hire created/i)).toBeInTheDocument();

    // The drawer must not close on its own while the one-time password is
    // still showing -- it closes only once the admin dismisses it.
    expect(screen.getByRole('dialog', { name: /add new hire/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /done/i }));
    expect(screen.queryByRole('dialog', { name: /add new hire/i })).not.toBeInTheDocument();
  });

  it('closes the drawer immediately when no temporary password is returned (e.g. re-registration edge case)', async () => {
    mockAddEmployee.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<EmployeeDirectory />);

    await user.click(screen.getByRole('button', { name: /add new hire/i }));
    await user.type(screen.getByLabelText(/full name/i), 'New Hire Person');
    await user.type(screen.getByLabelText(/email/i), 'new.hire@meridian.com');
    await user.type(screen.getByLabelText(/slack handle/i), '@new.hire');
    await user.type(screen.getByLabelText(/corporate role/i), 'Software Specialist');
    await user.click(screen.getByRole('button', { name: /register hire/i }));

    expect(screen.queryByRole('dialog', { name: /add new hire/i })).not.toBeInTheDocument();
  });
});

describe('EmployeeDirectory inline edit', () => {
  beforeEach(() => {
    mockAddEmployee.mockReset();
    mockUpdateEmployee.mockReset();
    mockUpdateEmployee.mockResolvedValue(undefined);
  });

  it('opens the edit drawer pre-populated with the row\'s current data', async () => {
    const user = userEvent.setup();
    render(<EmployeeDirectory />);

    await user.click(screen.getByRole('button', { name: `Edit ${editTarget.name}` }));

    const dialog = screen.getByRole('dialog', { name: /edit employee/i });
    expect(within(dialog).getByRole('heading', { name: /edit employee/i })).toBeInTheDocument();
    expect(within(dialog).getByText(editTarget.email, { exact: false })).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/department/i)).toHaveValue('Sales');
    expect(within(dialog).getByLabelText(/associate buddy/i)).toHaveValue('buddy-existing-1');
    expect(within(dialog).getByLabelText(/assigned desk/i)).toHaveValue('D-1');
  });

  it('submits a PATCH-shaped payload (not a full employee re-POST) when saving an edit', async () => {
    const user = userEvent.setup();
    render(<EmployeeDirectory />);

    await user.click(screen.getByRole('button', { name: `Edit ${editTarget.name}` }));
    const dialog = screen.getByRole('dialog', { name: /edit employee/i });
    await user.selectOptions(within(dialog).getByLabelText(/department/i), 'Engineering');
    await user.click(within(dialog).getByRole('button', { name: /save changes/i }));

    expect(mockUpdateEmployee).toHaveBeenCalledTimes(1);
    expect(mockUpdateEmployee).toHaveBeenCalledWith(editTarget.id, {
      department: 'Engineering',
      buddyId: 'buddy-existing-1',
      hybridPreference: 'OFFICE',
      assignedDesk: 'D-1',
    });
    expect(mockAddEmployee).not.toHaveBeenCalled();
  });
});
