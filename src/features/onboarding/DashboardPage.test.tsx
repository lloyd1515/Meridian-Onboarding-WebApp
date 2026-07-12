import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';
import type { Employee } from '../../services/db';

const currentUser: Employee = {
  id: 'employee-1',
  name: 'Jane Doe',
  email: 'jane.doe@meridian.com',
  slackHandle: '@jane.doe',
  role: 'Software Specialist',
  department: 'Engineering',
  hireDate: '2022-01-15',
  buddyId: null,
  hybridPreference: 'HYBRID',
};

const mockGetEmployeeChecklist = vi.fn();
const mockDownloadAgendaIcs = vi.fn();

vi.mock('../../services/db', async () => {
  const actual = await vi.importActual<typeof import('../../services/db')>('../../services/db');
  return {
    ...actual,
    getEmployeeChecklist: () => mockGetEmployeeChecklist(),
    downloadAgendaIcs: () => mockDownloadAgendaIcs(),
  };
});

vi.mock('../../context/DbContext', () => ({
  useDb: () => ({
    employees: [currentUser],
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

describe('DashboardPage agenda calendar export', () => {
  beforeEach(() => {
    mockGetEmployeeChecklist.mockReset();
    mockGetEmployeeChecklist.mockResolvedValue([]);
    mockDownloadAgendaIcs.mockReset();
    mockDownloadAgendaIcs.mockResolvedValue(undefined);
  });

  it('renders a "Download .ics" button next to This Week\'s Agenda', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("This Week's Agenda")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download \.ics/i })).toBeInTheDocument();
  });

  it('triggers the agenda download service when clicked', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    const button = await screen.findByRole('button', { name: /download \.ics/i });
    await user.click(button);

    expect(mockDownloadAgendaIcs).toHaveBeenCalledTimes(1);
  });

  it('shows an inline error banner (not a native alert) when the download fails', async () => {
    mockDownloadAgendaIcs.mockRejectedValue(new Error('network error'));
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    const button = await screen.findByRole('button', { name: /download \.ics/i });
    await user.click(button);

    expect(await screen.findByText('Could not download the calendar file. Please try again.')).toBeInTheDocument();
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});

describe('DashboardPage office-day limit', () => {
  beforeEach(() => {
    mockGetEmployeeChecklist.mockReset();
    mockGetEmployeeChecklist.mockResolvedValue([]);
  });

  it('shows an inline error banner (not a native alert) when the weekly office-day limit is reached', async () => {
    vi.resetModules();
    vi.doMock('../../context/DbContext', () => ({
      useDb: () => ({
        employees: [currentUser],
        // currentUser is already scheduled on 3 days (Mon/Tue/Wed); toggling
        // Thursday on should hit the MAX_OFFICE_DAYS_PER_WEEK limit.
        scheduler: { '0': ['employee-1'], '1': ['employee-1'], '2': ['employee-1'], '3': [], '4': [] },
        isLoading: false,
        refreshData: vi.fn(),
        addEmployee: vi.fn(),
        updateEmployee: vi.fn(),
        updateScheduler: vi.fn(),
      }),
    }));
    const { DashboardPage: DashboardPageWithFullWeek } = await import('./DashboardPage');
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DashboardPageWithFullWeek />
      </MemoryRouter>
    );

    const thursdayButton = await screen.findByRole('button', { name: /^Thu/ });
    await user.click(thursdayButton);

    expect(await screen.findByText(/Strict limit reached/)).toBeInTheDocument();
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
    vi.doUnmock('../../context/DbContext');
    vi.resetModules();
  });
});
