import React, { useState } from 'react';
import { Employee } from '../../services/db';

export interface EmployeeSlideOverSubmitData {
  name: string;
  email: string;
  slack: string;
  roleName: string;
  department: string;
  buddyId: string;
  hybridPreference: 'OFFICE' | 'REMOTE' | 'HYBRID';
  hireDate: string;
  assignedDesk: string;
}

interface EmployeeSlideOverProps {
  mode: 'create' | 'edit';
  employee?: Employee;
  buddiesList: Employee[];
  onClose: () => void;
  onSubmit: (data: EmployeeSlideOverSubmitData) => Promise<void>;
}

const DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'];

// Slide-over drawer shared by "Add New Hire" (mode: create) and the per-row
// "Edit" affordance (mode: edit). Identity fields (name/email/slack/role/hire
// date) are only editable in create mode -- the backend's PATCH /employees/{id}
// endpoint deliberately excludes them, so showing them as editable in edit
// mode would silently no-op and mislead HR into thinking the change saved.
export const EmployeeSlideOver: React.FC<EmployeeSlideOverProps> = ({ mode, employee, buddiesList, onClose, onSubmit }) => {
  const [name, setName] = useState(employee?.name ?? '');
  const [email, setEmail] = useState(employee?.email ?? '');
  const [slack, setSlack] = useState(employee?.slackHandle ?? '');
  const [roleName, setRoleName] = useState(employee?.role ?? '');
  const [dept, setDept] = useState(employee?.department ?? 'Engineering');
  const [buddyId, setBuddyId] = useState(employee?.buddyId ?? '');
  const [pref, setPref] = useState<'OFFICE' | 'REMOTE' | 'HYBRID'>(employee?.hybridPreference ?? 'HYBRID');
  const [hireDate, setHireDate] = useState(employee?.hireDate ?? '2026-07-01');
  const [assignedDesk, setAssignedDesk] = useState(employee?.assignedDesk ?? '');
  const [formError, setFormError] = useState('');

  const isEdit = mode === 'edit';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!isEdit) {
      if (!email.endsWith('@meridian.com')) {
        setFormError('Email must end with @meridian.com');
        return;
      }
      if (!slack.startsWith('@')) {
        setFormError('Slack handle must start with @');
        return;
      }
    }

    try {
      await onSubmit({ name, email, slack, roleName, department: dept, buddyId, hybridPreference: pref, hireDate, assignedDesk });
    } catch (err: any) {
      setFormError(err.message || `Failed to ${isEdit ? 'update' : 'register'} employee`);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#000000]/40 z-50 flex justify-end">
      <div className="bg-white border-l border-border w-full max-w-[800px] h-full p-6 flex flex-col md:flex-row gap-6 overflow-y-auto rounded-l-2xl shadow-2xl">
        <div className="flex-grow flex flex-col gap-4 max-w-[420px]">
          <div className="flex justify-between items-center border-b border-border pb-2">
            <h3 className="text-h2 font-bold text-[#0B2A3D]">{isEdit ? 'Edit Employee' : 'Add New Hire'}</h3>
            <button
              onClick={onClose}
              className="material-symbols-outlined text-[#0B2A3D] cursor-pointer md:hidden hover:text-red-500 transition-colors"
            >
              close
            </button>
          </div>

          {formError && (
            <div className="bg-red-50 border border-danger text-danger text-caption p-3 rounded-xl font-mono">
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {isEdit ? (
              <div className="border border-border bg-slate-50 rounded-xl p-3 flex flex-col gap-1">
                <span className="font-mono text-caption uppercase text-text-muted font-bold">Identity (not editable here)</span>
                <span className="text-body-sm font-bold text-[#0B2A3D]">{name}</span>
                <span className="text-caption text-text-muted">{email} &middot; {slack}</span>
                <span className="text-caption text-text-muted">{roleName}</span>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="newHireName" className="font-mono text-caption uppercase text-text-primary font-bold">Full Name</label>
                  <input
                    id="newHireName"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter name..."
                    className="border border-border bg-white px-3 py-2 rounded-xl text-body-sm focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="newHireEmail" className="font-mono text-caption uppercase text-text-primary font-bold">Email (@meridian.com)</label>
                  <input
                    id="newHireEmail"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@meridian.com"
                    className="border border-border bg-white px-3 py-2 rounded-xl text-body-sm focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="newHireSlack" className="font-mono text-caption uppercase text-text-primary font-bold">Slack Handle (starts with @)</label>
                  <input
                    id="newHireSlack"
                    type="text"
                    required
                    value={slack}
                    onChange={(e) => setSlack(e.target.value)}
                    placeholder="@slack.handle"
                    className="border border-border bg-white px-3 py-2 rounded-xl text-body-sm focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="newHireRole" className="font-mono text-caption uppercase text-text-primary font-bold">Corporate Role</label>
                  <input
                    id="newHireRole"
                    type="text"
                    required
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    placeholder="E.g. Tech Specialist"
                    className="border border-border bg-white px-3 py-2 rounded-xl text-body-sm focus:outline-none focus:border-accent"
                  />
                </div>
              </>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="employeeDept" className="font-mono text-caption uppercase text-text-primary font-bold">Department</label>
              <select
                id="employeeDept"
                value={dept}
                onChange={(e) => setDept(e.target.value)}
                className="border border-border bg-white px-3 py-2 rounded-xl text-body-sm focus:outline-none focus:border-accent cursor-pointer"
              >
                {DEPARTMENTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="employeeBuddy" className="font-mono text-caption uppercase text-text-primary font-bold">Associate Buddy</label>
              <select
                id="employeeBuddy"
                value={buddyId}
                onChange={(e) => setBuddyId(e.target.value)}
                className="border border-border bg-white px-3 py-2 rounded-xl text-body-sm focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="">No Buddy Assigned</option>
                {buddiesList.filter(b => !employee || b.id !== employee.id).map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-caption uppercase text-text-primary font-bold">Hybrid Preference</label>
              <div className="flex gap-2">
                {(['OFFICE', 'REMOTE', 'HYBRID'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPref(p)}
                    className={`flex-1 py-2 border rounded-xl text-caption font-mono uppercase transition-colors ${
                      pref === p
                        ? 'bg-[#0B2A3D] text-white border-[#0B2A3D] font-bold'
                        : 'border-border bg-white text-text-primary hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="employeeDesk" className="font-mono text-caption uppercase text-text-primary font-bold">Assigned Desk</label>
              <input
                id="employeeDesk"
                type="text"
                value={assignedDesk}
                onChange={(e) => setAssignedDesk(e.target.value)}
                placeholder="E.g. D-42"
                className="border border-border bg-white px-3 py-2 rounded-xl text-body-sm focus:outline-none focus:border-accent"
              />
            </div>

            {!isEdit && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="newHireDate" className="font-mono text-caption uppercase text-text-primary font-bold">Hire Date</label>
                <input
                  id="newHireDate"
                  type="date"
                  value={hireDate}
                  onChange={(e) => setHireDate(e.target.value)}
                  className="border border-border bg-white px-3 py-2 rounded-xl text-body-sm focus:outline-none focus:border-accent"
                />
              </div>
            )}

            <div className="flex gap-3 mt-4 pt-4 border-t border-border">
              <button
                type="submit"
                className="flex-grow flex items-center justify-center gap-2 bg-[#0B2A3D] hover:bg-[#13313F] text-white px-4 py-2.5 rounded-full font-sans font-medium text-body-sm transition-colors shadow-sm select-none"
              >
                <span>{isEdit ? 'Save Changes' : 'Register Hire'}</span>
                <span className="flex items-center justify-center w-5 h-5 bg-white rounded-full text-[#0B2A3D]">
                  <span className="material-symbols-outlined text-[12px] font-bold">check</span>
                </span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-grow py-2.5 border border-border rounded-full font-sans font-medium text-body-sm text-[#0B2A3D] hover:bg-slate-50 transition-colors select-none"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        <div className="border-t border-border md:border-t-0 md:border-l pt-6 md:pt-0 md:pl-6 flex flex-col gap-4 flex-1 items-center justify-start min-w-[280px]">
          <div className="w-full flex justify-between items-center border-b border-border pb-2">
            <h3 className="text-h2 font-bold text-[#0B2A3D]">Live Badge Preview</h3>
            <button
              onClick={onClose}
              className="material-symbols-outlined text-[#0B2A3D] cursor-pointer hidden md:block hover:text-red-500 transition-colors"
            >
              close
            </button>
          </div>

          <div className="border border-border bg-white rounded-2xl w-[260px] h-[400px] flex flex-col justify-between p-6 relative select-none mt-4 shadow-xl overflow-hidden">
            <div className="w-12 h-3 bg-[#0B2A3D] absolute top-4 left-1/2 -translate-x-1/2 rounded-full"></div>

            <div className="mt-8 flex justify-between items-center">
              <div className="flex items-center gap-1">
                <div className="w-3.5 h-3.5 bg-gradient-to-br from-[#2BC4D9] to-[#F2994A] rotate-45 transform rounded-sm" />
                <span className="font-sans font-bold text-xs tracking-tight text-[#0B2A3D]">
                  Meridian
                </span>
              </div>
              <span className="font-mono text-[9px] border border-[#0B2A3D]/40 text-[#0B2A3D] px-1 rounded">SECURITY</span>
            </div>

            <div className="w-24 h-24 rounded-full border border-border mx-auto my-4 flex items-center justify-center bg-slate-50 shadow-inner">
              <span className="material-symbols-outlined text-[48px] text-text-muted">person</span>
            </div>

            <div className="text-center flex flex-col gap-1 border-t border-border pt-4">
              <h4 className="font-bold text-body truncate text-[#0B2A3D] uppercase">{name || 'NEW HIRE NAME'}</h4>
              <p className="text-caption text-text-muted uppercase font-mono tracking-tight font-bold">{roleName || 'ROLE ASSIGNMENT'}</p>
            </div>

            <div className="flex justify-between items-end mt-2">
              <div className="font-mono text-[9px] flex flex-col gap-0.5 text-left text-text-muted font-bold">
                <span>DEPT: {dept.toUpperCase()}</span>
                <span>HIRE: {hireDate}</span>
                <span>ID: Q-MOCK-ACC</span>
              </div>
              <div className="w-12 h-12 border border-border p-1 bg-white rounded-md flex flex-wrap gap-0.5 justify-center items-center">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-sm ${
                      (i % 3 === 0 && i % 2 === 0) || i === 0 || i === 15 ? 'bg-[#0B2A3D]' : 'bg-transparent'
                    }`}
                  ></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
