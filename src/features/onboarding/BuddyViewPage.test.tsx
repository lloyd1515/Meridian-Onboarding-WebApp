import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BuddyViewPage } from './BuddyViewPage';
import type { BuddyHireEntry } from '../../services/db';

const mockGetBuddyView = vi.fn();

vi.mock('../../services/db', () => ({
  getBuddyView: () => mockGetBuddyView(),
}));

const hireWithStuckTasks: BuddyHireEntry = {
  employee: {
    id: 'hire-1',
    name: 'Jane Doe',
    department: 'Engineering',
    hireDate: '2026-07-01',
  },
  stuckTasks: [
    { id: 'task-1', title: 'Install security software', status: 'blocked', dueDate: null },
    { id: 'task-2', title: 'Meet the team', status: 'pending', dueDate: '2026-07-05' },
  ],
  totalTasks: 4,
  completedTasks: 1,
};

describe('BuddyViewPage', () => {
  beforeEach(() => {
    mockGetBuddyView.mockReset();
  });

  it('renders the empty state when the user is not anyone\'s buddy', async () => {
    mockGetBuddyView.mockResolvedValue([]);
    render(<BuddyViewPage />);

    expect(await screen.findByText(/not buddying for anyone/i)).toBeInTheDocument();
  });

  it('renders hire list with stuck tasks and a coffee-scheduling affordance', async () => {
    mockGetBuddyView.mockResolvedValue([hireWithStuckTasks]);
    render(<BuddyViewPage />);

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Install security software')).toBeInTheDocument();
    expect(screen.getByText('Meet the team')).toBeInTheDocument();
    expect(screen.getByText('1/4 tasks completed')).toBeInTheDocument();

    const coffeeLink = screen.getByRole('link', { name: /schedule a coffee/i });
    expect(coffeeLink).toHaveAttribute('href', expect.stringContaining('mailto:'));
  });

  it('renders a no-stuck-tasks message when a hire has none', async () => {
    mockGetBuddyView.mockResolvedValue([{ ...hireWithStuckTasks, stuckTasks: [] }]);
    render(<BuddyViewPage />);

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText(/things look on track/i)).toBeInTheDocument();
  });
});
