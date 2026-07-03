import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { guideSectionsForDepartment } from '../../data/companyGuide';

export const CompanyGuidePage: React.FC = () => {
  const { currentUser } = useAuth();
  const sections = guideSectionsForDepartment(currentUser?.department);

  return (
    <div className="w-full max-w-[900px] mx-auto flex flex-col gap-6">
      <div className="border border-border bg-surface p-6 rounded-2xl shadow-sm">
        <h2 className="text-h1 font-bold text-text-primary mb-1">Company Guide</h2>
        <p className="text-body-lg text-text-muted">
          Answers to the things you're most likely wondering{currentUser?.department ? ` as a new ${currentUser.department} hire` : ''} -- first-day logistics, IT setup, hybrid policy, and how we use Slack and Google Meet.
        </p>
      </div>

      {sections.map(section => (
        <div key={section.id} className="border border-border bg-surface rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-[#E9F1F3] border-b border-border px-6 py-3">
            <h3 className="font-mono text-caption uppercase tracking-wider font-bold text-[#0B2A3D]">{section.title}</h3>
          </div>
          <div className="flex flex-col divide-y divide-border">
            {section.entries.map(entry => (
              <div key={entry.id} className="p-5 flex flex-col gap-1.5">
                <h4 className="font-bold text-body text-text-primary">{entry.question}</h4>
                <p className="text-body-sm text-text-muted leading-relaxed">{entry.answer}</p>
                {entry.departments && (
                  <span className="mt-1 self-start text-[9px] font-mono uppercase tracking-wider text-accent border border-accent/20 bg-accent/5 px-1.5 py-0.5 rounded">
                    {entry.departments.join(', ')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CompanyGuidePage;
