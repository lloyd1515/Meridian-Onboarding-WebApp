import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BackupRestore } from './BackupRestore';
import type { AuditLogEntry } from '../../services/db';

const mockRefreshData = vi.fn();
const mockValidateAndRestoreBackup = vi.fn();
const mockGenerateBackupExport = vi.fn();
const mockGetAuditLog = vi.fn();

vi.mock('../../context/DbContext', () => ({
  useDb: () => ({
    refreshData: mockRefreshData,
  }),
}));

vi.mock('../../services/db', async () => {
  const actual = await vi.importActual<typeof import('../../services/db')>('../../services/db');
  return {
    ...actual,
    validateAndRestoreBackup: (...args: unknown[]) => mockValidateAndRestoreBackup(...args),
    generateBackupExport: (...args: unknown[]) => mockGenerateBackupExport(...args),
    getAuditLog: (...args: unknown[]) => mockGetAuditLog(...args),
    saveEmployee: vi.fn(),
  };
});

const sampleAuditLog: AuditLogEntry[] = [
  {
    id: 'audit-1',
    actorEmployeeId: 'emp-1',
    actorName: 'Vlad HR Admin',
    action: 'backup_restore',
    detail: { employees_restored: 3, tasks_restored: 5, schedules_restored: 2 },
    createdAt: '2026-07-11T10:00:00Z',
  },
];

function makeJsonFile(content: string) {
  return new File([content], 'backup.json', { type: 'application/json' });
}

describe('BackupRestore typed confirmation', () => {
  beforeEach(() => {
    mockRefreshData.mockReset();
    mockValidateAndRestoreBackup.mockReset();
    mockGenerateBackupExport.mockReset();
    mockGetAuditLog.mockReset();
    mockGetAuditLog.mockResolvedValue([]);
    mockValidateAndRestoreBackup.mockResolvedValue({ success: true, errors: [], warnings: [] });
  });

  it('gates the restore button behind the typed RESTORE phrase', async () => {
    const user = userEvent.setup();
    render(<BackupRestore />);

    const fileInput = screen.getByLabelText(/restore backup file/i);
    await user.upload(fileInput, makeJsonFile('{"employees":[]}'));

    const confirmButton = await screen.findByRole('button', { name: /confirm restore/i });
    expect(confirmButton).toBeDisabled();

    const confirmationInput = screen.getByLabelText(/type restore to confirm/i);
    await user.type(confirmationInput, 'wrong phrase');
    expect(confirmButton).toBeDisabled();

    await user.clear(confirmationInput);
    await user.type(confirmationInput, 'RESTORE');
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockValidateAndRestoreBackup).toHaveBeenCalledWith(
        expect.any(String),
        'RESTORE'
      );
    });
  });

  it('does not call validateAndRestoreBackup while the confirm button is disabled', async () => {
    const user = userEvent.setup();
    render(<BackupRestore />);

    const fileInput = screen.getByLabelText(/restore backup file/i);
    await user.upload(fileInput, makeJsonFile('{"employees":[]}'));

    const confirmationInput = screen.getByLabelText(/type restore to confirm/i);
    await user.type(confirmationInput, 'restore'); // lowercase -- must not match
    const confirmButton = screen.getByRole('button', { name: /confirm restore/i });
    expect(confirmButton).toBeDisabled();

    await user.click(confirmButton);
    expect(mockValidateAndRestoreBackup).not.toHaveBeenCalled();
  });

  it('renders recent audit log entries', async () => {
    mockGetAuditLog.mockResolvedValue(sampleAuditLog);
    render(<BackupRestore />);

    expect(await screen.findByText(/backup_restore/i)).toBeInTheDocument();
    expect(screen.getByText(/vlad hr admin/i)).toBeInTheDocument();
    expect(screen.getByText(/employees_restored: 3/i)).toBeInTheDocument();
  });

  it('shows an empty state when there is no audit log history yet', async () => {
    mockGetAuditLog.mockResolvedValue([]);
    render(<BackupRestore />);

    expect(await screen.findByText(/no restores have been recorded yet/i)).toBeInTheDocument();
  });
});
