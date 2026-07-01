import React, { useState, useRef } from 'react';
import { validateAndRestoreBackup, generateBackupExport } from '../../services/db';
import { useDb } from '../../context/DbContext';

export const BackupRestore: React.FC = () => {
  const { refreshData } = useDb();
  const [dragActive, setDragActive] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validateProgress, setValidateProgress] = useState(0);
  const [logs, setLogs] = useState<{ type: 'error' | 'warning' | 'success'; message: string }[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processJson = async (file: File) => {
    setIsValidating(true);
    setValidateProgress(10);
    setLogs([]);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      setValidateProgress(40);
      
      setTimeout(async () => {
        setValidateProgress(70);
        const result = await validateAndRestoreBackup(content);
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
      await processJson(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processJson(e.target.files[0]);
    }
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
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-h2 font-bold text-[#0B2A3D] border-b border-border pb-2.5">Generate Backup</h3>
          <div className="border border-border bg-white p-6 rounded-2xl flex flex-col justify-between h-full min-h-[220px] shadow-sm">
            <div>
              <p className="text-body-sm text-text-primary leading-relaxed mb-4">
                Export a full JSON snapshot of the local database including all employees, onboarding checklists, and scheduler configurations.
              </p>
              <ul className="font-mono text-caption text-text-muted list-disc list-inside flex flex-col gap-1.5 font-semibold">
                <li>Schema: Pathway v2.1</li>
                <li>Format: JSON file</li>
                <li>Database: IndexedDB localForage</li>
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
    </div>
  );
};
