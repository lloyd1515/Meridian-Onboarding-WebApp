import React, { useEffect, useState } from 'react';
import { getBuddyView, BuddyHireEntry } from '../../services/db';

function mailtoLink(hireName: string): string {
  const subject = encodeURIComponent(`Coffee chat with ${hireName}?`);
  const body = encodeURIComponent(
    `Hi ${hireName},\n\nWant to grab a coffee (virtual or in-person) this week to check in on how onboarding is going?\n\nLet me know what time works for you.\n`
  );
  return `mailto:?subject=${subject}&body=${body}`;
}

export const BuddyViewPage: React.FC = () => {
  const [hires, setHires] = useState<BuddyHireEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setHires(await getBuddyView());
      setIsLoading(false);
    })();
  }, []);

  return (
    <div className="w-full max-w-[900px] mx-auto flex flex-col gap-6">
      <div className="border border-border bg-surface p-6 rounded-2xl shadow-sm">
        <h2 className="text-h1 font-bold text-text-primary mb-1">My Buddy View</h2>
        <p className="text-body-lg text-text-muted">
          If you're mentoring a new hire, you'll see their onboarding progress and any tasks they're stuck on here.
        </p>
      </div>

      {isLoading ? (
        <div className="border border-border bg-surface rounded-2xl shadow-sm p-8 text-center text-text-muted font-mono text-caption uppercase select-none">
          Loading...
        </div>
      ) : hires.length === 0 ? (
        <div className="border border-border bg-surface rounded-2xl shadow-sm p-8 text-center text-text-muted font-mono text-caption uppercase select-none">
          You're not buddying for anyone right now. Check back once HR assigns you to a new hire.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {hires.map((hire) => (
            <div key={hire.employee.id} className="border border-border bg-surface rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-[#E9F1F3] border-b border-border px-6 py-3 flex justify-between items-center flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-body text-text-primary">{hire.employee.name}</h3>
                  <p className="text-caption text-text-muted">
                    {hire.employee.department} &middot; Starts {hire.employee.hireDate}
                  </p>
                </div>
                <a
                  href={mailtoLink(hire.employee.name)}
                  className="flex items-center gap-2 bg-[#0B2A3D] hover:bg-[#13313F] text-white px-4 py-2 rounded-full font-sans font-medium text-body-sm transition-colors shadow-sm"
                >
                  Schedule a coffee
                </a>
              </div>

              <div className="p-5 flex flex-col gap-3">
                <p className="text-caption font-mono uppercase text-text-muted">
                  {hire.completedTasks}/{hire.totalTasks} tasks completed
                </p>

                {hire.stuckTasks.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-mono uppercase text-red-700 font-bold tracking-wider">
                      Stuck tasks
                    </span>
                    {hire.stuckTasks.map((task) => (
                      <div
                        key={task.id}
                        className="bg-red-50 border border-danger/20 px-3 py-2 rounded-xl flex justify-between items-center gap-2"
                      >
                        <span className="text-body-sm text-text-primary">{task.title}</span>
                        <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border bg-white text-red-700 border-danger/30">
                          {task.status === 'blocked' ? 'Blocked' : 'Overdue'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-body-sm text-text-muted">No stuck tasks right now &mdash; things look on track.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BuddyViewPage;
