import React, { useRef, useState } from 'react';
import { useDb } from '../../context/DbContext';
import { useAuth } from '../../context/AuthContext';
import { Employee } from '../../services/db';
import { useVirtualizer } from '@tanstack/react-virtual';
import { RelationshipExplorer } from '../onboarding/RelationshipExplorer';
import { OnboardingDashboard } from './OnboardingDashboard';
import { EmployeeSlideOver, EmployeeSlideOverSubmitData } from './EmployeeSlideOver';

interface EmployeeDirectoryProps {
  readOnly?: boolean;
}

export const EmployeeDirectory: React.FC<EmployeeDirectoryProps> = ({ readOnly = false }) => {
  const { employees, addEmployee, updateEmployee } = useDb();
  const { currentUser } = useAuth();

  const [isOpenForm, setIsOpenForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [activeTab, setActiveTab] = useState<'list' | 'chart' | 'progress'>('list');

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          emp.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDept === 'ALL' || emp.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  const parentRef = useRef<HTMLDivElement>(null);
  
  const rowVirtualizer = useVirtualizer({
    count: filteredEmployees.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });

  // Returns the newly-created employee's one-time temporary password so the
  // slide-over can display it; the drawer itself decides when to close (it
  // stays open to show that password rather than closing immediately).
  const handleCreateSubmit = async (data: EmployeeSlideOverSubmitData): Promise<string | void> => {
    const newEmp: Employee = {
      id: crypto.randomUUID(),
      name: data.name,
      email: data.email,
      slackHandle: data.slack,
      role: data.roleName,
      department: data.department,
      hireDate: data.hireDate,
      buddyId: data.buddyId || null,
      hybridPreference: data.hybridPreference,
      assignedDesk: data.assignedDesk || null,
    };
    return addEmployee(newEmp);
  };

  const handleEditSubmit = async (data: EmployeeSlideOverSubmitData): Promise<void> => {
    if (!editingEmployee) return;
    await updateEmployee(editingEmployee.id, {
      department: data.department,
      buddyId: data.buddyId || null,
      hybridPreference: data.hybridPreference,
      assignedDesk: data.assignedDesk || null,
    });
    setEditingEmployee(null);
  };

  // Any existing employee can be assigned as a buddy — there is no dedicated
  // "buddy" role, it's just whichever colleague is paired with the new hire.
  const buddiesList = employees;

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div className="border border-border bg-surface p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
        <div>
          <h2 className="text-h1 font-bold text-[#0B2A3D] mb-1">Employee Directory</h2>
          <p className="text-body-sm text-text-muted">
            {readOnly ? 'Search and coordinate with organization members.' : 'Virtual list of organization members.'} ({filteredEmployees.length} records).
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={() => setIsOpenForm(true)}
            className="flex items-center justify-between gap-3 bg-[#0B2A3D] hover:bg-[#13313F] text-white px-5 py-2.5 rounded-full font-sans font-medium text-body-sm transition-colors shadow-sm select-none"
          >
            <span>Add New Hire</span>
            <span className="flex items-center justify-center w-5 h-5 bg-white rounded-full text-[#0B2A3D]">
              <span className="material-symbols-outlined text-[14px] font-bold">add</span>
            </span>
          </button>
        )}
      </div>

      <div className="flex border-b border-border bg-transparent gap-4">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-3 font-sans text-body-sm font-semibold transition-all border-b-2 -mb-[2px] ${
            activeTab === 'list'
              ? 'border-accent text-[#0B2A3D] font-bold'
              : 'border-transparent text-text-muted hover:text-[#0B2A3D]'
          }`}
        >
          Directory List
        </button>
        <button
          onClick={() => setActiveTab('chart')}
          className={`px-4 py-3 font-sans text-body-sm font-semibold transition-all border-b-2 -mb-[2px] ${
            activeTab === 'chart'
              ? 'border-accent text-[#0B2A3D] font-bold'
              : 'border-transparent text-text-muted hover:text-[#0B2A3D]'
          }`}
        >
          Organizational Chart
        </button>
        {!readOnly && (
          <button
            onClick={() => setActiveTab('progress')}
            className={`px-4 py-3 font-sans text-body-sm font-semibold transition-all border-b-2 -mb-[2px] ${
              activeTab === 'progress'
                ? 'border-accent text-[#0B2A3D] font-bold'
                : 'border-transparent text-text-muted hover:text-[#0B2A3D]'
            }`}
          >
            Onboarding Progress
          </button>
        )}
      </div>

      {activeTab === 'list' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border border-border bg-surface p-4 rounded-2xl shadow-sm">
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="font-mono text-caption uppercase text-text-primary font-bold">Search Employee / Role</label>
              <input
                type="text"
                placeholder="Search by name or role title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border border-border bg-white px-3 py-2 rounded-xl text-body-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="departmentFilter" className="font-mono text-caption uppercase text-text-primary font-bold">Department Filter</label>
              <select
                id="departmentFilter"
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="border border-border bg-white px-3 py-2 rounded-xl text-body-sm focus:outline-none focus:border-accent h-[38px] cursor-pointer"
              >
                <option value="ALL">All Departments</option>
                {['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="border border-border bg-surface flex flex-col rounded-2xl overflow-hidden shadow-sm">
            <div className={`grid ${readOnly ? 'grid-cols-4' : 'grid-cols-5'} bg-[#E9F1F3] border-b border-border p-4 font-mono text-caption text-text-muted uppercase select-none font-bold`}>
              <span>Name / Role</span>
              <span>Department</span>
              <span>Preference</span>
              <span>Buddy ID / Slack</span>
              {!readOnly && <span>Actions</span>}
            </div>

            <div
              ref={parentRef}
              className="overflow-y-auto max-h-[500px] w-full relative bg-white"
              style={{ contain: 'layout style paint' }}
            >
              {filteredEmployees.length > 0 ? (
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const emp = filteredEmployees[virtualRow.index];
                    return (
                      <div
                        key={emp.id}
                        className={`grid ${readOnly ? 'grid-cols-4' : 'grid-cols-5'} items-center px-4 border-b border-border hover:bg-slate-50 transition-colors absolute left-0 top-0 w-full`}
                        style={{
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <div className="flex flex-col truncate">
                          <span className="text-body-sm font-bold text-[#0B2A3D] truncate">{emp.name}</span>
                          <span className="text-caption text-text-muted truncate">{emp.role}</span>
                        </div>
                        <span className="text-body-sm text-text-primary truncate">{emp.department}</span>
                        <span className="text-caption font-mono border border-border px-2 py-0.5 rounded bg-slate-50 w-fit text-[11px] font-bold">
                          {emp.hybridPreference}
                        </span>
                        <div className="flex flex-col font-mono text-caption text-text-muted truncate">
                          <span>Buddy: {emp.buddyId || 'None'}</span>
                          <span className="text-[10px] text-[#0B2A3D] font-bold">{emp.slackHandle}</span>
                          <span className="text-[10px]">Desk: {emp.assignedDesk || 'Unassigned'}</span>
                        </div>
                        {!readOnly && (
                          <div>
                            <button
                              onClick={() => setEditingEmployee(emp)}
                              aria-label={`Edit ${emp.name}`}
                              className="material-symbols-outlined text-[18px] text-text-muted hover:text-accent transition-colors cursor-pointer"
                            >
                              edit
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center text-text-muted font-mono text-caption uppercase select-none">
                  No matching employee records found.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'chart' && (
        <div className="flex flex-col gap-6">
          <RelationshipExplorer currentUser={currentUser} employees={employees} />

          <div className="border border-border bg-surface p-6 rounded-2xl shadow-sm">
            <div className="border-b border-border pb-3 mb-4">
              <h3 className="font-sans text-h3 font-bold text-text-primary">Company-Wide Org Chart</h3>
              <p className="text-body-sm text-text-muted mt-1">
                Every department at Meridian, grouped by head and full roster ({employees.length} employees total).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'].map(dept => {
                const members = employees.filter(emp => emp.department === dept);
                const head = members.find(
                  emp => emp.role.includes('VP') || emp.role.includes('Director') || emp.role.includes('Manager')
                ) || null;

                return (
                  <div key={dept} className="border border-border bg-surface-muted/30 rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-center border-b border-border pb-2">
                      <h4 className="font-sans font-bold text-body text-text-primary">{dept}</h4>
                      <span className="font-mono text-[10px] text-text-muted uppercase font-bold">{members.length} members</span>
                    </div>

                    {head && (
                      <div className="flex items-center gap-2 bg-accent/5 border border-accent/20 rounded-lg px-3 py-2">
                        <span className="text-[9px] font-mono text-accent uppercase font-bold shrink-0">Head</span>
                        <span className="text-body-sm font-bold text-text-primary truncate">{head.name}</span>
                        <span className="text-caption text-text-muted truncate">{head.role}</span>
                      </div>
                    )}

                    <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto pr-1">
                      {members.length > 0 ? (
                        members.map(emp => (
                          <div
                            key={emp.id}
                            className="flex justify-between items-center gap-2 text-caption font-mono py-1 border-b border-border/40 last:border-0"
                          >
                            <span className="text-text-primary truncate">{emp.name}</span>
                            <span className="text-text-muted truncate">{emp.role}</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-caption text-text-muted italic py-2 text-center">No members yet.</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!readOnly && activeTab === 'progress' && (
        <OnboardingDashboard />
      )}

      {!readOnly && isOpenForm && (
        <EmployeeSlideOver
          mode="create"
          buddiesList={buddiesList}
          onClose={() => setIsOpenForm(false)}
          onSubmit={handleCreateSubmit}
        />
      )}

      {!readOnly && editingEmployee && (
        <EmployeeSlideOver
          mode="edit"
          employee={editingEmployee}
          buddiesList={buddiesList}
          onClose={() => setEditingEmployee(null)}
          onSubmit={handleEditSubmit}
        />
      )}
    </div>
  );
};
