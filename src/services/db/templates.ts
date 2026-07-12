import { API_URL, customFetch, getCSRFToken, credentialsOptions } from './shared';

export interface ChecklistTemplate {
  id: string;
  department: string | null;
  title: string;
  description: string | null;
  defaultStatus: string;
  milestoneOffsetDays: number;
  dependencyIndices: number[] | null;
  sortOrder: number;
}

export interface ChecklistTemplateInput {
  department: string | null;
  title: string;
  description: string | null;
  defaultStatus: string;
  milestoneOffsetDays: number;
  dependencyIndices: number[] | null;
  sortOrder: number;
}

function mapChecklistTemplateToFrontend(t: any): ChecklistTemplate {
  return {
    id: t.id,
    department: t.department,
    title: t.title,
    description: t.description,
    defaultStatus: t.default_status,
    milestoneOffsetDays: t.milestone_offset_days,
    dependencyIndices: t.dependency_indices,
    sortOrder: t.sort_order,
  };
}

function mapChecklistTemplateToBackend(t: ChecklistTemplateInput): any {
  return {
    department: t.department,
    title: t.title,
    description: t.description,
    default_status: t.defaultStatus,
    milestone_offset_days: t.milestoneOffsetDays,
    dependency_indices: t.dependencyIndices,
    sort_order: t.sortOrder,
  };
}

export const getChecklistTemplates = async (): Promise<ChecklistTemplate[]> => {
  const res = await customFetch(`${API_URL}/checklist-templates`, credentialsOptions);
  if (!res.ok) throw new Error('Failed to fetch checklist templates');
  const data = await res.json();
  return data.map(mapChecklistTemplateToFrontend);
};

export const createChecklistTemplate = async (template: ChecklistTemplateInput): Promise<ChecklistTemplate> => {
  const res = await customFetch(`${API_URL}/checklist-templates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCSRFToken()
    },
    body: JSON.stringify(mapChecklistTemplateToBackend(template)),
    ...credentialsOptions
  });
  if (!res.ok) {
    const detail = await res.json();
    throw new Error(detail?.detail || 'Failed to create checklist template');
  }
  return mapChecklistTemplateToFrontend(await res.json());
};

export const updateChecklistTemplate = async (id: string, template: Partial<ChecklistTemplateInput>): Promise<ChecklistTemplate> => {
  const payload: Record<string, unknown> = {};
  if (template.department !== undefined) payload.department = template.department;
  if (template.title !== undefined) payload.title = template.title;
  if (template.description !== undefined) payload.description = template.description;
  if (template.defaultStatus !== undefined) payload.default_status = template.defaultStatus;
  if (template.milestoneOffsetDays !== undefined) payload.milestone_offset_days = template.milestoneOffsetDays;
  if (template.dependencyIndices !== undefined) payload.dependency_indices = template.dependencyIndices;
  if (template.sortOrder !== undefined) payload.sort_order = template.sortOrder;

  const res = await customFetch(`${API_URL}/checklist-templates/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCSRFToken()
    },
    body: JSON.stringify(payload),
    ...credentialsOptions
  });
  if (!res.ok) {
    const detail = await res.json();
    throw new Error(detail?.detail || 'Failed to update checklist template');
  }
  return mapChecklistTemplateToFrontend(await res.json());
};

export const deleteChecklistTemplate = async (id: string): Promise<void> => {
  const res = await customFetch(`${API_URL}/checklist-templates/${id}`, {
    method: 'DELETE',
    headers: {
      'X-CSRF-Token': getCSRFToken()
    },
    ...credentialsOptions
  });
  if (!res.ok) {
    const detail = await res.json();
    throw new Error(detail?.detail || 'Failed to delete checklist template');
  }
};
