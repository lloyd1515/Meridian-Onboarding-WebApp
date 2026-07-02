import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDb } from '../../context/DbContext';
import { getEmployeeChecklist, saveEmployeeChecklist, Task, Employee } from '../../services/db';

export const OnboardingChecklist: React.FC = () => {
  const { currentUser } = useAuth();
  const { employees } = useDb();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [activeSkipTaskId, setActiveSkipTaskId] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState('');
  
  const [justUnlockedTaskId, setJustUnlockedTaskId] = useState<string | null>(null);
  const [showParticlesForId, setShowParticlesForId] = useState<string | null>(null);
  const [srAnnouncement, setSrAnnouncement] = useState<string>('');
  const [copiedSlack, setCopiedSlack] = useState<boolean>(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  const defaultMilestones: Task[] = [
    {
      id: 'task-1',
      title: 'Sign employment contract',
      description: 'Complete electronic signing of your contract and annexes in the portal.',
      status: 'completed',
      dependencies: [],
    },
    {
      id: 'task-2',
      title: 'Configure work laptop',
      description: 'Install operating system, VPN client, and core development tools.',
      status: 'in_progress',
      dependencies: ['task-1'],
    },
    {
      id: 'task-3',
      title: 'First meeting with Buddy',
      description: 'Schedule a 30-minute Zoom or coffee meet to get to know each other.',
      status: 'pending',
      dependencies: ['task-2'],
    },
    {
      id: 'task-4',
      title: 'Install corporate security software',
      description: 'Install the local security agent before accessing the internal network.',
      status: 'blocked',
      blockedBy: 'task-2',
      dependencies: ['task-2', 'task-3'],
    },
    {
      id: 'task-5',
      title: 'Information security training',
      description: 'Complete the mandatory interactive training on the HR platform.',
      status: 'pending',
      dependencies: ['task-1'],
    },
    {
      id: 'task-60-1',
      title: 'Meet the team members',
      description: 'Schedule informal 1-on-1 chats with other engineers in your department.',
      status: 'pending',
      dependencies: [],
    },
    {
      id: 'task-90-1',
      title: 'Submit first Pull Request (PR)',
      description: 'Fix a small bug or implement a minor change in the main codebase.',
      status: 'pending',
      dependencies: ['task-2'],
    },
    {
      id: 'task-90-2',
      title: 'Present a mini-demo',
      description: 'Showcase your completed project during the weekly engineering sync.',
      status: 'pending',
      dependencies: ['task-90-1'],
    },
  ];

  const loadTasks = async () => {
    if (!currentUser) return;
    const loaded = await getEmployeeChecklist(currentUser.id);
    
    if (loaded.length <= 5) {
      const merged = defaultMilestones.map(defTask => {
        const found = loaded.find(t => t.id === defTask.id);
        return found ? { ...defTask, status: found.status } : defTask;
      });
      setTasks(merged);
      await saveEmployeeChecklist(currentUser.id, merged);
    } else {
      setTasks(loaded);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [currentUser]);

  const handleCompleteTask = async (taskId: string) => {
    if (!currentUser) return;
    
    const updatedTasks = tasks.map(task => {
      if (task.id === taskId) {
        return { ...task, status: 'completed' as const };
      }
      return task;
    });

    let newlyUnlocked: Task | null = null;
    const finalTasks = updatedTasks.map(task => {
      if (task.status === 'blocked') {
        const allDependenciesMet = task.dependencies.every(depId => {
          const dep = updatedTasks.find(t => t.id === depId);
          return dep?.status === 'completed' || dep?.status === 'skipped';
        });
        if (allDependenciesMet) {
          newlyUnlocked = task;
          return { ...task, status: 'pending' as const, blockedBy: null };
        }
      }
      return task;
    });

    setTasks(finalTasks);
    await saveEmployeeChecklist(currentUser.id, finalTasks);

    if (newlyUnlocked) {
      const unlockedId = (newlyUnlocked as Task).id;
      setJustUnlockedTaskId(unlockedId);
      setTimeout(() => setJustUnlockedTaskId(null), 1500);
    }
  };

  const onCompleteClick = (taskId: string) => {
    setShowParticlesForId(taskId);
    setTimeout(() => setShowParticlesForId(null), 1200);
    handleCompleteTask(taskId);
  };

  const handleConfirmSkip = async (taskId: string, reasonText: string) => {
    if (!currentUser) return;

    const updatedTasks = tasks.map(task => {
      if (task.id === taskId) {
        return { 
          ...task, 
          status: 'skipped' as const, 
          skipReason: reasonText || 'No explicit reason provided.' 
        };
      }
      return task;
    });

    let newlyUnlocked: Task | null = null;
    const finalTasks = updatedTasks.map(task => {
      if (task.status === 'blocked') {
        const allDependenciesMet = task.dependencies.every(depId => {
          const dep = updatedTasks.find(t => t.id === depId);
          return dep?.status === 'completed' || dep?.status === 'skipped';
        });
        if (allDependenciesMet) {
          newlyUnlocked = task;
          return { ...task, status: 'pending' as const, blockedBy: null };
        }
      }
      return task;
    });

    setTasks(finalTasks);
    await saveEmployeeChecklist(currentUser.id, finalTasks);
    setActiveSkipTaskId(null);
    setSkipReason('');

    if (newlyUnlocked) {
      const unlockedId = (newlyUnlocked as Task).id;
      setJustUnlockedTaskId(unlockedId);
      setTimeout(() => setJustUnlockedTaskId(null), 1500);
    }
  };

  const toggleTaskExpansion = (toggleTaskId: string) => {
    setExpandedTaskId(prev => (prev === toggleTaskId ? null : toggleTaskId));
  };

  const handleResetChecklist = async () => {
    if (!currentUser) return;
    setTasks(defaultMilestones);
    await saveEmployeeChecklist(currentUser.id, defaultMilestones);
  };

  const completedCount = tasks.filter(s => s.status === 'completed').length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
  const activeTask = tasks.find(t => t.status !== 'completed' && t.status !== 'skipped' && t.status !== 'blocked');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveSkipTaskId(null);
        setSkipReason('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (tasks.length > 0 && activeTask) {
      setTimeout(() => {
        const element = document.getElementById(activeTask.id);
        if (element) {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }, 300);
    }
  }, [activeTask, tasks]);

  const renderParticles = () => {
    return (
      <div className="absolute inset-0 pointer-events-none z-30">
        {[...Array(12)].map((_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          const dist = 60 + Math.random() * 50;
          const tx = Math.cos(angle) * dist;
          const ty = Math.sin(angle) * dist;
          const size = i % 2 === 0 ? 'w-1.5 h-1.5' : 'w-2 h-1';
          const bg = i % 3 === 0 ? 'bg-black' : 'bg-success';
          
          return (
            <div
              key={i}
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-particle ${size} ${bg}`}
              style={{
                '--tw-x': `${tx}px`,
                '--tw-y': `${ty}px`,
              } as React.CSSProperties}
            />
          );
        })}
      </div>
    );
  };

  const assignedBuddy = currentUser?.buddyId ? employees.find(e => e.id === currentUser.buddyId) : null;

  // Pure Fabrication / Information Expert: Formats & sanitizes Slack intro message
  const formatSlackIntroMessage = (slackHandle?: string, userName?: string): string => {
    const cleanHandle = (slackHandle || 'buddy').replace(/^@+/, '').replace(/[@<|>\x00-\x1F\x7F-\x9F]/g, '');
    const cleanName = (userName || 'a new hire').replace(/[@<|>\x00-\x1F\x7F-\x9F]/g, '');
    return `Hi @${cleanHandle}! I'm ${cleanName} at Meridian. Looking forward to our onboarding meeting!`;
  };

  const handleCopySlackIntro = async () => {
    const msg = formatSlackIntroMessage(assignedBuddy?.slackHandle, currentUser?.name);
    
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unsupported');
      }
      await navigator.clipboard.writeText(msg);
      setCopiedSlack(true);
      setSrAnnouncement("Slack message template copied to clipboard.");
      copyTimeoutRef.current = setTimeout(() => {
        setCopiedSlack(false);
        setSrAnnouncement("");
      }, 3000);
    } catch (err) {
      setSrAnnouncement("Failed to copy Slack message template to clipboard.");
    }
  };

  return (
    <>
      <div aria-live="polite" className="sr-only">
        {srAnnouncement}
      </div>

      <div className="w-full max-w-[800px] mx-auto flex flex-col gap-8">
      <style>{`
        @keyframes particleOut {
          0% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; }
          100% { transform: translate(calc(-50% + var(--tw-x)), calc(-50% + var(--tw-y))) scale(0.2) rotate(270deg); opacity: 0; }
        }
        .animate-particle {
          animation: particleOut 1.2s cubic-bezier(0.1, 0.8, 0.25, 1) forwards;
        }

        @keyframes checkPop {
          0% { transform: scale(0); opacity: 0; }
          70% { transform: scale(1.3); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-check-pop {
          animation: checkPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <h2 className="text-[32px] font-bold font-sans leading-[1.2] tracking-[-0.01em] mb-1 text-text-primary">Your Onboarding Pathway</h2>
          <p className="text-text-muted text-body leading-[1.5] font-sans">Complete these critical tasks to unlock full system access.</p>
        </div>
        <button 
          onClick={handleResetChecklist}
          className="flex items-center gap-2 bg-transparent border border-[#0B2A3D] hover:bg-[#0B2A3D]/5 text-[#0B2A3D] px-4 py-2 rounded-full font-sans font-medium text-xs transition-colors shrink-0"
        >
          <span>Reset Checklist</span>
          <span className="flex items-center justify-center w-5 h-5 bg-[#0B2A3D] rounded-full text-white">
            <span className="material-symbols-outlined text-[14px] font-bold">restart_alt</span>
          </span>
        </button>
      </div>

      {assignedBuddy && (
        <div className="bg-gradient-to-r from-slate-900 to-[#0B2A3D] text-white p-6 rounded-2xl shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center border border-white/20 shrink-0">
              <span className="material-symbols-outlined text-white text-[24px]">handshake</span>
            </div>
            <div>
              <span className="font-mono text-[10px] uppercase text-accent tracking-widest block font-bold">ASSIGNED TECH BUDDY</span>
              <h3 className="text-h3 font-bold text-white mt-0.5">{assignedBuddy.name}</h3>
              <p className="text-xs text-slate-300 font-mono">{assignedBuddy.role} • {assignedBuddy.department}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopySlackIntro}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-xs font-mono text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              aria-label="Copy Slack intro template to clipboard"
            >
              <span className="material-symbols-outlined text-[14px]">content_copy</span>
              <span>{copiedSlack ? 'Copied to Clipboard!' : 'Copy Slack Template'}</span>
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center bg-surface p-6 border border-border rounded-2xl shadow-sm">
        <div className="flex flex-col">
          <span className="font-mono text-[10px] text-text-muted uppercase tracking-[2px]">ONBOARDING PROGRESS</span>
          <span className="text-2xl font-bold font-sans text-text-primary mt-1">{progressPercent}% COMPLETE</span>
        </div>
        <div className="w-48 h-3 bg-background rounded-full overflow-hidden border border-border">
          <div className="h-full bg-accent transition-all duration-500 rounded-full" style={{ width: `${progressPercent}%` }}></div>
        </div>
      </div>


      <div className="relative pl-8 mt-4">
        
        <div className="absolute left-[15px] top-4 bottom-0 w-[2px] bg-border"></div>

        {tasks.map((task) => {
          const isCompleted = task.status === 'completed';
          const isSkipped = task.status === 'skipped';
          const isBlocked = task.status === 'blocked';
          
          const isActive = activeTask ? activeTask.id === task.id : false;
          const isProgress = task.status === 'in_progress' || isActive;
          const isPending = task.status === 'pending' && !isActive;

          const hasParticles = showParticlesForId === task.id;

          const incompleteDeps = task.dependencies.filter(depId => 
            tasks.find(t => t.id === depId)?.status !== 'completed' &&
            tasks.find(t => t.id === depId)?.status !== 'skipped'
          );

          const isBodyExpanded = isProgress || (isCompleted && expandedTaskId === task.id);
          const durationClass = isBodyExpanded ? 'duration-[700ms]' : 'duration-[300ms]';
          let cardContainerClass = "border border-border bg-surface p-6 cursor-pointer hover:bg-background rounded-2xl shadow-sm";
          let nodeStyle = "border-border bg-surface text-text-muted";
          let nodeContent = "";

          if (isCompleted) {
            cardContainerClass = "border border-border bg-surface p-6 cursor-pointer hover:bg-background border-l-4 border-l-success text-text-muted line-through rounded-2xl shadow-sm";
            nodeStyle = "border-success bg-success text-surface";
            nodeContent = "✓";
          } else if (isSkipped) {
            cardContainerClass = "border border-border bg-background p-6 italic text-text-muted opacity-75 rounded-2xl";
            nodeStyle = "border-border bg-background text-text-muted";
            nodeContent = "-";
          } else if (isBlocked) {
            cardContainerClass = "border border-danger/30 bg-surface p-6 opacity-65 pointer-events-none rounded-2xl shadow-sm";
            nodeStyle = "border-danger bg-surface text-danger";
            nodeContent = "🔒";
          } else if (isProgress) {
            cardContainerClass = "border-2 border-accent bg-surface p-6 shadow-md rounded-2xl";
            nodeStyle = "border-accent bg-accent text-surface";
          }

          const blocker = task.blockedBy ? tasks.find(t => t.id === task.blockedBy) : null;

          return (
            <div key={task.id} id={task.id} className={`relative mb-8 transition-all ${durationClass}`}>
              
              {/* Visual Node Marker */}
              <div className={`absolute -left-[41px] top-1.5 w-8 h-8 border flex items-center justify-center z-10 rounded-full transition-colors ${durationClass} ${nodeStyle}`}>
                {nodeContent === "✓" && <span className="material-symbols-outlined text-white text-[18px] font-bold animate-check-pop">check</span>}
                {nodeContent === "-" && <span className="material-symbols-outlined text-text-muted text-[18px]">remove</span>}
                {nodeContent === "🔒" && <span className="material-symbols-outlined text-danger text-[18px]">lock</span>}
                {nodeContent === "" && !isProgress && <span className="w-1.5 h-1.5 rounded-full bg-text-muted"></span>}
                {nodeContent === "" && isProgress && <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse"></span>}
                {hasParticles && renderParticles()}
              </div>

              <div 
                onClick={() => isCompleted && toggleTaskExpansion(task.id)}
                className={`transition-all ease-in-out ${durationClass} ${cardContainerClass}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1 flex-1">
                    <span className="font-mono text-[10px] text-text-muted uppercase tracking-[2px] mb-1 block">
                      {isCompleted ? 'Completed Task' : isSkipped ? 'Skipped Task' : isBlocked ? 'Blocked Step' : isProgress ? 'Active Step' : 'Pending Step'}
                    </span>
                    <h3 className="text-h3 font-bold font-sans text-text-primary leading-tight">
                      {task.title}
                    </h3>
                  </div>

                  {isBlocked && blocker && (
                    <span className="font-mono text-[10px] text-danger bg-danger/10 border border-danger/20 px-2 py-1 uppercase tracking-wider shrink-0 flex items-center gap-1 rounded-full">
                      <span className="material-symbols-outlined text-[12px]">lock</span>
                      BLOCKED BY BUDDY
                    </span>
                  )}
                </div>

                <div 
                  className={`transition-all ease-in-out overflow-hidden ${durationClass} ${
                    isBodyExpanded 
                      ? 'max-h-[350px] opacity-100 mt-4 pt-4 border-t border-border' 
                      : 'max-h-0 opacity-0 mt-0 pt-0 border-t-0 border-transparent'
                  }`}
                >
                  <div className="flex flex-col gap-4">
                    <div>
                      <span className="font-mono text-[10px] leading-none tracking-[2px] uppercase block mb-1 text-text-muted">Description</span>
                      <p className="text-body-sm text-text-primary leading-relaxed font-sans">{task.description}</p>
                    </div>

                    {task.id === 'task-2' && activeSkipTaskId === 'task-2' && (
                      <div className="flex flex-col gap-2 p-3 bg-background border border-border rounded-xl" onClick={(e) => e.stopPropagation()}>
                        <span className="font-mono text-[10px] uppercase tracking-[2px] text-text-muted">Inline Skip Action:</span>
                        <input
                          type="text"
                          placeholder="Specify reason for skipping..."
                          value={skipReason}
                          onChange={(e) => setSkipReason(e.target.value)}
                          className="bg-transparent px-3 py-1.5 text-xs font-sans text-text-primary w-full border border-border rounded-lg focus:outline-none"
                          autoFocus
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => {
                              setActiveSkipTaskId(null);
                              setSkipReason('');
                            }}
                            className="px-3 py-1 text-xs font-sans font-medium text-[#0B2A3D] hover:bg-[#0B2A3D]/5 rounded-lg border border-[#0B2A3D] transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleConfirmSkip(task.id, skipReason)}
                            className="px-3 py-1 text-xs font-sans font-medium text-white bg-success hover:bg-success/90 rounded-lg transition-colors"
                          >
                            Confirm
                          </button>
                        </div>
                      </div>
                    )}

                    {task.id === 'task-2' && (
                      <div>
                        <span className="font-mono text-[10px] leading-none tracking-[2px] uppercase block mb-1 text-text-muted">Resource</span>
                        <a 
                          href="#"
                          onClick={(e) => e.stopPropagation()} 
                          className="text-accent underline font-sans text-body-sm font-bold hover:text-text-primary transition-colors inline-flex items-center gap-1"
                        >
                          <span>Internal Store</span>
                          <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                        </a>
                      </div>
                    )}

                    {task.id === 'task-3' && (
                      <div className="flex flex-col gap-2 p-3 bg-[#F8FAFC] border border-border rounded-xl">
                        <span className="font-mono text-[10px] leading-none tracking-[2px] uppercase block text-text-muted">Video Meeting Link</span>
                        <div className="flex items-center justify-between gap-2">
                          <a 
                            href="https://meet.google.com/meridian-buddy-coffee"
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()} 
                            className="text-accent underline font-mono text-xs font-bold hover:text-text-primary transition-colors inline-flex items-center gap-1"
                          >
                            <span>meet.google.com/meridian-buddy-coffee</span>
                            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                          </a>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleCopySlackIntro(); }}
                            className="px-2.5 py-1 text-[11px] font-mono border border-[#0B2A3D] text-[#0B2A3D] hover:bg-[#0B2A3D] hover:text-white rounded-lg transition-colors cursor-pointer"
                          >
                            {copiedSlack ? 'Copied!' : 'Copy Slack Intro'}
                          </button>
                        </div>
                      </div>
                    )}


                    {!isCompleted && !isBlocked && incompleteDeps.length > 0 && (
                      <div className="bg-background p-3 border border-border rounded-xl font-mono text-[11px] leading-tight flex items-start gap-2 text-warning">
                        <span className="material-symbols-outlined text-[16px] text-warning shrink-0">warning</span>
                        <span>Recommendation: Complete "{tasks.find(t => t.id === incompleteDeps[0])?.title}" first</span>
                      </div>
                    )}

                    {!isCompleted && !isBlocked && !isSkipped && (
                      <div className="flex gap-3 mt-2" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => onCompleteClick(task.id)}
                          className="flex items-center gap-3 bg-[#0B2A3D] hover:bg-[#13313F] text-white px-5 py-2 rounded-full font-sans font-medium text-xs transition-colors shadow-sm"
                        >
                          <span>Complete Task</span>
                          <span className="flex items-center justify-center w-5 h-5 bg-white rounded-full text-[#0B2A3D]">
                            <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                          </span>
                        </button>

                        {(isPending || task.id === 'task-2' || task.id === 'task-3' || task.id === 'task-4') && (
                          <>
                            {activeSkipTaskId === task.id ? (
                              task.id !== 'task-2' && task.id !== 'task-3' && task.id !== 'task-4' && (
                                <div className="flex items-center gap-2 bg-background p-1.5 rounded-full border border-border w-full max-w-md">
                                  <input
                                    type="text"
                                    placeholder="Skip reason..."
                                    value={skipReason}
                                    onChange={(e) => setSkipReason(e.target.value)}
                                    className="bg-transparent px-3 py-1 text-xs font-sans text-text-primary w-full focus:outline-none"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleConfirmSkip(task.id, skipReason)}
                                    className="w-8 h-8 flex items-center justify-center bg-success text-white rounded-full hover:bg-success/90 shrink-0 transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-[16px] font-bold">check</span>
                                  </button>
                                  <button
                                    onClick={() => setActiveSkipTaskId(null)}
                                    className="w-8 h-8 flex items-center justify-center bg-[#0B2A3D] text-white rounded-full hover:bg-[#13313F] shrink-0 transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-[16px] font-bold">close</span>
                                  </button>
                                </div>
                              )
                            ) : (
                              <button 
                                onClick={() => setActiveSkipTaskId(task.id)}
                                className="flex items-center gap-3 bg-transparent border border-[#0B2A3D] hover:bg-[#0B2A3D]/5 text-[#0B2A3D] px-5 py-2 rounded-full font-sans font-medium text-xs transition-colors"
                              >
                                <span>Skip Task...</span>
                                <span className="flex items-center justify-center w-5 h-5 bg-[#0B2A3D] rounded-full text-white">
                                  <span className="material-symbols-outlined text-[14px] font-bold">arrow_forward</span>
                                </span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          );
        })}
      </div>
    </div>

      {activeSkipTaskId === 'task-3' && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => {
            setActiveSkipTaskId(null);
            setSkipReason('');
          }}
        >
          <div 
            className="bg-surface border border-border p-6 rounded-2xl shadow-xl max-w-md w-full mx-4 flex flex-col gap-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="text-xl font-bold font-sans text-text-primary">Skip Compliance Check</h3>
              <button
                type="button"
                onClick={() => {
                  setActiveSkipTaskId(null);
                  setSkipReason('');
                }}
                className="text-text-muted hover:text-text-primary transition-colors flex items-center justify-center w-8 h-8 rounded-full hover:bg-background"
                aria-label="close"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            
            <textarea
              placeholder="Provide skip justification statement here..."
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              className="w-full min-h-[100px] p-3 bg-background border border-border rounded-xl text-sm font-sans text-text-primary focus:outline-none focus:ring-1 focus:ring-accent resize-y"
              autoFocus
            />

            <div className="flex justify-end gap-3 font-sans">
              <button
                type="button"
                onClick={() => {
                  setActiveSkipTaskId(null);
                  setSkipReason('');
                }}
                className="px-4 py-2 border border-border hover:bg-background rounded-full text-text-primary font-medium text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmSkip('task-3', skipReason)}
                className="px-4 py-2 bg-[#0B2A3D] hover:bg-[#13313F] text-white rounded-full font-medium text-xs transition-colors"
              >
                Submit Justification
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSkipTaskId === 'task-4' && (
        <div 
          className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm"
          onClick={() => {
            setActiveSkipTaskId(null);
            setSkipReason('');
          }}
        >
          <div 
            className="bg-surface border-l border-border w-full max-w-md h-full flex flex-col gap-4 p-6 shadow-2xl relative animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-4 border-b border-border">
              <h3 className="text-xl font-bold font-sans text-text-primary">Skip Audit Flow</h3>
              <button
                type="button"
                onClick={() => {
                  setActiveSkipTaskId(null);
                  setSkipReason('');
                }}
                className="text-text-muted hover:text-text-primary transition-colors flex items-center justify-center w-8 h-8 rounded-full hover:bg-background"
                aria-label="close"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            
            <div className="flex-1 flex flex-col gap-4">
              <textarea
                placeholder="Explain why this step is bypassed..."
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                className="w-full min-h-[150px] p-3 bg-background border border-border rounded-xl text-sm font-sans text-text-primary focus:outline-none focus:ring-1 focus:ring-accent resize-y"
                autoFocus
              />
            </div>

            <div className="flex gap-3 font-sans pb-4">
              <button
                type="button"
                onClick={() => {
                  setActiveSkipTaskId(null);
                  setSkipReason('');
                }}
                className="flex-1 px-4 py-2.5 border border-border hover:bg-background rounded-full text-text-primary font-medium text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmSkip('task-4', skipReason)}
                className="flex-1 px-4 py-2.5 bg-danger text-white rounded-full font-medium text-xs transition-colors hover:opacity-90"
              >
                Log Bypass & Flag HR
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
export default OnboardingChecklist;
