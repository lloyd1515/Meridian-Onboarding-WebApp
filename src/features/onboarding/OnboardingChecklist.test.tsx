import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingChecklist } from './OnboardingChecklist';
import type { Employee, Task } from '../../services/db';

const currentUser: Employee = {
  id: 'employee-1',
  name: 'Jane Doe',
  email: 'jane.doe@meridian.com',
  slackHandle: '@jane.doe',
  role: 'Software Specialist',
  department: 'Engineering',
  hireDate: '2022-01-15',
  buddyId: 'buddy-1',
  hybridPreference: 'HYBRID',
};

const buddy: Employee = {
  id: 'buddy-1',
  name: 'Alex Buddy',
  email: 'alex.buddy@meridian.com',
  slackHandle: '@alex.buddy',
  role: 'Senior Engineer',
  department: 'Engineering',
  hireDate: '2019-01-15',
  buddyId: null,
  hybridPreference: 'HYBRID',
};

const tasks: Task[] = [
  { id: 'task-1', title: 'First task', description: '', status: 'pending', dependencies: [] },
];

const mockGetEmployeeChecklist = vi.fn();
const mockGetSlackConfigured = vi.fn();
const mockSendSlackMessage = vi.fn();

vi.mock('../../services/db', async () => {
  const actual = await vi.importActual<typeof import('../../services/db')>('../../services/db');
  return {
    ...actual,
    getEmployeeChecklist: () => mockGetEmployeeChecklist(),
    getSlackConfigured: () => mockGetSlackConfigured(),
    sendSlackMessage: (msg: string) => mockSendSlackMessage(msg),
  };
});

vi.mock('../../context/DbContext', () => ({
  useDb: () => ({
    employees: [currentUser, buddy],
    scheduler: {},
    isLoading: false,
    refreshData: vi.fn(),
    addEmployee: vi.fn(),
    updateEmployee: vi.fn(),
    updateScheduler: vi.fn(),
  }),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    currentUser,
    role: 'employee',
    isPreboarding: false,
    simulationDate: '2026-07-11',
    setRole: vi.fn(),
    setSimulationDate: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe('OnboardingChecklist Slack integration', () => {
  beforeEach(() => {
    mockGetEmployeeChecklist.mockReset();
    mockGetEmployeeChecklist.mockResolvedValue(tasks);
    mockGetSlackConfigured.mockReset();
    mockSendSlackMessage.mockReset();
  });

  it('shows only the copy button (no dead "Send to Slack" button) when the webhook is not configured', async () => {
    mockGetSlackConfigured.mockResolvedValue(false);
    render(<OnboardingChecklist />);

    expect(await screen.findByRole('button', { name: /copy slack intro template/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /send slack intro message/i })).not.toBeInTheDocument();
    });
  });

  it('shows a "Send to Slack" button alongside copy when the webhook is configured, and sends on click', async () => {
    mockGetSlackConfigured.mockResolvedValue(true);
    mockSendSlackMessage.mockResolvedValue(true);
    const user = userEvent.setup();

    render(<OnboardingChecklist />);

    const sendButton = await screen.findByRole('button', { name: /send slack intro message/i });
    expect(screen.getByRole('button', { name: /copy slack intro template/i })).toBeInTheDocument();

    await user.click(sendButton);

    await waitFor(() => {
      expect(mockSendSlackMessage).toHaveBeenCalledWith(expect.stringContaining('@alex.buddy'));
    });
    expect(await screen.findByText('Sent to Slack!')).toBeInTheDocument();
  });
});
