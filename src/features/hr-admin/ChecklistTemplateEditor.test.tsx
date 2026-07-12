import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChecklistTemplateEditor } from './ChecklistTemplateEditor';
import type { ChecklistTemplate } from '../../services/db';

const existingTemplate: ChecklistTemplate = {
  id: 'template-1',
  department: null,
  title: 'Sign employment contract',
  description: 'Complete electronic signing of your contract and annexes in the portal.',
  defaultStatus: 'completed',
  milestoneOffsetDays: 30,
  dependencyIndices: [],
  sortOrder: 0,
};

const mockGetChecklistTemplates = vi.fn();
const mockCreateChecklistTemplate = vi.fn();
const mockUpdateChecklistTemplate = vi.fn();
const mockDeleteChecklistTemplate = vi.fn();

vi.mock('../../services/db', () => ({
  getChecklistTemplates: () => mockGetChecklistTemplates(),
  createChecklistTemplate: (t: unknown) => mockCreateChecklistTemplate(t),
  updateChecklistTemplate: (id: string, t: unknown) => mockUpdateChecklistTemplate(id, t),
  deleteChecklistTemplate: (id: string) => mockDeleteChecklistTemplate(id),
}));

describe('ChecklistTemplateEditor', () => {
  beforeEach(() => {
    mockGetChecklistTemplates.mockReset();
    mockCreateChecklistTemplate.mockReset();
    mockUpdateChecklistTemplate.mockReset();
    mockDeleteChecklistTemplate.mockReset();
    mockGetChecklistTemplates.mockResolvedValue([existingTemplate]);
    mockUpdateChecklistTemplate.mockResolvedValue({ ...existingTemplate, title: 'Sign employment contract (updated)' });
  });

  it('renders templates grouped by department', async () => {
    render(<ChecklistTemplateEditor />);

    expect(await screen.findByText('Sign employment contract')).toBeInTheDocument();
    expect(screen.getByText('Shared (all departments)')).toBeInTheDocument();
  });

  it('edits a template field and submits the update', async () => {
    const user = userEvent.setup();
    render(<ChecklistTemplateEditor />);

    await screen.findByText('Sign employment contract');
    await user.click(screen.getByRole('button', { name: /edit/i }));

    const titleInput = screen.getByLabelText(/title/i);
    await user.clear(titleInput);
    await user.type(titleInput, 'Sign employment contract (updated)');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(mockUpdateChecklistTemplate).toHaveBeenCalledTimes(1);
    const [id, payload] = mockUpdateChecklistTemplate.mock.calls[0];
    expect(id).toBe('template-1');
    expect(payload.title).toBe('Sign employment contract (updated)');

    expect(await screen.findByText('Sign employment contract (updated)')).toBeInTheDocument();
  });

  it('blocks delete until confirmed, and leaves the template intact on cancel', async () => {
    // Regression test: deleting a template used to fire immediately on a
    // single "DELETE" click, unlike Backup/Restore's typed-confirmation
    // gate -- one misclick permanently deleted a template.
    const user = userEvent.setup();
    render(<ChecklistTemplateEditor />);

    await screen.findByText('Sign employment contract');
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    // First click only arms confirmation; the delete endpoint must not be
    // called yet, and the template must still be visible.
    expect(mockDeleteChecklistTemplate).not.toHaveBeenCalled();
    expect(screen.getByText('Sign employment contract')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockDeleteChecklistTemplate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
  });

  it('deletes the template once the confirmation click follows', async () => {
    mockDeleteChecklistTemplate.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ChecklistTemplateEditor />);

    await screen.findByText('Sign employment contract');
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await user.click(screen.getByRole('button', { name: /confirm delete/i }));

    expect(mockDeleteChecklistTemplate).toHaveBeenCalledTimes(1);
    expect(mockDeleteChecklistTemplate).toHaveBeenCalledWith('template-1');
  });
});
