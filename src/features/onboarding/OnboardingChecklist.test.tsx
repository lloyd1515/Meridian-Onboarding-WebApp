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

describe('OnboardingChecklist custom per-task UI', () => {
  beforeEach(() => {
    mockGetSlackConfigured.mockReset();
    mockGetSlackConfigured.mockResolvedValue(false);
    mockSendSlackMessage.mockReset();
  });

  const customTasks: Task[] = [
    { id: 'task-2', title: 'Configure work laptop', description: 'Set up the laptop.', status: 'pending', dependencies: [] },
    { id: 'task-3', title: 'Info security training', description: 'Complete training.', status: 'pending', dependencies: [] },
    { id: 'task-4', title: 'Install security software', description: 'Install the agent.', status: 'pending', dependencies: [] },
    { id: 'a1b2c3d4-real-uuid', title: 'A normal task', description: 'Nothing special.', status: 'pending', dependencies: [] },
  ];

  it('shows the resource link only for the task-2 fixture id', async () => {
    mockGetEmployeeChecklist.mockReset();
    mockGetEmployeeChecklist.mockResolvedValue(customTasks);
    render(<OnboardingChecklist />);

    await screen.findByText('Configure work laptop');
    expect(screen.getByText('Internal Store')).toBeInTheDocument();
  });

  it('shows the video meeting link only for the task-3 fixture id', async () => {
    mockGetEmployeeChecklist.mockReset();
    mockGetEmployeeChecklist.mockResolvedValue(customTasks);
    render(<OnboardingChecklist />);

    await screen.findByText('Configure work laptop');
    expect(screen.getByText('meet.google.com/meridian-buddy-coffee')).toBeInTheDocument();
  });

  it('opens the centered justification modal (not the inline skip form) when skipping task-3', async () => {
    mockGetEmployeeChecklist.mockReset();
    mockGetEmployeeChecklist.mockResolvedValue(customTasks);
    const user = userEvent.setup();
    render(<OnboardingChecklist />);

    await screen.findByText('Info security training');
    const skipButtons = screen.getAllByRole('button', { name: /skip task/i });
    // customTasks[1] (task-3) is the second pending task rendered.
    await user.click(skipButtons[1]);

    expect(await screen.findByText('Skip Compliance Check')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Skip reason...')).not.toBeInTheDocument();
  });

  it('opens the skip-audit slide-over (not the inline skip form) when skipping task-4', async () => {
    mockGetEmployeeChecklist.mockReset();
    mockGetEmployeeChecklist.mockResolvedValue(customTasks);
    const user = userEvent.setup();
    render(<OnboardingChecklist />);

    await screen.findByText('Install security software');
    const skipButtons = screen.getAllByRole('button', { name: /skip task/i });
    // customTasks[2] (task-4) is the third pending task rendered.
    await user.click(skipButtons[2]);

    expect(await screen.findByText('Skip Audit Flow')).toBeInTheDocument();
  });

  it('uses the plain inline skip form (no special UI) for a task with a real UUID-shaped id', async () => {
    mockGetEmployeeChecklist.mockReset();
    mockGetEmployeeChecklist.mockResolvedValue(customTasks);
    const user = userEvent.setup();
    render(<OnboardingChecklist />);

    await screen.findByText('A normal task');
    const skipButtons = screen.getAllByRole('button', { name: /skip task/i });
    // customTasks[3] (real UUID) is the fourth pending task rendered.
    await user.click(skipButtons[3]);

    expect(await screen.findByPlaceholderText('Skip reason...')).toBeInTheDocument();
    expect(screen.queryByText('Skip Compliance Check')).not.toBeInTheDocument();
    expect(screen.queryByText('Skip Audit Flow')).not.toBeInTheDocument();
  });
});

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
