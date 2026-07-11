import React, { useEffect, useState } from 'react';
import { useDb } from '../../context/DbContext';
import { useAuth } from '../../context/AuthContext';
import { Employee, isNewHire } from '../../services/db';
import { OFFICE_CAPACITY, OFFICE_CAPACITY_WARNING, MAX_OFFICE_DAYS_PER_WEEK } from '../../constants/scheduling';

interface ScheduledEmployee extends Employee {
  isNewHire: boolean;
  hasBuddyOverlap: boolean;
  isBuddyRemote: boolean;
}

export const HybridScheduler: React.FC = () => {
  const { employees, scheduler, updateScheduler } = useDb();
  const { simulationDate } = useAuth();

  const [columns, setColumns] = useState<Record<string, string[]>>({
    '0': [], '1': [], '2': [], '3': [], '4': []
  });
  
  const [draggedEmpId, setDraggedEmpId] = useState<string | null>(null);
  const [sourceColIdx, setSourceColIdx] = useState<string | null>(null);

  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [buddyWarnings, setBuddyWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (scheduler && !isDirty) {
      setColumns(scheduler);
    }
  }, [scheduler]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Keyboard alternative to native HTML5 drag-and-drop: focus an employee
  // card, press Enter/Space to "pick it up" (reuses the same draggedEmpId /
  // sourceColIdx state the mouse path already sets in onDragStart), then
  // focus a day column or the unassigned pool and press Enter/Space to
  // "drop" it there via the existing handleDrop / handleDropUnassigned
  // logic. Escape cancels a pending pick-up.
  const pickUpEmployee = (empId: string, fromColIdx: string | null) => {
    if (draggedEmpId === empId) {
      // Pressing Enter again on the already-picked-up card cancels it.
      setDraggedEmpId(null);
      setSourceColIdx(null);
      return;
    }
    setDraggedEmpId(empId);
    setSourceColIdx(fromColIdx);
  };

  const handleCardKeyDown = (e: React.KeyboardEvent, empId: string, fromColIdx: string | null) => {
    // Stop propagation so this doesn't also trigger the parent cell's
    // onKeyDown (which would otherwise fire a drop using stale state, since
    // this handler's setDraggedEmpId hasn't applied yet within the same
    // bubble phase).
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      pickUpEmployee(empId, fromColIdx);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setDraggedEmpId(null);
      setSourceColIdx(null);
    }
  };

  const handleCellKeyDown = (e: React.KeyboardEvent, colIdx: string | null) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (!draggedEmpId) return;
      e.preventDefault();
      if (colIdx === null) {
        handleDropUnassigned();
      } else {
        handleDrop(colIdx);
      }
    } else if (e.key === 'Escape') {
      setDraggedEmpId(null);
      setSourceColIdx(null);
    }
  };

  const handleDrop = (colIdx: string) => {
    if (!draggedEmpId) return;

    const targetList = [...(columns[colIdx] || [])];
    if (targetList.includes(draggedEmpId)) return; // Avoid duplicate placement on same day

    // Limit to max 3 office days per week
    const scheduledDaysCount = Object.keys(columns).reduce((count, key) => {
      if (key === sourceColIdx) return count;
      const dayEmps = columns[key] || [];
      if (dayEmps.includes(draggedEmpId)) {
        return count + 1;
      }
      return count;
    }, 0);

    if (scheduledDaysCount >= MAX_OFFICE_DAYS_PER_WEEK) {
      alert(`🔒 Strict limit reached: This employee is already scheduled for ${MAX_OFFICE_DAYS_PER_WEEK} office days this week.`);
      return;
    }

    if (targetList.length + 1 > OFFICE_CAPACITY) {
      alert(`🔒 Capacity limit reached! The office cannot exceed ${OFFICE_CAPACITY} employees on any single day.`);
      return;
    }

    const updatedCols = { ...columns };

    if (sourceColIdx !== null) {
      updatedCols[sourceColIdx] = (updatedCols[sourceColIdx] || []).filter(id => id !== draggedEmpId);
    }

    updatedCols[colIdx] = [...targetList, draggedEmpId];

    setColumns(updatedCols);
    setIsDirty(true);
    setSaveStatus(null);

    setDraggedEmpId(null);
    setSourceColIdx(null);
  };

  const handleDropUnassigned = () => {
    if (!draggedEmpId) return;
    if (sourceColIdx !== null) {
      const updatedCols = { ...columns };
      updatedCols[sourceColIdx] = (updatedCols[sourceColIdx] || []).filter(id => id !== draggedEmpId);
      setColumns(updatedCols);
      setIsDirty(true);
      setSaveStatus(null);
    }
    setDraggedEmpId(null);
    setSourceColIdx(null);
  };

  const handleSaveChanges = async () => {
    // Buddy co-presence validation
    const warnings: string[] = [];
    employees.forEach(emp => {
      if (emp.buddyId) {
        const empOfficeDays = Object.keys(columns).filter(day => (columns[day] || []).includes(emp.id));
        if (empOfficeDays.length > 0) {
          const buddyOfficeDays = Object.keys(columns).filter(day => (columns[day] || []).includes(emp.buddyId!));
          const overlap = empOfficeDays.filter(day => buddyOfficeDays.includes(day));
          if (overlap.length === 0) {
            const buddyEmp = employees.find(b => b.id === emp.buddyId);
            warnings.push(`⚠️ Buddy Co-presence Warning: ${emp.name} has no overlapping office days with Buddy (${buddyEmp?.name || 'Buddy'}).`);
          }
        }
      }
    });

    setBuddyWarnings(warnings);

    try {
      await updateScheduler(columns);
      setIsDirty(false);
      setSaveStatus("✅ Schedule saved successfully!");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (e: any) {
      setSaveStatus(`❌ Save failed: ${e.message || e}`);
    }
  };

  const handleDiscardChanges = () => {
    if (scheduler) {
      setColumns(scheduler);
    }
    setIsDirty(false);
    setBuddyWarnings([]);
    setSaveStatus(null);
  };

  const getScheduledDetails = (empId: string, colIdx: string): ScheduledEmployee | null => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return null;

    const isNew = isNewHire(emp, simulationDate);
    let hasBuddyOverlap = false;
    let isBuddyRemote = false;

    if (isNew && emp.buddyId) {
      const buddyScheduledToday = (columns[colIdx] || []).includes(emp.buddyId);
      if (buddyScheduledToday) {
        hasBuddyOverlap = true;
      } else {
        isBuddyRemote = true;
      }
    }

    return {
      ...emp,
      isNewHire: isNew,
      hasBuddyOverlap,
      isBuddyRemote,
    };
  };

  const days = [
    { label: 'MON', desc: 'Monday' },
    { label: 'TUE', desc: 'Tuesday' },
    { label: 'WED', desc: 'Wednesday' },
    { label: 'THU', desc: 'Thursday' },
    { label: 'FRI', desc: 'Friday' }
  ];

  const scheduledEmpIds = new Set<string>();
  Object.values(columns).forEach(list => {
    (list || []).forEach(id => scheduledEmpIds.add(id));
  });
  
  const unassignedEmployees = employees.filter(emp => !scheduledEmpIds.has(emp.id));

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div className="border border-border bg-surface p-6 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-h1 font-bold text-[#0B2A3D] mb-1">Team Hybrid Scheduler</h2>
          <p className="text-body-sm text-text-muted">
            Drag and drop employees to schedule office presence days and monitor physical capacity.
          </p>
          <p className="text-caption text-text-muted mt-1">
            Keyboard: Tab to an employee card and press Enter/Space to pick it up, then Tab to a day column (or the Unassigned Pool) and press Enter/Space to place it there. Press Escape to cancel.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isDirty && (
            <span className="font-mono text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full border border-amber-300 font-bold animate-pulse">
              ● Unsaved Changes
            </span>
          )}
          <button
            type="button"
            onClick={handleDiscardChanges}
            disabled={!isDirty}
            className={`px-4 py-2 text-xs font-medium font-sans border rounded-full transition-colors cursor-pointer ${
              isDirty 
                ? 'border-border text-text-primary hover:bg-slate-100' 
                : 'border-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleSaveChanges}
            disabled={!isDirty}
            className={`flex items-center gap-2 px-5 py-2 text-xs font-medium font-sans rounded-full shadow-sm transition-colors cursor-pointer ${
              isDirty 
                ? 'bg-[#0B2A3D] hover:bg-[#13313F] text-white' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <span>Save Changes</span>
            <span className="material-symbols-outlined text-[16px]">save</span>
          </button>
        </div>
      </div>

      {saveStatus && (
        <div className="p-3.5 bg-slate-50 border border-border text-text-primary rounded-xl font-mono text-xs shadow-sm">
          {saveStatus}
        </div>
      )}

      {buddyWarnings.length > 0 && (
        <div className="flex flex-col gap-1 p-4 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl font-mono text-xs shadow-sm">
          {buddyWarnings.map((w, idx) => (
            <span key={idx}>{w}</span>
          ))}
        </div>
      )}


      <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
        <div
          onDragOver={handleDragOver}
          onDrop={handleDropUnassigned}
          tabIndex={0}
          role="button"
          aria-label={`Unassigned pool, ${unassignedEmployees.length} employees. ${draggedEmpId ? 'Press Enter to place the picked-up employee here.' : ''}`}
          onKeyDown={(e) => handleCellKeyDown(e, null)}
          className="border border-border bg-[#F8FAFC] p-4 rounded-2xl flex flex-col gap-3 min-h-[520px] max-h-[650px] lg:col-span-1 shadow-sm transition-all duration-200 hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <div className="border-b border-border pb-2.5">
            <h3 className="font-bold text-[#0B2A3D] text-body uppercase tracking-wider">Unassigned Pool</h3>
            <span className="font-mono text-[10px] text-text-muted mt-1 block font-bold">{unassignedEmployees.length} EMPLOYEES</span>
          </div>

          <div className="flex-grow flex flex-col gap-2 overflow-y-auto pr-1">
            {unassignedEmployees.map(emp => {
              const isNew = isNewHire(emp, simulationDate);
              const isPickedUp = draggedEmpId === emp.id;
              return (
                <div
                  key={emp.id}
                  draggable
                  onDragStart={(e) => {
                    setDraggedEmpId(emp.id);
                    setSourceColIdx(null);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isPickedUp}
                  aria-label={`${emp.name}, ${emp.role}, unassigned. ${isPickedUp ? 'Picked up — press Enter to cancel.' : 'Press Enter to pick up.'}`}
                  onKeyDown={(e) => handleCardKeyDown(e, emp.id, null)}
                  className={`border p-3 cursor-move bg-white rounded-xl flex flex-col gap-1.5 transition-all hover:bg-slate-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent ${
                    isNew ? 'border-accent bg-[#E9F1F3]' : 'border-border'
                  } ${isPickedUp ? 'ring-2 ring-accent' : ''}`}
                >
                  <div className="flex justify-between items-start gap-1">
                    <span className="font-bold text-body-sm text-[#0B2A3D] truncate">{emp.name}</span>
                    {isNew && (
                      <span className="text-[8px] font-mono border border-accent text-accent px-1 font-bold bg-white rounded uppercase tracking-wider shrink-0">NEW</span>
                    )}
                  </div>
                  <span className="text-caption text-text-muted font-mono leading-none truncate">{emp.role}</span>
                </div>
              );
            })}

            {unassignedEmployees.length === 0 && (
              <div className="flex-grow border border-dashed border-border rounded-xl flex items-center justify-center p-6 select-none bg-slate-50/30">
                <span className="text-caption text-text-muted font-mono text-center font-bold tracking-wider">ALL ASSIGNED</span>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 grid grid-cols-1 md:grid-cols-5 gap-4">
          {days.map((day, idx) => {
            const colIdx = idx.toString();
            const empIds = columns[colIdx] || [];
            
            const totalOccupancy = empIds.length;
            const isAtLimit = totalOccupancy >= OFFICE_CAPACITY_WARNING;

            return (
              <div
                key={day.label}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(colIdx)}
                tabIndex={0}
                role="button"
                aria-label={`${day.desc}, ${totalOccupancy} of ${OFFICE_CAPACITY} scheduled.${isAtLimit ? ' Capacity threshold reached.' : ''} ${draggedEmpId ? 'Press Enter to place the picked-up employee here.' : ''}`}
                onKeyDown={(e) => handleCellKeyDown(e, colIdx)}
                className="border border-border bg-surface p-4 rounded-2xl min-h-[520px] flex flex-col gap-3.5 transition-all duration-200 hover:border-accent shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {/* Day Header */}
                <div className="border-b border-border pb-2.5 select-none">
                  <h3 className="font-bold text-h2 leading-none text-[#0B2A3D]">{day.label}</h3>
                  <span className="font-mono text-caption text-text-muted mt-1 block font-semibold">{day.desc}</span>
                </div>

                {/* Occupancy Counters */}
                <div className="flex flex-col gap-1 select-none">
                  <span className={`font-mono text-caption uppercase font-bold ${isAtLimit ? 'text-danger' : 'text-text-primary'}`}>
                    Occupancy: {totalOccupancy}/{OFFICE_CAPACITY} seats
                  </span>
                  
                  {isAtLimit && (
                    <div className="border-l-4 border-danger bg-red-50 text-danger text-[10px] p-2.5 font-mono rounded mt-1 leading-tight font-bold">
                      ⚠️ ALERT: Capacity threshold reached.
                    </div>
                  )}
                </div>

                <div className="flex-grow flex flex-col gap-2.5 mt-1">
                  {empIds.map(empId => {
                    const details = getScheduledDetails(empId, colIdx);
                    if (!details) return null;

                    const isPickedUp = draggedEmpId === empId;
                    const overlapNote = details.hasBuddyOverlap
                      ? ' Buddy overlap.'
                      : details.isBuddyRemote
                      ? ' No buddy overlap.'
                      : '';

                    return (
                      <div
                        key={empId}
                        draggable
                        onDragStart={(e) => {
                          setDraggedEmpId(empId);
                          setSourceColIdx(colIdx);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        tabIndex={0}
                        role="button"
                        aria-pressed={isPickedUp}
                        aria-label={`${details.name}, ${details.role}, scheduled on ${day.desc}.${overlapNote} ${isPickedUp ? 'Picked up — press Enter to cancel.' : 'Press Enter to pick up.'}`}
                        onKeyDown={(e) => handleCardKeyDown(e, empId, colIdx)}
                        className={`border p-3 cursor-move bg-white rounded-xl flex flex-col gap-2 transition-all hover:bg-slate-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent ${
                          details.isNewHire ? 'border-accent bg-[#E9F1F3]' : 'border-border'
                        } ${isPickedUp ? 'ring-2 ring-accent' : ''}`}
                      >
                        <div className="flex justify-between items-start gap-1">
                          <span className="font-bold text-body-sm text-[#0B2A3D] truncate">{details.name}</span>
                          {details.isNewHire && (
                            <span className="text-[8px] font-mono border border-accent text-accent px-1 font-bold bg-white rounded uppercase tracking-wider shrink-0">NEW</span>
                          )}
                        </div>
                        <span className="text-caption text-text-muted font-mono leading-none truncate">{details.role}</span>

                        {details.hasBuddyOverlap && (
                          <span className="font-mono text-[9px] bg-success text-white px-2 py-0.5 w-fit rounded font-bold uppercase tracking-wider">
                            ✓ OVERLAP
                          </span>
                        )}
                        {details.isBuddyRemote && (
                          <span className="font-mono text-[9px] border border-warning/45 bg-yellow-50/50 text-warning px-2 py-0.5 w-fit rounded font-bold uppercase tracking-wider">
                            NO OVERLAP
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {empIds.length === 0 && (
                    <div className="flex-grow border border-dashed border-border rounded-xl flex items-center justify-center p-6 select-none bg-slate-50/30 hover:bg-slate-50 transition-colors">
                      <span className="text-caption text-text-muted font-mono text-center font-bold tracking-wider">DRAG HERE</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};
