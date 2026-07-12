import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RelationshipExplorer } from './RelationshipExplorer';
import type { Employee } from '../../services/db';

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

const mockGetSlackConfigured = vi.fn();
const mockSendSlackMessage = vi.fn();

vi.mock('../../services/db', async () => {
  const actual = await vi.importActual<typeof import('../../services/db')>('../../services/db');
  return {
    ...actual,
    getSlackConfigured: () => mockGetSlackConfigured(),
    sendSlackMessage: (msg: string) => mockSendSlackMessage(msg),
  };
});

describe('RelationshipExplorer Slack integration', () => {
  beforeEach(() => {
    mockGetSlackConfigured.mockReset();
    mockSendSlackMessage.mockReset();
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn() } });
  });

  it('does not show a "Send" button when Slack is not configured, only Copy', async () => {
    mockGetSlackConfigured.mockResolvedValue(false);
    const user = userEvent.setup();
    render(<RelationshipExplorer currentUser={currentUser} employees={[currentUser, buddy]} />);

    const buddyCards = await screen.findAllByRole('button', { name: /view contact details for alex buddy/i });
    await user.click(buddyCards[0]);

    expect(await screen.findByText(/Contact Alex Buddy/i)).toBeInTheDocument();
    expect(screen.getByText(/Invite for Coffee/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /send coffee invite to slack/i })).not.toBeInTheDocument();
    });
  });

  it('sends the coffee template to Slack when configured', async () => {
    mockGetSlackConfigured.mockResolvedValue(true);
    mockSendSlackMessage.mockResolvedValue(true);
    const user = userEvent.setup();
    render(<RelationshipExplorer currentUser={currentUser} employees={[currentUser, buddy]} />);

    const buddyCards = await screen.findAllByRole('button', { name: /view contact details for alex buddy/i });
    await user.click(buddyCards[0]);

    const sendButton = await screen.findByRole('button', { name: /send coffee invite to slack/i });
    await user.click(sendButton);

    await waitFor(() => {
      expect(mockSendSlackMessage).toHaveBeenCalledWith(expect.stringContaining('Alex'));
    });
    expect(await screen.findByText('Sent!')).toBeInTheDocument();
  });

  // Regression test: formatSlackTemplate used to build the "intro yourself"
  // message straight from currentUser.name/role with no sanitization, unlike
  // OnboardingChecklist's equivalent formatter. A name/role containing Slack
  // mention syntax (e.g. "@channel") could then ping the whole channel when
  // sent. The shared useSlackSend hook's sanitizeSlackText now strips that.
  it('sanitizes Slack mention syntax out of the sender name/role in the intro template', async () => {
    mockGetSlackConfigured.mockResolvedValue(true);
    mockSendSlackMessage.mockResolvedValue(true);
    const maliciousUser: Employee = { ...currentUser, name: '@channel Jane', role: '@here Specialist' };
    const user = userEvent.setup();
    render(<RelationshipExplorer currentUser={maliciousUser} employees={[maliciousUser, buddy]} />);

    const buddyCards = await screen.findAllByRole('button', { name: /view contact details for alex buddy/i });
    await user.click(buddyCards[0]);

    const introSendButton = await screen.findByRole('button', { name: /send introduction to slack/i });
    await user.click(introSendButton);

    await waitFor(() => {
      expect(mockSendSlackMessage).toHaveBeenCalledWith(expect.not.stringContaining('@'));
    });
  });
});
