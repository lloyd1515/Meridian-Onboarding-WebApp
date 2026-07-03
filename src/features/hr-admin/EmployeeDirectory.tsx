import React, { useRef, useState } from 'react';
import { useDb } from '../../context/DbContext';
import { useAuth } from '../../context/AuthContext';
import { Employee } from '../../services/db';
import { useVirtualizer } from '@tanstack/react-virtual';
import { RelationshipExplorer } from '../onboarding/RelationshipExplorer';
import { OnboardingDashboard } from './OnboardingDashboard';

interface EmployeeDirectoryProps {
  readOnly?: boolean;
}

export const EmployeeDirectory: React.FC<EmployeeDirectoryProps> = ({ readOnly = false }) => {
  const { employees, addEmployee } = useDb();
  const { currentUser } = useAuth();
  
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [slack, setSlack] = useState('');
  const [roleName, setRoleName] = useState('');
  const [dept, setDept] = useState('Engineering');
  const [buddyId, setBuddyId] = useState('');
  const [pref, setPref] = useState<'BIROU' | 'REMOTE' | 'HIBRID'>('HIBRID');
  const [hireDate, setHireDate] = useState('2026-07-01');
  const [formError, setFormError] = useState('');

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

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!email.endsWith('@meridian.com')) {
      setFormError('Email must end with @meridian.com');
      return;
    }
    if (!slack.startsWith('@')) {
      setFormError('Slack handle must start with @');
      return;
    }

    const newEmp: Employee = {
      id: crypto.randomUUID(),
      name,
      email,
      slackHandle: slack,
      role: roleName,
      department: dept,
      hireDate,
      buddyId: buddyId || null,
      hybridPreference: pref,
    };

    try {
      await addEmployee(newEmp);
      setName('');
      setEmail('');
      setSlack('');
      setRoleName('');
      setBuddyId('');
      setIsOpenForm(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to register employee');
    }
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
              <label className="font-mono text-caption uppercase text-text-primary font-bold">Department Filter</label>
              <select
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
            <div className="grid grid-cols-4 bg-[#E9F1F3] border-b border-border p-4 font-mono text-caption text-text-muted uppercase select-none font-bold">
              <span>Name / Role</span>
              <span>Department</span>
              <span>Preference</span>
              <span>Buddy ID / Slack</span>
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
                        className="grid grid-cols-4 items-center px-4 border-b border-border hover:bg-slate-50 transition-colors absolute left-0 top-0 w-full"
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
                          <span className="text-[10px] text-accent font-bold">{emp.slackHandle}</span>
                        </div>
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
        <RelationshipExplorer currentUser={currentUser} employees={employees} />
      )}

      {!readOnly && activeTab === 'progress' && (
        <OnboardingDashboard />
      )}

      {!readOnly && isOpenForm && (
        <div className="fixed inset-0 bg-[#000000]/40 z-50 flex justify-end">
          <div className="bg-white border-l border-border w-full max-w-[800px] h-full p-6 flex flex-col md:flex-row gap-6 overflow-y-auto rounded-l-2xl shadow-2xl">
            <div className="flex-grow flex flex-col gap-4 max-w-[420px]">
              <div className="flex justify-between items-center border-b border-border pb-2">
                <h3 className="text-h2 font-bold text-[#0B2A3D]">Add New Hire</h3>
                <button
                  onClick={() => setIsOpenForm(false)}
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

              <form onSubmit={handleAddEmployee} className="flex flex-col gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-caption uppercase text-text-primary font-bold">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter name..."
                    className="border border-border bg-white px-3 py-2 rounded-xl text-body-sm focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-caption uppercase text-text-primary font-bold">Email (@meridian.com)</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@meridian.com"
                    className="border border-border bg-white px-3 py-2 rounded-xl text-body-sm focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-caption uppercase text-text-primary font-bold">Slack Handle (starts with @)</label>
                  <input
                    type="text"
                    required
                    value={slack}
                    onChange={(e) => setSlack(e.target.value)}
                    placeholder="@slack.handle"
                    className="border border-border bg-white px-3 py-2 rounded-xl text-body-sm focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-caption uppercase text-text-primary font-bold">Corporate Role</label>
                  <input
                    type="text"
                    required
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    placeholder="E.g. Tech Specialist"
                    className="border border-border bg-white px-3 py-2 rounded-xl text-body-sm focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-caption uppercase text-text-primary font-bold">Department</label>
                  <select
                    value={dept}
                    onChange={(e) => setDept(e.target.value)}
                    className="border border-border bg-white px-3 py-2 rounded-xl text-body-sm focus:outline-none focus:border-accent cursor-pointer"
                  >
                    {['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-caption uppercase text-text-primary font-bold">Associate Buddy</label>
                  <select
                    value={buddyId}
                    onChange={(e) => setBuddyId(e.target.value)}
                    className="border border-border bg-white px-3 py-2 rounded-xl text-body-sm focus:outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="">No Buddy Assigned</option>
                    {buddiesList.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-caption uppercase text-text-primary font-bold">Hybrid Preference</label>
                  <div className="flex gap-2">
                    {['BIROU', 'REMOTE', 'HIBRID'].map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPref(p as any)}
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
                  <label className="font-mono text-caption uppercase text-text-primary font-bold">Hire Date</label>
                  <input
                    type="date"
                    value={hireDate}
                    onChange={(e) => setHireDate(e.target.value)}
                    className="border border-border bg-white px-3 py-2 rounded-xl text-body-sm focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex gap-3 mt-4 pt-4 border-t border-border">
                  <button
                    type="submit"
                    className="flex-grow flex items-center justify-center gap-2 bg-[#0B2A3D] hover:bg-[#13313F] text-white px-4 py-2.5 rounded-full font-sans font-medium text-body-sm transition-colors shadow-sm select-none"
                  >
                    <span>Register Hire</span>
                    <span className="flex items-center justify-center w-5 h-5 bg-white rounded-full text-[#0B2A3D]">
                      <span className="material-symbols-outlined text-[12px] font-bold">check</span>
                    </span>
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
            </div>

            <div className="border-t border-border md:border-t-0 md:border-l pt-6 md:pt-0 md:pl-6 flex flex-col gap-4 flex-1 items-center justify-start min-w-[280px]">
              <div className="w-full flex justify-between items-center border-b border-border pb-2">
                <h3 className="text-h2 font-bold text-[#0B2A3D]">Live Badge Preview</h3>
                <button
                  onClick={() => setIsOpenForm(false)}
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
      )}
    </div>
  );
};
