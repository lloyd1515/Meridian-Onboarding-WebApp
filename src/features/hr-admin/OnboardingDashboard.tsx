import React, { useEffect, useState } from 'react';
import { useDb } from '../../context/DbContext';
import { useAuth } from '../../context/AuthContext';
import { getChecklists, isNewHire, taskMilestoneBucket, isTaskOverdue, Task, Employee } from '../../services/db';

const getStatusBadge = (status: Task['status']) => {
  switch (status) {
    case 'completed':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono uppercase bg-success/10 text-success border border-success/20">
          Completed
        </span>
      );
    case 'in_progress':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono uppercase bg-sky-50 text-[#0E8A9A] border border-[#0E8A9A]/20">
          In Progress
        </span>
      );
    case 'skipped':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono uppercase bg-amber-50 text-warning border border-warning/20">
          Skipped
        </span>
      );
    case 'blocked':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono uppercase bg-red-50 text-danger border border-danger/20">
          Blocked
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono uppercase bg-slate-100 text-text-muted border border-border">
          Pending
        </span>
      );
  }
};

// Renders one milestone (30/60/90-day) column of an employee's detailed
// checklist breakdown -- previously triplicated near-identically per interval.
const MilestoneColumn: React.FC<{ days: 30 | 60 | 90; tasks: Task[]; pct: number }> = ({ days, tasks, pct }) => (
  <div className="flex flex-col gap-3">
    <div className="flex justify-between items-center bg-[#0B2A3D]/5 px-3 py-2 rounded-xl border border-[#0B2A3D]/10">
      <span className="font-mono text-caption font-bold text-[#0B2A3D]">{days}-Day Milestones</span>
      <span className="text-[10px] font-mono font-bold text-text-muted bg-white px-2 py-0.5 rounded-full border border-border">
        {pct.toFixed(0)}%
      </span>
    </div>
    <div className="flex flex-col gap-2.5">
      {tasks.length > 0 ? (
        tasks.map(task => (
          <div key={task.id} className="bg-white border border-border p-3.5 rounded-xl flex flex-col gap-2 shadow-sm">
            <div className="flex justify-between items-start gap-2">
              <span className="text-body-sm font-bold text-[#0B2A3D]">{task.title}</span>
              {getStatusBadge(task.status)}
            </div>
            <p className="text-caption text-text-muted leading-relaxed">
              {task.description}
            </p>
            {task.status === 'skipped' && task.skipReason && (
              <div className="bg-amber-50/50 border border-warning/10 p-2.5 rounded-lg text-[11px] text-warning leading-relaxed font-mono">
                <strong>Reason:</strong> {task.skipReason}
              </div>
            )}
          </div>
        ))
      ) : (
        <span className="text-caption text-text-muted italic py-2 text-center">No {days}-day tasks.</span>
      )}
    </div>
  </div>
);

