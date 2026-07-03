import React from 'react';
import { useNavigate } from 'react-router-dom';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const navigate = useNavigate();

  return (
    <footer className="w-full bg-[#0B1E2B] text-white py-12 md:py-16 px-6 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col gap-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          <div className="flex flex-col gap-3">
            <span className="font-sans font-bold text-h2 tracking-tight text-white select-none">
              Meridian
            </span>
            <p className="text-body-sm text-white/60 max-w-sm">
              The onboarding hub for new Meridian hires -- your checklist, your buddy, your hybrid schedule, and everything else for your first month.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="font-mono text-caption uppercase tracking-wider text-white/50">
              Get Started
            </h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <button onClick={() => navigate('/dashboard')} className="text-body-sm text-white/75 hover:text-accent transition-colors text-left">
                  My Week
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/checklist')} className="text-body-sm text-white/75 hover:text-accent transition-colors text-left">
                  Onboarding Checklist
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/guide')} className="text-body-sm text-white/75 hover:text-accent transition-colors text-left">
                  Company Guide
                </button>
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="font-mono text-caption uppercase tracking-wider text-white/50">
              Need Help?
            </h4>
            <ul className="flex flex-col gap-2.5 text-body-sm text-white/75">
              <li>Slack: #it-helpdesk for device issues</li>
              <li>Ask your buddy or HR for anything else</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-caption text-white/50">
            &copy; {currentYear} Meridian.
          </p>
        </div>
      </div>
    </footer>
  );
};
