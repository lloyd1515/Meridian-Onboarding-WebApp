import React, { useEffect, useState } from 'react';
import {
  ChecklistTemplate,
  ChecklistTemplateInput,
  createChecklistTemplate,
  deleteChecklistTemplate,
  getChecklistTemplates,
  updateChecklistTemplate,
} from '../../services/db';
import { SlideOver } from '../../components/SlideOver';

const DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'Finance', 'HR'];

const emptyFormState: ChecklistTemplateInput = {
  department: null,
  title: '',
  description: '',
  defaultStatus: 'pending',
  milestoneOffsetDays: 30,
  dependencyIndices: [],
  sortOrder: 0,
};

export const ChecklistTemplateEditor: React.FC = () => {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [isOpenForm, setIsOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ChecklistTemplateInput>(emptyFormState);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadTemplates = async () => {
    setIsLoading(true);
    setError('');
    try {
      setTemplates(await getChecklistTemplates());
    } catch (err: any) {
      setError(err.message || 'Failed to load checklist templates');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const openAddForm = () => {
    setEditingId(null);
    setForm(emptyFormState);
    setIsOpenForm(true);
  };

  const openEditForm = (template: ChecklistTemplate) => {
    setEditingId(template.id);
    setForm({
      department: template.department,
      title: template.title,
      description: template.description,
      defaultStatus: template.defaultStatus,
      milestoneOffsetDays: template.milestoneOffsetDays,
      dependencyIndices: template.dependencyIndices,
      sortOrder: template.sortOrder,
    });
    setIsOpenForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editingId) {
        const updated = await updateChecklistTemplate(editingId, form);
        setTemplates(prev => prev.map(t => (t.id === editingId ? updated : t)));
      } else {
        const created = await createChecklistTemplate(form);
        setTemplates(prev => [...prev, created]);
      }
      setIsOpenForm(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save checklist template');
    }
  };

  const handleDelete = async (id: string) => {
    setError('');
    try {
      await deleteChecklistTemplate(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (err: any) {
      setError(err.message || 'Failed to delete checklist template');
    } finally {
      setConfirmDeleteId(null);
    }
  };

  // Deleting a template is a single-click-away, permanent action (unlike
  // Backup/Restore's typed "RESTORE" gate, there was previously no
  // confirmation step at all). A lighter inline button-swap is proportionate
  // here given the smaller blast radius: clicking "Delete" once arms a
  // "Confirm"/"Cancel" pair in its place instead of deleting immediately.
  const handleDeleteClick = (id: string) => {
    if (confirmDeleteId === id) {
      handleDelete(id);
    } else {
      setConfirmDeleteId(id);
    }
  };

  const groups: { label: string; department: string | null; items: ChecklistTemplate[] }[] = [
    {
      label: 'Shared (all departments)',
      department: null,
      items: templates.filter(t => t.department === null).sort((a, b) => a.sortOrder - b.sortOrder),
    },
    ...DEPARTMENTS.map(dept => ({
      label: dept,
      department: dept,
      items: templates.filter(t => t.department === dept).sort((a, b) => a.sortOrder - b.sortOrder),
    })),
  ];

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div className="border border-border bg-surface p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
        <div>
          <h2 className="text-h1 font-bold text-[#0B2A3D] mb-1">Checklist Templates</h2>
          <p className="text-body-sm text-text-muted">
            Edit the default onboarding tasks assigned to new hires ({templates.length} templates).
          </p>
        </div>
        <button
          onClick={openAddForm}
          className="flex items-center justify-between gap-3 bg-[#0B2A3D] hover:bg-[#13313F] text-white px-5 py-2.5 rounded-full font-sans font-medium text-body-sm transition-colors shadow-sm select-none"
        >
          <span>Add Template</span>
          <span className="flex items-center justify-center w-5 h-5 bg-white rounded-full text-[#0B2A3D]">
            <span className="material-symbols-outlined text-[14px] font-bold">add</span>
          </span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-danger text-danger text-caption p-3 rounded-xl font-mono">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="p-8 text-center text-text-muted font-mono text-caption uppercase select-none">
          Loading...
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(group => (
            <div key={group.label} className="border border-border bg-surface rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-[#E9F1F3] border-b border-border px-4 py-3 font-mono text-caption text-text-muted uppercase font-bold">
                {group.label}
              </div>
              {group.items.length > 0 ? (
                <div className="flex flex-col divide-y divide-border">
                  {group.items.map(template => (
                    <div key={template.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="flex flex-col truncate">
                        <span className="text-body-sm font-bold text-[#0B2A3D] truncate">{template.title}</span>
                        <span className="text-caption text-text-muted truncate">{template.description}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono text-[11px] border border-border px-2 py-0.5 rounded bg-slate-50 font-bold">
                          {template.milestoneOffsetDays}d
                        </span>
                        <button
                          onClick={() => openEditForm(template)}
                          className="text-caption font-mono uppercase text-[#0B2A3D] hover:underline"
                        >
                          Edit
                        </button>
                        {confirmDeleteId === template.id ? (
                          <>
                            <button
                              onClick={() => handleDelete(template.id)}
                              className="text-caption font-mono uppercase text-danger font-bold hover:underline"
                            >
                              Confirm Delete
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-caption font-mono uppercase text-text-muted hover:underline"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleDeleteClick(template.id)}
                            className="text-caption font-mono uppercase text-danger hover:underline"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-3 text-caption text-text-muted italic">No templates.</div>
              )}
            </div>
          ))}
        </div>
      )}

      {isOpenForm && (
        <SlideOver
          onClose={() => setIsOpenForm(false)}
          ariaLabel={editingId ? 'Edit Template' : 'Add Template'}
          className="w-full max-w-[480px] p-6 flex flex-col gap-4 overflow-y-auto rounded-l-2xl"
        >
            <div className="flex justify-between items-center border-b border-border pb-2">
              <h3 className="text-h2 font-bold text-[#0B2A3D]">
                {editingId ? 'Edit Template' : 'Add Template'}
              </h3>
              <button
                onClick={() => setIsOpenForm(false)}
                aria-label="Close drawer"
                className="material-symbols-outlined text-[#0B2A3D] cursor-pointer hover:text-red-500 transition-colors"
              >
                close
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="templateTitle" className="font-mono text-caption uppercase text-text-primary font-bold">Title</label>
                <input
                  id="templateTitle"
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                  className="border border-border bg-white px-3 py-2 rounded-xl text-body-sm focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="templateDescription" className="font-mono text-caption uppercase text-text-primary font-bold">Description</label>
                <textarea
                  id="templateDescription"
                  rows={3}
                  value={form.description || ''}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  className="border border-border bg-white px-3 py-2 rounded-xl text-body-sm focus:outline-none focus:border-accent resize-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="templateDepartment" className="font-mono text-caption uppercase text-text-primary font-bold">Department</label>
                <select
                  id="templateDepartment"
                  value={form.department ?? ''}
                  onChange={(e) => setForm(f => ({ ...f, department: e.target.value || null }))}
                  className="border border-border bg-white px-3 py-2 rounded-xl text-body-sm focus:outline-none focus:border-accent cursor-pointer"
                >
                  <option value="">Shared (all departments)</option>
                  {DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="templateMilestone" className="font-mono text-caption uppercase text-text-primary font-bold">Milestone Offset (days)</label>
                <input
                  id="templateMilestone"
                  type="number"
                  required
                  value={form.milestoneOffsetDays}
                  onChange={(e) => setForm(f => ({ ...f, milestoneOffsetDays: Number(e.target.value) }))}
                  className="border border-border bg-white px-3 py-2 rounded-xl text-body-sm focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="templateSortOrder" className="font-mono text-caption uppercase text-text-primary font-bold">Sort Order</label>
                <input
                  id="templateSortOrder"
                  type="number"
                  required
                  value={form.sortOrder}
                  onChange={(e) => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
                  className="border border-border bg-white px-3 py-2 rounded-xl text-body-sm focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex gap-3 mt-4 pt-4 border-t border-border">
                <button
                  type="submit"
                  className="flex-grow flex items-center justify-center gap-2 bg-[#0B2A3D] hover:bg-[#13313F] text-white px-4 py-2.5 rounded-full font-sans font-medium text-body-sm transition-colors shadow-sm select-none"
                >
                  <span>{editingId ? 'Save Changes' : 'Create Template'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpenForm(false)}
                  className="flex-grow py-2.5 border border-border rounded-full font-sans font-medium text-body-sm text-[#0B2A3D] hover:bg-slate-50 transition-colors select-none"
                >
                  Cancel
                </button>
              </div>
            </form>
        </SlideOver>
      )}
    </div>
  );
};

export default ChecklistTemplateEditor;