export const OnboardingDashboard: React.FC = () => {
  const { employees } = useDb();
  const { simulationDate } = useAuth();
  const [checklists, setChecklists] = useState<Record<string, Task[]>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [onlyNewHires, setOnlyNewHires] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    const fetchChecklists = async () => {
      try {
        const data = await getChecklists();
        setChecklists(data);
      } catch (err) {
        console.error('Failed to load checklists:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchChecklists();
  }, []);

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          emp.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDept === 'ALL' || emp.department === selectedDept;
    const matchesNewHire = !onlyNewHires || isNewHire(emp, simulationDate);
    return matchesSearch && matchesDept && matchesNewHire;
  });

  let totalEmployees = filteredEmployees.length;
  let totalCompleted = 0;
  let totalSkipped = 0;
  let totalPending = 0;
  let totalBlocked = 0;
  let totalCompletionRatesSum = 0;

  interface SkippedTaskFeedItem {
    employeeName: string;
    taskTitle: string;
    skipReason: string;
  }

  const skipJustificationFeed: SkippedTaskFeedItem[] = [];

  const employeeStats = filteredEmployees.map(emp => {
    const checklist = checklists[emp.id] || [];
    const total = checklist.length;
    const completed = checklist.filter(t => t.status === 'completed').length;
    const skipped = checklist.filter(t => t.status === 'skipped').length;
    const pending = checklist.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
    const blocked = checklist.filter(t => t.status === 'blocked').length;

    totalCompleted += completed;
    totalSkipped += skipped;
    totalPending += pending;
    totalBlocked += blocked;

    const completionRate = total > 0 ? (completed / total) * 100 : 0;
    totalCompletionRatesSum += completionRate;

    checklist.forEach(task => {
      if (task.status === 'skipped') {
        skipJustificationFeed.push({
          employeeName: emp.name,
          taskTitle: task.title,
          skipReason: task.skipReason || 'No justification provided.',
        });
      }
    });

    const tasks30 = checklist.filter(t => taskMilestoneBucket(t) === 30);
    const tasks60 = checklist.filter(t => taskMilestoneBucket(t) === 60);
    const tasks90 = checklist.filter(t => taskMilestoneBucket(t) === 90);

    const pct30 = tasks30.length > 0 ? (tasks30.filter(t => t.status === 'completed').length / tasks30.length) * 100 : 0;
    const pct60 = tasks60.length > 0 ? (tasks60.filter(t => t.status === 'completed').length / tasks60.length) * 100 : 0;
    const pct90 = tasks90.length > 0 ? (tasks90.filter(t => t.status === 'completed').length / tasks90.length) * 100 : 0;

    const overdueCount = checklist.filter(t => isTaskOverdue(t, simulationDate)).length;

    return {
      emp,
      total,
      completed,
      skipped,
      pending,
      blocked,
      completionRate,
      tasks30,
      tasks60,
      tasks90,
      pct30,
      pct60,
      pct90,
      overdueCount,
    };
  });

  const avgCompletionRate = totalEmployees > 0 ? totalCompletionRatesSum / totalEmployees : 0;

  const toggleExpand = (empId: string) => {
    setExpandedEmployeeId(expandedEmployeeId === empId ? null : empId);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-text-muted">
        <span className="material-symbols-outlined animate-spin text-[32px]">progress_activity</span>
        <p className="font-mono text-caption uppercase tracking-wider font-bold">Loading onboarding checklists...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div className="border border-border bg-surface p-6 rounded-2xl shadow-sm">
        <h2 className="text-h1 font-bold text-[#0B2A3D] mb-1">HR Onboarding Dashboard</h2>
        <p className="text-body-sm text-text-muted">
          Track employee onboarding progress, view task completion rates across 30, 60, and 90-day intervals, and audit task skips.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="border border-border bg-surface p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <span className="font-mono text-caption uppercase text-text-muted font-bold tracking-wider">Total Tracked</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-h1 font-extrabold text-[#0B2A3D]">{totalEmployees}</span>
            <span className="text-caption text-text-muted">employees</span>
          </div>
          <p className="text-[11px] text-text-muted mt-2 border-t border-border/50 pt-2 font-mono">
            {onlyNewHires ? 'New hires only' : 'All directory members'}
          </p>
        </div>

        <div className="border border-border bg-surface p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <span className="font-mono text-caption uppercase text-text-muted font-bold tracking-wider">Avg Completion Rate</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-h1 font-extrabold text-[#0B2A3D]">{avgCompletionRate.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-accent h-1.5 rounded-full" style={{ width: `${avgCompletionRate}%` }}></div>
          </div>
        </div>

        <div className="border border-border bg-surface p-5 rounded-2xl shadow-sm lg:col-span-2 flex flex-col justify-between">
          <span className="font-mono text-caption uppercase text-text-muted font-bold tracking-wider">Global Task Breakdown</span>
          <div className="grid grid-cols-4 gap-2 mt-3 select-none text-center">
            <div className="bg-success/5 border border-success/15 p-2 rounded-xl">
              <span className="block text-body-lg font-bold text-success">{totalCompleted}</span>
              <span className="font-mono text-[9px] text-text-muted uppercase font-bold">Done</span>
            </div>
            <div className="bg-[#0E8A9A]/5 border border-[#0E8A9A]/15 p-2 rounded-xl">
              <span className="block text-body-lg font-bold text-[#0E8A9A]">{totalPending}</span>
              <span className="font-mono text-[9px] text-text-muted uppercase font-bold">Pending</span>
            </div>
            <div className="bg-amber-50 border border-warning/15 p-2 rounded-xl">
              <span className="block text-body-lg font-bold text-warning">{totalSkipped}</span>
              <span className="font-mono text-[9px] text-text-muted uppercase font-bold">Skipped</span>
            </div>
            <div className="bg-red-50 border border-danger/15 p-2 rounded-xl">
              <span className="block text-body-lg font-bold text-danger">{totalBlocked}</span>
              <span className="font-mono text-[9px] text-text-muted uppercase font-bold">Blocked</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border border-border bg-surface p-4 rounded-2xl shadow-sm items-center">
            <div className="flex flex-col gap-1 md:col-span-1">
              <label className="font-mono text-caption uppercase text-text-primary font-bold">Search Employees</label>
              <input
                type="text"
                placeholder="Search by name or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border border-border bg-white px-3 py-1.5 rounded-xl text-body-sm focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-mono text-caption uppercase text-text-primary font-bold">Department</label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="border border-border bg-white px-3 py-1.5 rounded-xl text-body-sm focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="ALL">All Departments</option>
                {['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1 justify-center md:items-end">
              <label className="font-mono text-caption uppercase text-text-primary font-bold md:pr-1">Filter Type</label>
              <label className="inline-flex items-center gap-2 cursor-pointer mt-1 md:pr-1 select-none">
                <input
                  type="checkbox"
                  checked={onlyNewHires}
                  onChange={(e) => setOnlyNewHires(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="relative w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0E8A9A]"></div>
                <span className="text-body-sm font-semibold text-text-primary">Only Show New Hires</span>
              </label>
            </div>
          </div>

          <div className="border border-border bg-surface rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 bg-[#E9F1F3] border-b border-border p-4 font-mono text-caption text-text-muted uppercase select-none font-bold">
              <span className="col-span-5 md:col-span-4">Name / Role</span>
              <span className="col-span-3 md:col-span-3">Department</span>
              <span className="col-span-4 md:col-span-4 text-center">Progress Overview</span>
              <span className="hidden md:inline col-span-1 text-center">Detail</span>
            </div>

            <div className="flex flex-col divide-y divide-border bg-white">
              {employeeStats.length > 0 ? (
                employeeStats.map(({ emp, completionRate, tasks30, tasks60, tasks90, pct30, pct60, pct90, overdueCount }) => {
                  const isExpanded = expandedEmployeeId === emp.id;
                  const isNew = isNewHire(emp, simulationDate);

                  return (
                    <div key={emp.id} className="flex flex-col">
                      <div
                        onClick={() => toggleExpand(emp.id)}
                        className={`grid grid-cols-12 items-center p-4 hover:bg-slate-50 transition-colors cursor-pointer ${
                          isExpanded ? 'bg-slate-50/50' : ''
                        }`}
                      >
                        <div className="col-span-5 md:col-span-4 flex flex-col justify-center truncate pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-body-sm font-bold text-[#0B2A3D] truncate">{emp.name}</span>
                            {isNew && (
                              <span className="text-[8px] font-mono border border-accent text-accent px-1 font-bold bg-white rounded uppercase tracking-wider shrink-0">
                                New Hire
                              </span>
                            )}
                            {overdueCount > 0 && (
                              <span className="text-[8px] font-mono border border-danger text-danger px-1 font-bold bg-white rounded uppercase tracking-wider shrink-0">
                                {overdueCount} Overdue
                              </span>
                            )}
                          </div>
                          <span className="text-caption text-text-muted truncate mt-0.5">{emp.role}</span>
                        </div>

                        <span className="col-span-3 md:col-span-3 text-body-sm text-text-primary font-medium truncate">
                          {emp.department}
                        </span>

                        <div className="col-span-4 md:col-span-4 flex flex-col justify-center gap-1 px-1">
                          <div className="flex justify-between items-center text-[11px] font-mono font-bold text-text-primary">
                            <span>Overall Rate:</span>
                            <span>{completionRate.toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-accent h-2 rounded-full" style={{ width: `${completionRate}%` }}></div>
                          </div>
                          {/* Mini intervals progress preview */}
                          <div className="flex justify-between text-[9px] font-mono text-text-muted mt-1 select-none font-semibold">
                            <span>30d: {pct30.toFixed(0)}%</span>
                            <span>60d: {pct60.toFixed(0)}%</span>
                            <span>90d: {pct90.toFixed(0)}%</span>
                          </div>
                        </div>

                        <div className="hidden md:flex col-span-1 justify-center items-center">
                          <span className="material-symbols-outlined text-text-muted transition-transform duration-200">
                            {isExpanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                          </span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="bg-slate-50 border-t border-b border-border/70 p-6 flex flex-col gap-6">
                          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-border pb-3">
                            <h4 className="text-body font-bold text-[#0B2A3D]">
                              Detailed Checklist for {emp.name}
                            </h4>
                            <span className="font-mono text-caption text-text-muted uppercase">
                              Hire Date: {emp.hireDate}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <MilestoneColumn days={30} tasks={tasks30} pct={pct30} />
                            <MilestoneColumn days={60} tasks={tasks60} pct={pct60} />
                            <MilestoneColumn days={90} tasks={tasks90} pct={pct90} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-text-muted font-mono text-caption uppercase select-none">
                  No matching employee records found.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="xl:col-span-1 flex flex-col gap-4">
          <div className="border border-border bg-surface p-5 rounded-2xl shadow-sm flex flex-col gap-4 min-h-[400px]">
            <div className="border-b border-border pb-3 select-none">
              <h3 className="font-bold text-[#0B2A3D] text-body uppercase tracking-wider">Skip Justifications</h3>
              <span className="font-mono text-[10px] text-text-muted mt-1 block font-bold">
                {skipJustificationFeed.length} AUDIT RECORDS FOR FILTERED LIST
              </span>
            </div>

            <div className="flex-grow flex flex-col gap-3 overflow-y-auto max-h-[560px] pr-1">
              {skipJustificationFeed.length > 0 ? (
                skipJustificationFeed.map((feedItem, index) => (
                  <div
                    key={index}
                    className="border border-border p-3.5 bg-[#FAF9F6] rounded-xl flex flex-col gap-2 shadow-inner transition-colors hover:border-[#F2994A]"
                  >
                    <div className="flex justify-between items-start gap-1">
                      <span className="font-bold text-body-sm text-[#0B2A3D] truncate">
                        {feedItem.employeeName}
                      </span>
                      <span className="text-[8px] font-mono border border-warning/30 bg-amber-50 text-warning px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 select-none">
                        Skipped
                      </span>
                    </div>

                    <div className="flex flex-col gap-1 border-t border-border/40 pt-2">
                      <span className="text-[11px] font-mono text-text-muted font-bold">
                        Task: {feedItem.taskTitle}
                      </span>
                      <p className="text-caption text-[#C65D00] bg-amber-50/20 border border-warning/10 p-2 rounded mt-1 font-mono italic leading-relaxed">
                        &ldquo;{feedItem.skipReason}&rdquo;
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex-grow border border-dashed border-border rounded-xl flex items-center justify-center p-6 select-none bg-slate-50/30">
                  <span className="text-caption text-text-muted font-mono text-center font-bold tracking-wider leading-relaxed">
                    NO SKIPPED TASKS IN THIS BATCH
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
