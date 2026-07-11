import React, { useState, useRef, useEffect, useCallback } from 'react';
import { validateAndRestoreBackup, generateBackupExport, saveEmployee, EmployeeSchema, getAuditLog, AuditLogEntry } from '../../services/db';
import { useDb } from '../../context/DbContext';

type LogEntry = { type: 'error' | 'warning' | 'success'; message: string };

// Typed-confirmation phrase the admin must type before a restore is
// submitted -- must match server/app/routes/backup.py's
// RESTORE_CONFIRMATION_PHRASE, which rejects any other value with 400.
const RESTORE_CONFIRMATION_PHRASE = 'RESTORE';

const CSV_REQUIRED_HEADERS = ['name', 'email', 'slack_handle', 'role', 'department', 'hire_date', 'hybrid_preference'];
const CSV_TEMPLATE = `name,email,slack_handle,role,department,hire_date,hybrid_preference,buddy_id
Jordan Rivera,jordan.rivera@meridian.com,@jordan.rivera,Software Specialist,Engineering,2026-08-03,HYBRID,
`;

const parseCsv = (text: string): Record<string, string>[] => {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const cells = line.split(',').map(c => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ''; });
    return row;
  });
};

export const BackupRestore: React.FC = () => {
  const { refreshData } = useDb();
  const [dragActive, setDragActive] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validateProgress, setValidateProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // A dropped/selected backup file is held here, pending typed confirmation,
  // rather than being restored immediately (replaces the old window.confirm()
  // stopgap with a real typed-confirmation gate -- Item 5b).
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmationInput, setConfirmationInput] = useState('');

  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);

  const [csvDragActive, setCsvDragActive] = useState(false);
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [csvLogs, setCsvLogs] = useState<LogEntry[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const loadAuditLog = useCallback(async () => {
    setAuditLog(await getAuditLog());
  }, []);

  useEffect(() => {
    loadAuditLog();
  }, [loadAuditLog]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const selectPendingFile = (file: File) => {
    // Restore truncates and replaces every table -- stage the file and
    // require the admin to type the confirmation phrase below before
    // anything touches the database.
    setPendingFile(file);
    setConfirmationInput('');
    setLogs([]);
  };

  const cancelPendingRestore = () => {
    setPendingFile(null);
    setConfirmationInput('');
  };

  const confirmRestore = async () => {
    if (!pendingFile || confirmationInput !== RESTORE_CONFIRMATION_PHRASE) return;
    const file = pendingFile;

    setPendingFile(null);
    setIsValidating(true);
    setValidateProgress(10);
    setLogs([]);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      setValidateProgress(40);

      setTimeout(async () => {
        setValidateProgress(70);
        const result = await validateAndRestoreBackup(content, RESTORE_CONFIRMATION_PHRASE);
        setValidateProgress(100);

        setTimeout(() => {
          setIsValidating(false);
          if (result.success) {
            const list: typeof logs = [{ type: 'success', message: '✓ Zod Schema validation passed. Restoration complete.' }];
            result.warnings.forEach(warn => {
              list.push({ type: 'warning', message: warn });
            });
            setLogs(list);
            refreshData();
            loadAuditLog();
          } else {
            const list = result.errors.map(err => ({ type: 'error' as const, message: `❌ Schema Error: ${err}` }));
            setLogs(list);
          }
        }, 300);
      }, 400);
    };
    reader.readAsText(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      selectPendingFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      selectPendingFile(e.target.files[0]);
    }
    e.target.value = '';
  };

  const handleCsvDrag = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.type === "dragenter" || e.type === "dragover") {
      setCsvDragActive(true);
    } else if (e.type === "dragleave") {
      setCsvDragActive(false);
    }
  };

  const processCsv = async (file: File) => {
    setIsImportingCsv(true);
    setCsvLogs([]);

    const text = await file.text();
    const rows = parseCsv(text);

    if (rows.length === 0) {
      setCsvLogs([{ type: 'error', message: '❌ No data rows found. The file needs a header row plus at least one employee.' }]);
      setIsImportingCsv(false);
      return;
    }

    const missingHeaders = CSV_REQUIRED_HEADERS.filter(h => !(h in rows[0]));
    if (missingHeaders.length > 0) {
      setCsvLogs([{ type: 'error', message: `❌ Missing required column(s): ${missingHeaders.join(', ')}` }]);
      setIsImportingCsv(false);
      return;
    }

    const results: LogEntry[] = [];
    let successCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowLabel = `Row ${i + 2}`; // +2: 1-indexed, plus the header row

      const candidate = {
        id: crypto.randomUUID(),
        name: row.name,
        email: row.email,
        slackHandle: row.slack_handle,
        role: row.role || 'Software Specialist',
        department: row.department,
        hireDate: row.hire_date,
        buddyId: row.buddy_id || null,
        hybridPreference: (row.hybrid_preference || 'HYBRID').toUpperCase(),
        assignedDesk: null,
      };

      const parsed = EmployeeSchema.safeParse(candidate);
      if (!parsed.success) {
        results.push({ type: 'error', message: `❌ ${rowLabel}: ${parsed.error.issues.map(iss => iss.message).join('; ')}` });
        continue;
      }

      try {
        await saveEmployee(parsed.data);
        successCount++;
      } catch (err: any) {
        results.push({ type: 'error', message: `❌ ${rowLabel} (${row.name || row.email}): ${err.message}` });
      }
    }

    if (successCount > 0) {
      results.unshift({ type: 'success', message: `✓ Imported ${successCount} of ${rows.length} row(s) successfully.` });
      await refreshData();
    } else {
      results.unshift({ type: 'error', message: '❌ No rows imported.' });
    }

    setCsvLogs(results);
    setIsImportingCsv(false);
  };

  const handleCsvDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setCsvDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processCsv(e.dataTransfer.files[0]);
    }
  };

  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processCsv(e.target.files[0]);
    }
    e.target.value = '';
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'meridian_bulk_hire_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    try {
      const backupString = await generateBackupExport();
      const blob = new Blob([backupString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `meridian_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setLogs([{ type: 'success', message: '✓ System backup snapshot generated and downloaded successfully.' }]);
    } catch (err: any) {
      setLogs([{ type: 'error', message: `❌ Failed to generate export: ${err.message}` }]);
    }
  };

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div className="border border-border bg-surface p-6 rounded-2xl shadow-sm">
        <h2 className="text-h1 font-bold text-[#0B2A3D] mb-1">Backup & Restore</h2>
        <p className="text-body-sm text-text-muted">Manage system state, restore schemas, and resolve data gaps.</p>
      </div>

      {logs.length > 0 && (
        <div className="flex flex-col gap-2">
          {logs.map((log, idx) => (
            <div
              key={idx}
              className={`border-l-[4px] p-4 text-body-sm font-mono rounded-xl shadow-sm ${
                log.type === 'success'
                  ? 'bg-green-50/50 border-success text-success'
                  : log.type === 'warning'
                  ? 'bg-amber-50/30 border-warning text-text-primary'
                  : 'bg-red-50/40 border-danger text-danger'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined mt-[2px] text-[18px]">
                  {log.type === 'success' ? 'check_circle' : log.type === 'warning' ? 'warning' : 'error'}
                </span>
                <div>
                  <p className="font-bold uppercase mb-0.5">{log.type === 'success' ? 'Success' : log.type === 'warning' ? 'Warning' : 'Error'}</p>
                  <p className="font-sans text-[13px] leading-relaxed">{log.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="flex flex-col gap-3">
          <h3 className="text-h2 font-bold text-[#0B2A3D] border-b border-border pb-2.5">Restore Backup</h3>
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed p-8 rounded-2xl text-center cursor-pointer flex flex-col items-center justify-center min-h-[220px] transition-all shadow-sm ${
              dragActive ? 'border-accent bg-[#E9F1F3]/30' : 'border-border bg-white hover:border-accent hover:bg-slate-50'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              aria-label="Restore backup file"
              className="hidden"
            />
            <span className="material-symbols-outlined text-[48px] text-text-muted mb-4 select-none">upload_file</span>
            <p className="font-sans text-body-sm font-bold text-[#0B2A3D] uppercase tracking-wide select-none">Drag & Drop JSON</p>
            <p className="text-caption text-text-muted mt-1 select-none">or click to browse local files</p>
          </div>

          {isValidating && (
            <div className="border border-border bg-white p-4 rounded-xl flex flex-col gap-2 shadow-sm">
              <div className="flex justify-between items-center font-mono text-caption text-text-muted uppercase font-bold">
                <span>Zod schema validation</span>
                <span>{validateProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-accent h-full transition-all duration-200" style={{ width: `${validateProgress}%` }}></div>
              </div>
            </div>
          )}

          {pendingFile && (
            <div className="border border-danger/40 bg-red-50/30 p-4 rounded-xl flex flex-col gap-3 shadow-sm">
              <p className="text-body-sm text-text-primary leading-relaxed">
                <strong>{pendingFile.name}</strong> will permanently replace all employees, checklists, and schedules. This cannot be undone.
                Type <strong className="font-mono">{RESTORE_CONFIRMATION_PHRASE}</strong> below to confirm.
              </p>
              <input
                type="text"
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder={`Type "${RESTORE_CONFIRMATION_PHRASE}" to confirm`}
                aria-label="Type RESTORE to confirm"
                className="border border-border rounded-lg px-3 py-2 font-mono text-body-sm w-full"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={cancelPendingRestore}
                  className="px-4 py-2 rounded-full text-body-sm font-medium border border-border hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRestore}
                  disabled={confirmationInput !== RESTORE_CONFIRMATION_PHRASE}
                  className="px-4 py-2 rounded-full text-body-sm font-medium bg-danger text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Confirm Restore
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-h2 font-bold text-[#0B2A3D] border-b border-border pb-2.5">Generate Backup</h3>
          <div className="border border-border bg-white p-6 rounded-2xl flex flex-col justify-between h-full min-h-[220px] shadow-sm">
            <div>
              <p className="text-body-sm text-text-primary leading-relaxed mb-4">
                Export a full JSON snapshot of the local database including all employees, onboarding checklists, and scheduler configurations.
              </p>
              <ul className="font-mono text-caption text-text-muted list-disc list-inside flex flex-col gap-1.5 font-semibold">
                <li>Schema: Meridian v2.1</li>
                <li>Format: JSON file</li>
                <li>Database: PostgreSQL (via API)</li>
              </ul>
            </div>
            <button
              onClick={handleExport}
              className="w-full flex items-center justify-between bg-[#0B2A3D] hover:bg-[#13313F] text-white px-5 py-3 rounded-full font-sans font-medium text-body-sm transition-colors mt-6 shadow-sm select-none"
            >
              <span>Export JSON Snapshot</span>
              <span className="flex items-center justify-center w-5 h-5 bg-white rounded-full text-[#0B2A3D] shadow-sm">
                <span className="material-symbols-outlined text-[14px] font-bold">download</span>
              </span>
            </button>
          </div>
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex justify-between items-center border-b border-border pb-2.5">
          <h3 className="text-h2 font-bold text-[#0B2A3D]">Bulk Hire Import (CSV)</h3>
          <button
            onClick={handleDownloadTemplate}
            className="text-caption font-mono uppercase font-bold text-accent hover:underline select-none"
          >
            Download Template
          </button>
        </div>
        <p className="text-body-sm text-text-muted -mt-1">
          Columns: <code className="font-mono text-[12px] bg-slate-100 px-1 py-0.5 rounded">name, email, slack_handle, role, department, hire_date, hybrid_preference, buddy_id</code> (buddy_id is optional). Each row is validated and creates a real employee record with a seeded onboarding checklist, same as Add New Hire.
        </p>

        {csvLogs.length > 0 && (
          <div className="flex flex-col gap-2">
            {csvLogs.map((log, idx) => (
              <div
                key={idx}
                className={`border-l-[4px] p-4 text-body-sm font-mono rounded-xl shadow-sm ${
                  log.type === 'success'
                    ? 'bg-green-50/50 border-success text-success'
                    : log.type === 'warning'
                    ? 'bg-amber-50/30 border-warning text-text-primary'
                    : 'bg-red-50/40 border-danger text-danger'
                }`}
              >
                <p className="font-sans text-[13px] leading-relaxed">{log.message}</p>
              </div>
            ))}
          </div>
        )}

        <div
          onDragEnter={handleCsvDrag}
          onDragOver={handleCsvDrag}
          onDragLeave={handleCsvDrag}
          onDrop={handleCsvDrop}
          onClick={() => csvInputRef.current?.click()}
          className={`border-2 border-dashed p-8 rounded-2xl text-center cursor-pointer flex flex-col items-center justify-center min-h-[160px] transition-all shadow-sm ${
            csvDragActive ? 'border-accent bg-[#E9F1F3]/30' : 'border-border bg-white hover:border-accent hover:bg-slate-50'
          }`}
        >
          <input
            type="file"
            ref={csvInputRef}
            onChange={handleCsvFileChange}
            accept=".csv"
            className="hidden"
          />
          <span className="material-symbols-outlined text-[40px] text-text-muted mb-3 select-none">upload_file</span>
          <p className="font-sans text-body-sm font-bold text-[#0B2A3D] uppercase tracking-wide select-none">
            {isImportingCsv ? 'Importing...' : 'Drag & Drop CSV'}
          </p>
          <p className="text-caption text-text-muted mt-1 select-none">or click to browse local files</p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-h2 font-bold text-[#0B2A3D] border-b border-border pb-2.5">Restore Audit Log</h3>
        {auditLog.length === 0 ? (
          <p className="text-body-sm text-text-muted">No restores have been recorded yet.</p>
        ) : (
          <div className="border border-border bg-white rounded-2xl shadow-sm divide-y divide-border">
            {auditLog.map((entry) => (
              <div key={entry.id} className="p-4 flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="font-sans font-bold text-[#0B2A3D] text-body-sm">{entry.action}</span>
                  <span className="font-mono text-caption text-text-muted">{new Date(entry.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-caption text-text-muted">
                  By {entry.actorName || 'Unknown actor'}
                  {entry.detail && (
                    <>
                      {' -- '}
                      {Object.entries(entry.detail).map(([key, value]) => `${key}: ${value}`).join(', ')}
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
