import React, { useState } from 'react';
import { Employee } from '../../services/db';

interface RelationshipExplorerProps {
  currentUser: Employee | null;
  employees: Employee[];
}

export const RelationshipExplorer: React.FC<RelationshipExplorerProps> = ({
  currentUser,
  employees,
}) => {
  const [selectedPerson, setSelectedPerson] = useState<Employee | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  if (!currentUser) return null;

  const teammates = employees.filter(
    emp => emp.department === currentUser.department && emp.id !== currentUser.id && emp.id !== 'emp-admin'
  ).slice(0, 4);

  const buddy = employees.find(emp => emp.id === currentUser.buddyId) || null;

  const deptHead = employees.find(
    emp => emp.department === currentUser.department && (emp.role.includes('VP') || emp.role.includes('Director') || emp.role.includes('Manager'))
  ) || null;

  const hrContact = employees.find(emp => emp.id === 'emp-admin') || null;

  const handleCopySlackTemplate = (person: Employee, type: 'coffee' | 'question' | 'intro') => {
    let template = '';
    if (type === 'coffee') {
      template = `Hi ${person.name.split(' ')[0]}! Want to grab a virtual or in-office coffee this week to get to know each other?`;
    } else if (type === 'question') {
      template = `Hi ${person.name.split(' ')[0]}! Could I ask you a quick project question whenever you have 5 minutes free? Thanks!`;
    } else if (type === 'intro') {
      template = `Hi there! My name is ${currentUser.name} and I recently joined the team as ${currentUser.role}. Nice to meet you!`;
    }

    navigator.clipboard.writeText(template);
    setCopiedText(`${person.id}-${type}`);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="border border-border bg-surface p-6 rounded-2xl text-text-primary shadow-sm">
      <div className="flex flex-col gap-6">
        <div className="border-b border-border pb-3">
          <h3 className="font-sans text-h3 font-bold text-text-primary">🌳 My Relationships & Team (Org Chart Explorer)</h3>
          <p className="text-body-sm text-text-muted mt-1">
            Visualize your key connections at Meridian and access quick contact shortcuts.
          </p>
        </div>

        <div className="flex flex-col gap-6 items-center py-4 bg-surface-muted/30 border border-border rounded-xl relative">
          
          {deptHead && (
            <div className="flex flex-col items-center">
              <div 
                onClick={() => setSelectedPerson(deptHead)}
                className="cursor-pointer border border-border bg-surface px-4 py-2 text-center rounded-xl hover:border-accent transition-colors w-[220px] shadow-sm"
              >
                <span className="text-[9px] font-mono border border-accent/20 px-1 py-0.5 text-accent uppercase bg-accent/5 rounded">Direct Manager / Head</span>
                <h4 className="font-sans font-bold text-body-sm mt-1 text-text-primary">{deptHead.name}</h4>
                <p className="text-[10px] text-text-muted truncate font-sans">{deptHead.role}</p>
              </div>
              <div className="w-[1px] h-6 bg-border"></div>
            </div>
          )}

          <div className="flex gap-12 justify-center items-center w-full max-w-[560px]">
            
            {buddy && (
              <div 
                onClick={() => setSelectedPerson(buddy)}
                className="cursor-pointer border border-border bg-surface px-4 py-2 text-center rounded-xl hover:border-accent transition-colors w-[180px] shadow-sm"
              >
                <span className="text-[9px] font-mono border border-accent/20 px-1 py-0.5 text-accent uppercase bg-accent/5 rounded">Assigned Tech Buddy</span>
                <h4 className="font-sans font-bold text-body-sm mt-1 text-text-primary">{buddy.name}</h4>
                <p className="text-[10px] text-text-muted truncate font-sans">{buddy.role}</p>
              </div>
            )}

            <div className="border-[2px] border-success bg-success/5 px-4 py-2 text-center rounded-xl w-[180px] shadow-md ring-1 ring-success/20">
              <span className="text-[9px] font-mono text-success uppercase tracking-wider font-bold">You (New Hire)</span>
              <h4 className="font-sans font-bold text-body-sm mt-1 text-text-primary">{currentUser.name}</h4>
              <p className="text-[10px] text-success font-mono truncate">{currentUser.role}</p>
            </div>

            {hrContact && (
              <div 
                onClick={() => setSelectedPerson(hrContact)}
                className="cursor-pointer border border-border bg-surface px-4 py-2 text-center rounded-xl hover:border-accent transition-colors w-[180px] shadow-sm"
              >
                <span className="text-[9px] font-mono border border-accent/20 px-1 py-0.5 text-accent uppercase bg-accent/5 rounded">HR Specialist</span>
                <h4 className="font-sans font-bold text-body-sm mt-1 text-text-primary">{hrContact.name}</h4>
                <p className="text-[10px] text-text-muted truncate font-sans">{hrContact.role}</p>
              </div>
            )}

          </div>

          <div className="w-[1px] h-6 bg-border"></div>

          <div className="flex flex-col items-center">
            <span className="text-[9px] font-mono text-text-muted uppercase tracking-widest mb-2">Department Colleagues ({currentUser.department})</span>
            <div className="flex flex-wrap gap-3 justify-center">
              {teammates.map(emp => (
                <div 
                  key={emp.id}
                  onClick={() => setSelectedPerson(emp)}
                  className="cursor-pointer border border-border bg-surface px-3 py-1.5 text-center rounded-xl hover:border-text-primary transition-colors w-[130px] shadow-sm"
                >
                  <h5 className="font-sans font-bold text-[11px] text-text-primary truncate">{emp.name}</h5>
                  <p className="text-[9px] text-text-muted truncate font-sans">{emp.role}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {selectedPerson && (
          <div className="border border-border bg-surface-muted p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fadeIn">
            <div>
              <h4 className="font-sans font-bold text-text-primary text-body">
                📞 Contact {selectedPerson.name}
              </h4>
              <p className="text-body-sm text-text-muted mt-1">
                Role: {selectedPerson.role} | Email: <span className="text-text-primary font-mono select-all bg-surface px-1.5 py-0.5 border border-border rounded">{selectedPerson.email}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleCopySlackTemplate(selectedPerson, 'coffee')}
                className="inline-flex items-center justify-between gap-2 px-3 py-1.5 border border-[#0B2A3D] text-[#0B2A3D] hover:bg-neutral-100 rounded-full transition-all text-caption font-semibold"
              >
                <span>{copiedText === `${selectedPerson.id}-coffee` ? 'Copied!' : '☕ Invite for Coffee'}</span>
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-[#0B2A3D] text-white">
                  <span className="material-symbols-outlined text-[10px]">
                    {copiedText === `${selectedPerson.id}-coffee` ? 'check' : 'arrow_forward'}
                  </span>
                </span>
              </button>
              <button
                onClick={() => handleCopySlackTemplate(selectedPerson, 'question')}
                className="inline-flex items-center justify-between gap-2 px-3 py-1.5 border border-[#0B2A3D] text-[#0B2A3D] hover:bg-neutral-100 rounded-full transition-all text-caption font-semibold"
              >
                <span>{copiedText === `${selectedPerson.id}-question` ? 'Copied!' : '❓ Ask a Question'}</span>
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-[#0B2A3D] text-white">
                  <span className="material-symbols-outlined text-[10px]">
                    {copiedText === `${selectedPerson.id}-question` ? 'check' : 'arrow_forward'}
                  </span>
                </span>
              </button>
              <button
                onClick={() => handleCopySlackTemplate(selectedPerson, 'intro')}
                className="inline-flex items-center justify-between gap-2 px-3 py-1.5 border border-[#0B2A3D] text-[#0B2A3D] hover:bg-neutral-100 rounded-full transition-all text-caption font-semibold"
              >
                <span>{copiedText === `${selectedPerson.id}-intro` ? 'Copied!' : '👋 Introduce Yourself'}</span>
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-[#0B2A3D] text-white">
                  <span className="material-symbols-outlined text-[10px]">
                    {copiedText === `${selectedPerson.id}-intro` ? 'check' : 'arrow_forward'}
                  </span>
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
