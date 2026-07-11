import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { Footer } from './Footer';

interface LayoutShellProps {
  children: React.ReactNode;
}

export const LayoutShell: React.FC<LayoutShellProps> = ({ children }) => {
  const { role, isPreboarding, simulationDate, setSimulationDate, setRole, currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [activeDropdown, setActiveDropdown] = React.useState<'foundation' | 'practice' | 'proof' | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const timeoutRef = React.useRef<number | null>(null);

  const handleRoleToggle = () => {
    const nextRole = role === 'employee' ? 'admin' : 'employee';
    setRole(nextRole);
    if (nextRole === 'admin') {
      navigate('/admin/directory');
    } else {
      navigate('/dashboard');
    }
  };

  const handleMouseEnter = (menu: 'foundation' | 'practice' | 'proof') => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setActiveDropdown(menu);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      setActiveDropdown(null);
    }, 200);
  };

  const handleMenuClick = (menu: 'foundation' | 'practice' | 'proof') => {
    if (activeDropdown === menu) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown(menu);
    }
  };

  React.useEffect(() => {
    setActiveDropdown(null);
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-text-primary">
      <div className="w-full bg-[#E9F1F3] border-b border-border text-text-primary px-6 py-2 flex flex-wrap gap-4 justify-between items-center text-caption font-mono">
        <div className="flex items-center gap-3">
          <span className="uppercase text-[10px] font-bold text-text-muted tracking-wider">Simulation Date:</span>
          <input
            type="date"
            value={simulationDate}
            onChange={(e) => setSimulationDate(e.target.value)}
            className="border border-border rounded bg-white px-2 py-0.5 text-[11px] focus:outline-none focus:border-accent font-sans"
          />
          {isPreboarding && (
            <span className="text-[10px] text-danger font-bold border border-danger/30 rounded px-1.5 py-0.5 bg-red-50">
              🔒 Directory Locked (Before Hire Date)
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 text-text-muted text-[11px]">
            <span className="material-symbols-outlined text-[14px]">person</span>
            <span>{currentUser?.name} ({currentUser?.role})</span>
          </div>

          <button
            onClick={handleRoleToggle}
            className="bg-white border border-border text-text-primary hover:bg-[#0B2A3D] hover:text-white transition-colors px-2 py-0.5 rounded text-[11px] font-bold font-mono"
          >
            Switch to {role === 'employee' ? 'HR Admin' : 'Employee'}
          </button>

          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="flex items-center gap-1 text-text-muted hover:text-danger transition-colors text-[11px] font-mono"
          >
            <span className="material-symbols-outlined text-[14px]">logout</span>
            <span>Logout</span>
          </button>
        </div>
      </div>

      <div className="sticky top-0 z-50 w-full px-4 md:px-6 pt-4 pb-2 bg-transparent">
        <div className="max-w-[1600px] mx-auto bg-white border border-border rounded-2xl shadow-sm px-6 py-4 flex items-center justify-between relative">
          
          <div 
            onClick={() => navigate('/dashboard')} 
            className="flex items-center gap-2.5 cursor-pointer select-none"
          >
            <div className="w-5 h-5 bg-gradient-to-br from-[#2BC4D9] to-[#F2994A] rotate-45 transform rounded-sm shadow-sm" />
            <span className="font-sans font-bold text-xl tracking-tight">
              <span className="text-[#0B2A3D]">Meri</span>
              <span className="text-accent">dian</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <button
              onMouseEnter={() => handleMouseEnter('foundation')}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleMenuClick('foundation')}
              className={`font-sans text-[15px] font-medium transition-colors flex items-center gap-1 py-1 ${
                activeDropdown === 'foundation' ? 'text-slate-400' : 'text-[#0B2A3D] hover:text-accent'
              }`}
            >
              My Onboarding
              <span className={`material-symbols-outlined text-[16px] transition-transform duration-200 ${activeDropdown === 'foundation' ? 'rotate-180' : ''}`}>
                keyboard_arrow_down
              </span>
            </button>

            <button
              onMouseEnter={() => handleMouseEnter('practice')}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleMenuClick('practice')}
              className={`font-sans text-[15px] font-medium transition-colors flex items-center gap-1 py-1 ${
                activeDropdown === 'practice' ? 'text-slate-400' : 'text-[#0B2A3D] hover:text-accent'
              }`}
            >
              Company Guide
              <span className={`material-symbols-outlined text-[16px] transition-transform duration-200 ${activeDropdown === 'practice' ? 'rotate-180' : ''}`}>
                keyboard_arrow_down
              </span>
            </button>

            <button
              onMouseEnter={() => handleMouseEnter('proof')}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleMenuClick('proof')}
              className={`font-sans text-[15px] font-medium transition-colors flex items-center gap-1 py-1 ${
                activeDropdown === 'proof' ? 'text-slate-400' : 'text-[#0B2A3D] hover:text-accent'
              }`}
            >
              Directory & Admin
              <span className={`material-symbols-outlined text-[16px] transition-transform duration-200 ${activeDropdown === 'proof' ? 'rotate-180' : ''}`}>
                keyboard_arrow_down
              </span>
            </button>
          </div>

          <div className="hidden md:flex items-center">
            <button
              onClick={() => navigate('/checklist')}
              className="flex items-center gap-3 bg-[#0B2A3D] hover:bg-[#13313F] text-white px-5 py-2 rounded-full font-sans font-medium text-body-sm transition-colors shadow-sm"
            >
              <span>Checklist</span>
              <span className="flex items-center justify-center w-5 h-5 bg-white rounded-full text-[#0B2A3D]">
                <span className="material-symbols-outlined text-[14px] font-bold">arrow_forward</span>
              </span>
            </button>
          </div>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden text-[#0B2A3D] focus:outline-none flex items-center justify-center p-1"
          >
            <span className="material-symbols-outlined text-[28px]">
              {isMobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>

          {activeDropdown === 'practice' && (
            <div
              className="absolute left-0 w-full bg-white border-t border-border shadow-xl z-50 font-sans text-text-primary rounded-b-2xl"
              style={{ top: '100%' }}
              onMouseEnter={() => handleMouseEnter('practice')}
              onMouseLeave={handleMouseLeave}
            >
              <div className="max-w-[1600px] mx-auto px-6 py-8 md:py-12 grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
                <div className="md:col-span-1 flex flex-col gap-3">
                  <span className="font-mono text-[10px] text-accent uppercase tracking-widest font-semibold">
                    company guide
                  </span>
                  <h3 className="font-sans font-bold text-h4 text-[#0B2A3D]">
                    New Here? Start With This
                  </h3>
                  <p className="text-body-sm text-text-muted leading-relaxed">
                    First-day logistics, IT setup, hybrid policy, and Slack/Meet basics -- department-relevant answers first.
                  </p>
                </div>

                <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                  <a
                    href="#/guide"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/guide');
                      setActiveDropdown(null);
                    }}
                    className="group flex flex-col gap-1.5 p-3 -m-3 hover:bg-slate-50 transition-all duration-200 rounded"
                  >
                    <div className="font-sans font-bold text-body text-[#0B2A3D] group-hover:text-accent transition-colors flex items-center gap-1.5">
                      Full Company Guide
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-accent text-body-sm">
                        →
                      </span>
                    </div>
                    <div className="text-body-sm text-text-muted leading-relaxed">
                      First-day logistics, IT & equipment setup, hybrid policy, Slack & Meet basics, and department notes.
                    </div>
                  </a>

                  <a
                    href="#/guide#department-notes"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/guide');
                      setActiveDropdown(null);
                    }}
                    className="group flex flex-col gap-1.5 p-3 -m-3 hover:bg-slate-50 transition-all duration-200 rounded"
                  >
                    <div className="font-sans font-bold text-body text-[#0B2A3D] group-hover:text-accent transition-colors flex items-center gap-1.5">
                      Department Notes
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-accent text-body-sm">
                        →
                      </span>
                    </div>
                    <div className="text-body-sm text-text-muted leading-relaxed">
                      What to expect in your first month, specific to Engineering, Sales, Marketing, Finance, or HR.
                    </div>
                  </a>
                </div>
              </div>
            </div>
          )}

          {activeDropdown === 'foundation' && (
            <div 
              className="absolute left-0 w-full bg-white border-t border-border shadow-xl z-50 font-sans text-text-primary rounded-b-2xl"
              style={{ top: '100%' }}
              onMouseEnter={() => handleMouseEnter('foundation')}
              onMouseLeave={handleMouseLeave}
            >
              <div className="max-w-[1600px] mx-auto px-6 py-8 md:py-12 grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
                <div className="md:col-span-1 flex flex-col gap-3">
                  <span className="font-mono text-[10px] text-accent uppercase tracking-widest font-semibold">
                    my onboarding
                  </span>
                  <h3 className="font-sans font-bold text-h4 text-[#0B2A3D]">
                    Your Journey Starts Here
                  </h3>
                  <p className="text-body-sm text-text-muted leading-relaxed">
                    Access your personalized onboarding hub, explore tasks, and view your progress.
                  </p>
                </div>

                <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                  <a
                    href="#/dashboard"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/dashboard');
                      setActiveDropdown(null);
                    }}
                    className="group flex flex-col gap-1.5 p-3 -m-3 hover:bg-slate-50 transition-all duration-200 rounded"
                  >
                    <div className="font-sans font-bold text-body text-[#0B2A3D] group-hover:text-accent transition-colors flex items-center gap-1.5">
                      My Week
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-accent text-body-sm">
                        →
                      </span>
                    </div>
                    <div className="text-body-sm text-text-muted leading-relaxed">
                      Your personal dashboard, upcoming schedule, and integration board.
                    </div>
                  </a>

                  <a
                    href="#/checklist"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/checklist');
                      setActiveDropdown(null);
                    }}
                    className="group flex flex-col gap-1.5 p-3 -m-3 hover:bg-slate-50 transition-all duration-200 rounded"
                  >
                    <div className="font-sans font-bold text-body text-[#0B2A3D] group-hover:text-accent transition-colors flex items-center gap-1.5">
                      Onboarding Checklist
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-accent text-body-sm">
                        →
                      </span>
                    </div>
                    <div className="text-body-sm text-text-muted leading-relaxed">
                      Complete tasks, view active phases, and stay on top of your milestones.
                    </div>
                  </a>

                  <a
                    href="#/ask-hr"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/ask-hr');
                      setActiveDropdown(null);
                    }}
                    className="group flex flex-col gap-1.5 p-3 -m-3 hover:bg-slate-50 transition-all duration-200 rounded"
                  >
                    <div className="font-sans font-bold text-body text-[#0B2A3D] group-hover:text-accent transition-colors flex items-center gap-1.5">
                      Ask HR
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-accent text-body-sm">
                        →
                      </span>
                    </div>
                    <div className="text-body-sm text-text-muted leading-relaxed">
                      Send HR a question and get an answer here once they reply.
                    </div>
                  </a>
                </div>
              </div>
            </div>
          )}

          {activeDropdown === 'proof' && (
            <div 
              className="absolute left-0 w-full bg-white border-t border-border shadow-xl z-50 font-sans text-text-primary rounded-b-2xl"
              style={{ top: '100%' }}
              onMouseEnter={() => handleMouseEnter('proof')}
              onMouseLeave={handleMouseLeave}
            >
              <div className="max-w-[1600px] mx-auto px-6 py-8 md:py-12 grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
                <div className="md:col-span-1 flex flex-col gap-3">
                  <span className="font-mono text-[10px] text-accent uppercase tracking-widest font-semibold">
                    directory & admin
                  </span>
                  <h3 className="font-sans font-bold text-h4 text-[#0B2A3D]">
                    People & Operations
                  </h3>
                  <p className="text-body-sm text-text-muted leading-relaxed">
                    Connect with the Meridian network, plan schedules, and administer platform data.
                  </p>
                </div>

                <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                  {role === 'employee' ? (
                    !isPreboarding ? (
                      <a
                        href="#/directory"
                        onClick={(e) => {
                          e.preventDefault();
                          navigate('/directory');
                          setActiveDropdown(null);
                        }}
                        className="group flex flex-col gap-1.5 p-3 -m-3 hover:bg-slate-50 transition-all duration-200 rounded"
                      >
                        <div className="font-sans font-bold text-body text-[#0B2A3D] group-hover:text-accent transition-colors flex items-center gap-1.5">
                          Company Directory
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-accent text-body-sm">
                            →
                          </span>
                        </div>
                        <div className="text-body-sm text-text-muted leading-relaxed">
                          Explore the employee directory and search for profiles.
                        </div>
                      </a>
                    ) : (
                      <div className="flex flex-col gap-1.5 p-3 -m-3 opacity-50 cursor-not-allowed">
                        <div className="font-sans font-bold text-body text-text-muted flex items-center gap-1.5">
                          Company Directory
                          <span className="text-caption text-danger border border-danger/30 rounded px-1.5 py-0.5 bg-red-50 font-normal">
                            🔒 Locked
                          </span>
                        </div>
                        <div className="text-body-sm text-text-muted leading-relaxed">
                          Access is restricted during pre-boarding phase.
                        </div>
                      </div>
                    )
                  ) : (
                    <a
                      href="#/admin/directory"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate('/admin/directory');
                        setActiveDropdown(null);
                      }}
                      className="group flex flex-col gap-1.5 p-3 -m-3 hover:bg-slate-50 transition-all duration-200 rounded"
                    >
                      <div className="font-sans font-bold text-body text-[#0B2A3D] group-hover:text-accent transition-colors flex items-center gap-1.5">
                        Admin Directory
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-accent text-body-sm">
                          →
                        </span>
                      </div>
                      <div className="text-body-sm text-text-muted leading-relaxed">
                        Manage employee profiles, phase states, and onboarding records.
                      </div>
                    </a>
                  )}

                  {role === 'admin' && (
                    <>
                      <a
                        href="#/admin/scheduler"
                        onClick={(e) => {
                          e.preventDefault();
                          navigate('/admin/scheduler');
                          setActiveDropdown(null);
                        }}
                        className="group flex flex-col gap-1.5 p-3 -m-3 hover:bg-slate-50 transition-all duration-200 rounded"
                      >
                        <div className="font-sans font-bold text-body text-[#0B2A3D] group-hover:text-accent transition-colors flex items-center gap-1.5">
                          Team Scheduler
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-accent text-body-sm">
                            →
                          </span>
                        </div>
                        <div className="text-body-sm text-text-muted leading-relaxed">
                          Manage team schedules, plan office days, and occupancy rates.
                        </div>
                      </a>

                      <a
                        href="#/admin/backup"
                        onClick={(e) => {
                          e.preventDefault();
                          navigate('/admin/backup');
                          setActiveDropdown(null);
                        }}
                        className="group flex flex-col gap-1.5 p-3 -m-3 hover:bg-slate-50 transition-all duration-200 rounded"
                      >
                        <div className="font-sans font-bold text-body text-[#0B2A3D] group-hover:text-accent transition-colors flex items-center gap-1.5">
                          Backup & Restore
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-accent text-body-sm">
                            →
                          </span>
                        </div>
                        <div className="text-body-sm text-text-muted leading-relaxed">
                          System database backups, restores, and reset configurations.
                        </div>
                      </a>

                      <a
                        href="#/admin/questions"
                        onClick={(e) => {
                          e.preventDefault();
                          navigate('/admin/questions');
                          setActiveDropdown(null);
                        }}
                        className="group flex flex-col gap-1.5 p-3 -m-3 hover:bg-slate-50 transition-all duration-200 rounded"
                      >
                        <div className="font-sans font-bold text-body text-[#0B2A3D] group-hover:text-accent transition-colors flex items-center gap-1.5">
                          Ask HR Inbox
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-accent text-body-sm">
                            →
                          </span>
                        </div>
                        <div className="text-body-sm text-text-muted leading-relaxed">
                          Review and answer questions submitted by employees.
                        </div>
                      </a>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {isMobileMenuOpen && (
            <div className="md:hidden absolute top-[100%] left-0 w-full bg-white border-t border-border shadow-xl rounded-b-2xl z-50 p-6 flex flex-col gap-6 font-sans">
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[10px] text-accent uppercase tracking-widest font-semibold">
                  My Onboarding
                </span>
                <div className="flex flex-col gap-2 pl-2">
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="text-left font-semibold text-[#0B2A3D] hover:text-accent py-1 text-body-sm"
                  >
                    My Week
                  </button>
                  <button
                    onClick={() => navigate('/checklist')}
                    className="text-left font-semibold text-[#0B2A3D] hover:text-accent py-1 text-body-sm"
                  >
                    Onboarding Checklist
                  </button>
                  <button
                    onClick={() => navigate('/ask-hr')}
                    className="text-left font-semibold text-[#0B2A3D] hover:text-accent py-1 text-body-sm"
                  >
                    Ask HR
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-mono text-[10px] text-accent uppercase tracking-widest font-semibold">
                  Company Guide
                </span>
                <div className="flex flex-col gap-2 pl-2">
                  <button
                    onClick={() => navigate('/guide')}
                    className="text-left font-semibold text-[#0B2A3D] hover:text-accent py-1 text-body-sm"
                  >
                    Full Company Guide
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-mono text-[10px] text-accent uppercase tracking-widest font-semibold">
                  Directory & Admin
                </span>
                <div className="flex flex-col gap-2 pl-2">
                  {role === 'employee' ? (
                    !isPreboarding && (
                      <button
                        onClick={() => navigate('/directory')}
                        className="text-left font-semibold text-[#0B2A3D] hover:text-accent py-1 text-body-sm"
                      >
                        Company Directory
                      </button>
                    )
                  ) : (
                    <>
                      <button
                        onClick={() => navigate('/admin/directory')}
                        className="text-left font-semibold text-[#0B2A3D] hover:text-accent py-1 text-body-sm"
                      >
                        Admin Directory
                      </button>
                      <button
                        onClick={() => navigate('/admin/scheduler')}
                        className="text-left font-semibold text-[#0B2A3D] hover:text-accent py-1 text-body-sm"
                      >
                        Team Scheduler
                      </button>
                      <button
                        onClick={() => navigate('/admin/backup')}
                        className="text-left font-semibold text-[#0B2A3D] hover:text-accent py-1 text-body-sm"
                      >
                        Backup & Restore
                      </button>
                      <button
                        onClick={() => navigate('/admin/questions')}
                        className="text-left font-semibold text-[#0B2A3D] hover:text-accent py-1 text-body-sm"
                      >
                        Ask HR Inbox
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <button
                  onClick={() => navigate('/checklist')}
                  className="w-full flex items-center justify-between bg-[#0B2A3D] hover:bg-[#13313F] text-white px-5 py-3 rounded-full font-sans font-medium text-body-sm transition-colors shadow-sm"
                >
                  <span>Checklist</span>
                  <span className="flex items-center justify-center w-6 h-6 bg-white rounded-full text-[#0B2A3D]">
                    <span className="material-symbols-outlined text-[16px] font-bold">east</span>
                  </span>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      <main className="flex-grow p-6 md:p-8 max-w-[1600px] w-full mx-auto">
        {children}
      </main>

      <Footer />
    </div>
  );
};
