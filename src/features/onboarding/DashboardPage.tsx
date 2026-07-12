import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDb } from '../../context/DbContext';
import { getEmployeeChecklist, taskMilestoneBucket, Task, Employee, downloadAgendaIcs } from '../../services/db';
import { OFFICE_CAPACITY, OFFICE_CAPACITY_WARNING } from '../../constants/scheduling';
import { getOfficeDayLimitError, getOfficeCapacityError } from '../../utils/officeCapacity';
import { useNavigate } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { currentUser, isPreboarding, simulationDate } = useAuth();
  const { employees, scheduler, updateScheduler } = useDb();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [buddy, setBuddy] = useState<Employee | null>(null);
  const navigate = useNavigate();

  const [isSyncing, setIsSyncing] = useState(false);
  const [slackSynced, setSlackSynced] = useState(false);
  const [meetLink, setMeetLink] = useState<string | null>(null);
  const [activeDayIdx, setActiveDayIdx] = useState<number>(0);
  const [isDownloadingAgenda, setIsDownloadingAgenda] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionWarning, setActionWarning] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      getEmployeeChecklist(currentUser.id).then(setTasks);
      
      if (currentUser.buddyId) {
        const foundBuddy = employees.find(emp => emp.id === currentUser.buddyId);
        if (foundBuddy) {
          setBuddy(foundBuddy);
        }
      }
    }
  }, [currentUser, employees]);

  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
  
  const nextTask = tasks.find(t => t.status === 'in_progress' || t.status === 'pending');

  const daysSinceHire = currentUser
    ? Math.floor((new Date(simulationDate).getTime() - new Date(currentUser.hireDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const currentMilestone: 30 | 60 | 90 = daysSinceHire <= 30 ? 30 : daysSinceHire <= 60 ? 60 : 90;
  const openTasksInMilestone = (milestone: 30 | 60 | 90) =>
    tasks.filter(t => taskMilestoneBucket(t) === milestone && (t.status === 'pending' || t.status === 'in_progress' || t.status === 'blocked')).length;
  const currentMilestoneOpenCount = openTasksInMilestone(currentMilestone);
  const overdueMilestones = ([30, 60] as const).filter(m => m < currentMilestone && openTasksInMilestone(m) > 0);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  const handleToggleDay = async (dayIdx: string) => {
    if (isPreboarding || !currentUser) return;

    setActionError(null);
    setActionWarning(null);

    const currentList = scheduler[dayIdx] || [];
    const isUserScheduled = currentList.includes(currentUser.id);
    let newList: string[];

    if (isUserScheduled) {
      // Toggle off
      newList = currentList.filter(id => id !== currentUser.id);
    } else {
      // Cap at 3 office days
      let scheduledDaysCount = 0;
      ['0', '1', '2', '3', '4'].forEach(key => {
        if (scheduler[key]?.includes(currentUser.id)) {
          scheduledDaysCount++;
        }
      });

      const dayLimitError = getOfficeDayLimitError(scheduledDaysCount);
      if (dayLimitError) {
        setActionError(dayLimitError);
        return;
      }

      // Toggle on: Check occupancy rules against the real scheduled count
      // for this day (same value HybridScheduler.tsx shows) -- adding this
      // employee makes it currentList.length + 1.
      const totalOccupancy = currentList.length + 1;

      // Reject only when the total after adding would exceed the cap
      // (day 130 itself is fillable — same rule as HybridScheduler/backend).
      const capacityError = getOfficeCapacityError(totalOccupancy);
      if (capacityError) {
        setActionError(capacityError);
        return;
      }

      if (totalOccupancy >= OFFICE_CAPACITY_WARNING) {
        setActionWarning('⚠️ ALERT: Capacity threshold reached. No more employees can be scheduled on this day.');
      }

      newList = [...currentList, currentUser.id];
    }

    const updatedScheduler = {
      ...scheduler,
      [dayIdx]: newList
    };

    await updateScheduler(updatedScheduler);
  };

  const handleDownloadAgenda = async () => {
    if (isDownloadingAgenda) return;
    setIsDownloadingAgenda(true);
    setActionError(null);
    try {
      await downloadAgendaIcs();
    } catch (e) {
      console.error('Error downloading agenda calendar file:', e);
      setActionError('Could not download the calendar file. Please try again.');
    } finally {
      setIsDownloadingAgenda(false);
    }
  };

  const handleSlackSync = () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setSlackSynced(prev => !prev);
    }, 1000);
  };

  const handleGenerateMeetLink = () => {
    if (meetLink) {
      setMeetLink(null);
    } else {
      const randomId = Math.random().toString(36).substring(2, 5) + '-' + 
                       Math.random().toString(36).substring(2, 6) + '-' + 
                       Math.random().toString(36).substring(2, 5);
      setMeetLink(`meet.google.com/${randomId}`);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="border border-border bg-surface p-6 rounded-3xl shadow-sm">
        <h2 className="text-h1 font-bold text-text-primary mb-1">
          Welcome to Meridian, {currentUser?.name}!
        </h2>
        <p className="text-body-lg text-text-muted">
          Here is a summary of your onboarding path and coordination details.
        </p>
        {currentUser && (
          <p className="font-mono text-caption uppercase text-text-muted mt-2">
            Your desk: <span className="text-text-primary font-bold">{currentUser.assignedDesk || 'Not yet assigned'}</span>
          </p>
        )}
      </div>

      {actionError && (
        <div className="bg-red-50 border border-danger text-danger text-body-sm p-3 rounded-xl font-mono">
          {actionError}
        </div>
      )}

      {actionWarning && (
        <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl font-mono text-body-sm shadow-sm">
          {actionWarning}
        </div>
      )}

      {!isPreboarding && tasks.length > 0 && (
        <div className="border border-border bg-surface p-5 rounded-2xl shadow-sm flex items-start sm:items-center gap-4 flex-col sm:flex-row">
          <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-accent/10 border border-accent/20 shrink-0">
            <span className="material-symbols-outlined text-accent text-[22px]">notifications_active</span>
          </div>
          <div className="flex-grow">
            <h3 className="font-mono text-caption uppercase text-text-muted">Day {Math.max(daysSinceHire, 0)} of onboarding</h3>
            <p className="text-body font-semibold text-text-primary mt-0.5">
              {currentMilestoneOpenCount > 0
                ? `${currentMilestoneOpenCount} task${currentMilestoneOpenCount === 1 ? '' : 's'} from your ${currentMilestone}-day plan ${currentMilestoneOpenCount === 1 ? 'is' : 'are'} still open.`
                : `You're on track — nothing outstanding from your ${currentMilestone}-day plan.`}
            </p>
            {overdueMilestones.length > 0 && (
              <p className="text-caption text-danger font-mono mt-1">
                Also catching up: {overdueMilestones.map(m => `${openTasksInMilestone(m)} task${openTasksInMilestone(m) === 1 ? '' : 's'} from your ${m}-day plan`).join(' and ')}.
              </p>
            )}
          </div>
          <button
            onClick={() => navigate('/checklist')}
            className="shrink-0 inline-flex items-center justify-between gap-3 px-5 py-2 bg-[#0B2A3D] hover:bg-[#102C3E] text-white rounded-full transition-all text-body-sm font-semibold shadow-sm"
          >
            <span>Review checklist</span>
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white text-[#0B2A3D]">
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="border border-border bg-surface p-6 rounded-2xl flex flex-col justify-between min-h-[160px] shadow-sm">
          <div>
            <h3 className="font-mono text-caption text-text-muted uppercase">Your Onboarding Progress</h3>
            <span className="text-display font-bold leading-none mt-2 block">{progressPercent}%</span>
          </div>
          <div className="w-full bg-surface-muted h-3 border border-border mt-4 rounded-full overflow-hidden">
            <div className="bg-text-primary h-full transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>

        <div className="border border-border bg-surface p-6 rounded-2xl flex flex-col justify-between min-h-[160px] shadow-sm">
          <div>
            <h3 className="font-mono text-caption text-text-muted uppercase">Your Current Phase</h3>
            <span className={`text-h2 font-bold leading-none mt-4 block uppercase ${isPreboarding ? 'text-danger' : 'text-emerald-700'}`}>
              {isPreboarding ? 'Pre-boarding' : 'Active Phase'}
            </span>
          </div>
          <p className="text-caption text-text-muted font-mono mt-2">
            {isPreboarding 
              ? '🔒 Access to directory and admin settings is locked.' 
              : '🔓 Full system access unlocked.'}
          </p>
        </div>

        <div className="border border-border bg-surface p-6 rounded-2xl flex flex-col justify-between min-h-[160px] shadow-sm">
          <div>
            <h3 className="font-mono text-caption text-text-muted uppercase">Next Priority Task</h3>
            {nextTask ? (
              <span className="text-body font-bold mt-3 block truncate">{nextTask.title}</span>
            ) : (
              <span className="text-body text-text-muted mt-3 block">No pending tasks left!</span>
            )}
          </div>
          <button
            onClick={() => navigate('/checklist')}
            className="w-fit inline-flex items-center justify-between gap-3 px-5 py-2 bg-[#0B2A3D] hover:bg-[#102C3E] text-white rounded-full transition-all text-body-sm font-semibold mt-4 shadow-sm"
          >
            <span>Go to checklist</span>
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white text-[#0B2A3D]">
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="border border-border bg-surface p-6 lg:col-span-2 rounded-2xl flex flex-col gap-4 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-border pb-2">
            <div>
              <h3 className="text-h2 font-bold text-text-primary">My Week at a Glance</h3>
              <p className="text-caption text-text-muted font-mono mt-0.5">3 DAYS IN OFFICE, 2 DAYS REMOTE POLICY</p>
            </div>
            {!isPreboarding && (
              <span className="font-mono text-[10px] text-[#0B2A3D] uppercase font-bold border border-accent/20 px-2 py-0.5 bg-accent/5 rounded-md">
                ✓ Interactive Scheduler Active (Click cards to toggle)
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 sm:gap-3 lg:gap-4">
            {days.map((day, idx) => {
              const dayIdx = idx.toString();
              const dayIds = scheduler[dayIdx] || [];
              const isUserScheduled = currentUser ? dayIds.includes(currentUser.id) : false;
              const isBuddyScheduled = buddy ? dayIds.includes(buddy.id) : false;
              
              // Real scheduled count for this day (same value HybridScheduler.tsx shows)
              const totalOccupancy = dayIds.length;
              const isCapacityTight = totalOccupancy >= OFFICE_CAPACITY_WARNING;

              return (
                <button
                  key={day}
                  disabled={isPreboarding}
                  onClick={() => { setActiveDayIdx(idx); handleToggleDay(dayIdx); }}
                  className={`text-left p-3 flex flex-col gap-2 transition-all relative rounded-xl ${
                    isPreboarding 
                      ? 'border border-border bg-surface-muted/30 cursor-not-allowed'
                      : isUserScheduled 
                      ? `border-2 ${activeDayIdx === idx ? 'border-accent' : 'border-[#0B2A3D]'} bg-surface shadow-sm hover:bg-surface-muted/20` 
                      : `border ${activeDayIdx === idx ? 'border-accent ring-2 ring-accent/25' : 'border-border'} bg-surface-muted hover:border-[#0B2A3D]/50 hover:bg-surface`
                  }`}
                >
                  <span className="font-mono text-caption text-text-muted uppercase block">{day.slice(0, 3)}</span>
                  <div>
                    <span className="text-body-sm font-bold block">{isUserScheduled ? '🏢 OFFICE' : '🏠 REMOTE'}</span>
                  </div>

                  {isPreboarding ? (
                    <span className="text-[9px] font-mono block text-text-muted">
                      🔒 Locked until your start date
                    </span>
                  ) : (
                    <>
                      <span className={`text-[9px] font-mono block ${isCapacityTight ? 'text-danger font-bold' : 'text-text-muted'}`}>
                        Capacity: {totalOccupancy}/{OFFICE_CAPACITY}
                      </span>

                      <div className="mt-2 pt-2 border-t border-border flex flex-col gap-1 w-full text-left">
                        <span className="text-[10px] font-mono uppercase text-text-muted">Buddy:</span>
                        {isBuddyScheduled && isUserScheduled ? (
                          <span className="text-[10px] text-success font-bold font-mono bg-green-50/50 px-1 border border-success/20 w-fit rounded">
                            ✓ CO-PRESENCE
                          </span>
                        ) : isBuddyScheduled ? (
                          <span className="text-[10px] text-blue-400 font-mono bg-blue-950/20 px-1 border border-blue-500/20 w-fit rounded">
                            🏢 IN OFFICE
                          </span>
                        ) : (
                          <span className="text-[10px] text-text-muted font-mono">REMOTE</span>
                        )}
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {!isPreboarding && (
            <div className="pt-4 border-t border-border flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-mono text-caption uppercase text-text-muted">This Week's Agenda</h4>
                <button
                  onClick={handleDownloadAgenda}
                  disabled={isDownloadingAgenda}
                  className="inline-flex items-center gap-1.5 px-3 py-1 border border-border rounded-full text-caption font-mono text-text-primary hover:bg-surface-muted transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  <span>{isDownloadingAgenda ? 'Preparing...' : 'Download .ics'}</span>
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {days.map((day, idx) => {
                  const dayIdx = idx.toString();
                  const dayIds = scheduler[dayIdx] || [];
                  const isUserScheduled = currentUser ? dayIds.includes(currentUser.id) : false;
                  const isBuddyScheduled = buddy ? dayIds.includes(buddy.id) : false;

                  const openTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
                  const focusTask = openTasks.length > 0 ? openTasks[idx % openTasks.length] : null;

                  let agenda: string;
                  if (!focusTask) {
                    agenda = 'Checklist is all caught up.';
                  } else if (isUserScheduled && isBuddyScheduled) {
                    agenda = `In office with ${buddy?.name.split(' ')[0]} — good day to sync on "${focusTask.title}".`;
                  } else if (isUserScheduled) {
                    agenda = `In office — focus on "${focusTask.title}".`;
                  } else {
                    agenda = `Remote — heads-down on "${focusTask.title}".`;
                  }

                  return (
                    <div key={day} className="flex gap-3 items-baseline text-caption font-mono">
                      <span className="text-text-muted uppercase w-9 shrink-0">{day.slice(0, 3)}</span>
                      <span className="text-text-primary">{agenda}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="border border-border bg-surface p-6 rounded-2xl flex flex-col gap-4 shadow-sm">
          <h3 className="text-h2 font-bold text-text-primary border-b border-border pb-2">My Tech Buddy</h3>
          {buddy ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-surface-muted border border-border flex items-center justify-center rounded-xl">
                  <span className="material-symbols-outlined text-[28px] text-text-muted">person</span>
                </div>
                <div>
                  <h4 className="font-bold text-body">{buddy.name}</h4>
                  <p className="text-caption text-text-muted">{buddy.role}</p>
                </div>
              </div>
              <ul className="font-mono text-caption text-text-primary flex flex-col gap-2 mt-2 bg-surface-muted p-3 border border-border rounded-xl">
                <li className="truncate">EMAIL: {buddy.email}</li>
                <li>SLACK: {buddy.slackHandle}</li>
                <li>DEPT: {buddy.department}</li>
              </ul>
              
              {(() => {
                const overlapDays = days.filter((_, dIdx) => {
                  const dayIds = scheduler[dIdx.toString()] || [];
                  return currentUser && buddy && dayIds.includes(currentUser.id) && dayIds.includes(buddy.id);
                });
                return overlapDays.length > 0 ? (
                  <div className="mt-2 text-caption border border-success text-success p-2 bg-green-50/50 font-mono text-center uppercase text-[10px] rounded-lg">
                    Overlap days: {overlapDays.map(d => d.slice(0, 3)).join(', ')}
                  </div>
                ) : (
                  <div className="mt-2 text-caption border border-warning text-warning p-2 bg-yellow-50/5 font-mono text-center uppercase text-[10px] rounded-lg">
                    No overlapping office days scheduled
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="text-center py-6 text-text-muted font-mono">
              Buddy not assigned yet. Contact HR.
            </div>
          )}
        </div>
      </div>



      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
        <div className="border border-border bg-surface p-6 rounded-2xl flex flex-col justify-between gap-4 shadow-sm">
          <div>
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <span className="material-symbols-outlined text-text-primary text-[24px]">chat_bubble</span>
              <h3 className="text-h2 font-bold text-text-primary">Slack Integration</h3>
            </div>
            <p className="text-body-sm text-text-muted mt-3">
              Sync your weekly hybrid presence schedule directly to your Slack status handle. This lets colleagues see if you are in the office or remote in real-time.
            </p>
          </div>

          <div className="flex flex-col gap-2 bg-surface-muted p-4 border border-border rounded-xl">
            <div className="flex justify-between items-center">
              <span className="font-mono text-caption uppercase text-text-primary">Slack Integration Status:</span>
              <span className={`font-mono text-caption font-bold ${slackSynced ? 'text-success' : 'text-text-muted'}`}>
                {slackSynced ? 'CONNECTED & SYNCED' : 'UNSYNCED'}
              </span>
            </div>
            {slackSynced && currentUser && (
              <div className="border-t border-border mt-2 pt-2 text-caption font-mono text-text-muted flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-success"></span>
                <span>
                  Current Slack Status: <b>{scheduler['1']?.includes(currentUser.id) ? '🏢 Working in Office' : '🏠 Working Remotely'}</b>
                </span>
              </div>
            )}
          </div>

          <button
            onClick={handleSlackSync}
            disabled={isSyncing || isPreboarding}
            className="w-full inline-flex items-center justify-between gap-3 px-5 py-2.5 bg-[#0B2A3D] hover:bg-[#102C3E] text-white rounded-full transition-all text-body-sm font-semibold disabled:opacity-50 disabled:pointer-events-none shadow-sm"
          >
            <span>
              {isSyncing ? 'Syncing Status...' : slackSynced ? 'Refresh Slack Sync' : 'Sync Schedule to Slack'}
            </span>
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white text-[#0B2A3D] shrink-0">
              <span className={`material-symbols-outlined text-[14px] ${isSyncing ? 'animate-spin' : ''}`}>
                {isSyncing ? 'sync' : 'arrow_forward'}
              </span>
            </span>
          </button>
        </div>

        <div className="border border-border bg-surface p-6 rounded-2xl flex flex-col justify-between gap-4 shadow-sm">
          <div>
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <span className="material-symbols-outlined text-text-primary text-[24px]">video_call</span>
              <h3 className="text-h2 font-bold text-text-primary">Google Meet Coordination</h3>
            </div>
            <p className="text-body-sm text-text-muted mt-3">
              Generate instant mock video conferencing links to schedule coffee chats, sprint reviews, or daily standups with your Tech Buddy.
            </p>
          </div>

          <div className="flex flex-col gap-2 bg-surface-muted p-4 border border-border rounded-xl min-h-[72px] justify-center">
            {meetLink ? (
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[10px] text-text-muted uppercase">Interactive Meeting Link:</span>
                <div className="flex justify-between items-center border border-border bg-surface px-2 py-1 rounded-lg">
                  <span className="font-mono text-caption text-text-primary select-all">{meetLink}</span>
                  <a
                    href={`https://${meetLink}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-caption text-accent uppercase font-mono font-bold hover:underline"
                  >
                    Open
                  </a>
                </div>
              </div>
            ) : (
              <span className="font-mono text-caption text-text-muted text-center uppercase block">No active meeting link generated.</span>
            )}
          </div>

          <button
            onClick={handleGenerateMeetLink}
            disabled={isPreboarding}
            className="w-full inline-flex items-center justify-between gap-3 px-5 py-2.5 bg-[#0B2A3D] hover:bg-[#102C3E] text-white rounded-full transition-all text-body-sm font-semibold disabled:opacity-50 disabled:pointer-events-none shadow-sm"
          >
            <span>{meetLink ? 'Clear Meeting Link' : 'Generate Coffee Chat Link'}</span>
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white text-[#0B2A3D] shrink-0">
              <span className="material-symbols-outlined text-[14px]">
                {meetLink ? 'close' : 'arrow_forward'}
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
