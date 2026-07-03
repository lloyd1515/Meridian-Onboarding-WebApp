import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDb } from '../../context/DbContext';
import { getEmployeeChecklist, Task, Employee } from '../../services/db';
import { useNavigate } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { currentUser, isPreboarding } = useAuth();
  const { employees, scheduler, updateScheduler } = useDb();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [buddy, setBuddy] = useState<Employee | null>(null);
  const navigate = useNavigate();

  const [isSyncing, setIsSyncing] = useState(false);
  const [slackSynced, setSlackSynced] = useState(false);
  const [meetLink, setMeetLink] = useState<string | null>(null);
  const [activeDayIdx, setActiveDayIdx] = useState<number>(0);

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

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  const handleToggleDay = async (dayIdx: string) => {
    if (isPreboarding || !currentUser) return;

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

      if (scheduledDaysCount >= 3) {
        alert("🔒 Strict limit reached: This employee is already scheduled for 3 office days this week.");
        return;
      }

      // Toggle on: Check occupancy rules against the real scheduled count
      // for this day (same value HybridScheduler.tsx shows) -- adding this
      // employee makes it currentList.length + 1.
      const totalOccupancy = currentList.length + 1;

      // Office capacity is 130 seats, warning threshold 124 (95% of 130) — must stay
      // in sync with the capacity cap in HybridScheduler.tsx (src/features/hr-admin/HybridScheduler.tsx).
      // Absolute daily capacity limit is 130
      if (totalOccupancy >= 130) {
        alert('🔒 Capacity limit reached! The office cannot exceed 130 employees on any single day.');
        return;
      }

      // 95% capacity buffer alert (95% of 130 is 123.5 -> 124)
      if (totalOccupancy >= 124) {
        alert('⚠️ ALERT: Capacity threshold reached. No more employees can be scheduled on this day.');
      }
      
      newList = [...currentList, currentUser.id];
    }

    const updatedScheduler = {
      ...scheduler,
      [dayIdx]: newList
    };

    await updateScheduler(updatedScheduler);
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
      </div>

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
            <span className={`text-h2 font-bold leading-none mt-4 block uppercase ${isPreboarding ? 'text-danger' : 'text-success'}`}>
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
              <span className="font-mono text-[10px] text-accent uppercase font-bold border border-accent/20 px-2 py-0.5 bg-accent/5 rounded-md">
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
              // Office capacity 130, warn at 124 — keep in sync with HybridScheduler.tsx
              const isCapacityTight = totalOccupancy >= 124;

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
                    <span className="text-body-sm font-bold block">{isUserScheduled ? '🏢 BIROU' : '🏠 REMOTE'}</span>
                  </div>

                  <span className={`text-[9px] font-mono block ${isCapacityTight ? 'text-danger font-bold' : 'text-text-muted'}`}>
                    Capacitate: {totalOccupancy}/130
                  </span>

                  <div className="mt-2 pt-2 border-t border-border flex flex-col gap-1 w-full text-left">
                    <span className="text-[10px] font-mono uppercase text-text-muted">Buddy:</span>
                    {isBuddyScheduled && isUserScheduled ? (
                      <span className="text-[10px] text-success font-bold font-mono bg-green-50/50 px-1 border border-success/20 w-fit rounded">
                        ✓ CO-PRESENCE
                      </span>
                    ) : isBuddyScheduled ? (
                      <span className="text-[10px] text-blue-400 font-mono bg-blue-950/20 px-1 border border-blue-500/20 w-fit rounded">
                        🏢 LA BIROU
                      </span>
                    ) : (
                      <span className="text-[10px] text-text-muted font-mono">REMOTE</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
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
                    Overlap zile: {overlapDays.map(d => d.slice(0, 3)).join(', ')}
                  </div>
                ) : (
                  <div className="mt-2 text-caption border border-warning text-warning p-2 bg-yellow-50/5 font-mono text-center uppercase text-[10px] rounded-lg">
                    Fără suprapuneri stabilite
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
