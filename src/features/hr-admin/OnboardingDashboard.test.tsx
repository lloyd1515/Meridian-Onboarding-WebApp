import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingDashboard } from './OnboardingDashboard';
import type { Employee, Task } from '../../services/db';

const employee: Employee = {
  id: 'emp-1',
  name: 'Jane Doe',
  email: 'jane.doe@meridian.com',
  slackHandle: '@jane.doe',
  role: 'Software Specialist',
  department: 'Engineering',
  hireDate: '2026-01-01',
  buddyId: null,
  hybridPreference: 'HYBRID',
};

const tasks: Task[] = [
  { id: 't-30', title: 'Configure work laptop', description: 'Set up the laptop.', status: 'completed', dependencies: [], milestoneOffsetDays: 30 },
  { id: 't-60', title: 'Information security training', description: 'Complete training.', status: 'skipped', skipReason: 'Deferred by manager', dependencies: [], milestoneOffsetDays: 60 },
  { id: 't-90', title: 'Present a mini-demo', description: 'Demo the project.', status: 'pending', dependencies: [], milestoneOffsetDays: 90 },
];

const mockGetChecklists = vi.fn();

vi.mock('../../services/db', async () => {
  const actual = await vi.importActual<typeof import('../../services/db')>('../../services/db');
  return {
    ...actual,
    getChecklists: () => mockGetChecklists(),
  };
});

vi.mock('../../context/DbContext', () => ({
  useDb: () => ({
    employees: [employee],
    scheduler: { '0': [], '1': [], '2': [], '3': [], '4': [] },
    isLoading: false,
    refreshData: vi.fn(),
    addEmployee: vi.fn(),
    updateEmployee: vi.fn(),
    updateScheduler: vi.fn(),
  }),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    currentUser: employee,
    role: 'admin',
    isPreboarding: false,
    simulationDate: '2026-07-11',
    setRole: vi.fn(),
    setSimulationDate: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe('OnboardingDashboard milestone breakdown', () => {
  beforeEach(() => {
    mockGetChecklists.mockReset();
    mockGetChecklists.mockResolvedValue({ 'emp-1': tasks });
  });

  it('renders a 30/60/90-day column for each milestone with its own tasks and percentage, once expanded', async () => {
    const user = userEvent.setup();
    render(<OnboardingDashboard />);

    const [row] = await screen.findAllByText('Jane Doe');
    await user.click(row);

    expect(await screen.findByText('30-Day Milestones')).toBeInTheDocument();
    expect(screen.getByText('60-Day Milestones')).toBeInTheDocument();
    expect(screen.getByText('90-Day Milestones')).toBeInTheDocument();

    expect(screen.getByText('Configure work laptop')).toBeInTheDocument();
    expect(screen.getByText('Information security training')).toBeInTheDocument();
    expect(screen.getByText('Present a mini-demo')).toBeInTheDocument();

    // The skipped 60-day task shows its skip reason inline (also mirrored in
    // the Skip Justifications feed, hence findAll rather than a single match).
    expect(screen.getAllByText(/Deferred by manager/).length).toBeGreaterThan(0);
  });

  it('shows a "no tasks" placeholder for a milestone with none in the filtered list', async () => {
    mockGetChecklists.mockResolvedValue({ 'emp-1': [tasks[0]] });
    const user = userEvent.setup();
    render(<OnboardingDashboard />);

    const [row] = await screen.findAllByText('Jane Doe');
    await user.click(row);

    expect(await screen.findByText('No 60-day tasks.')).toBeInTheDocument();
    expect(screen.getByText('No 90-day tasks.')).toBeInTheDocument();
  });
});
