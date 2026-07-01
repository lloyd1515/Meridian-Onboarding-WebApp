import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme, ThemeType } from '../../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { saveEmployee, getEmployees, EmployeeSchema } from '../../services/db';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { theme, setTheme } = useTheme();
  const [email, setEmail] = useState('jane.doe@meridian.com');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');
  const [variant, setVariant] = useState<'split' | 'centered' | 'editorial'>('split');
  const [preboardingToggle, setPreboardingToggle] = useState(false);
  const navigate = useNavigate();

  const [isSignup, setIsSignup] = useState(false);
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupSlackHandle, setSignupSlackHandle] = useState('');
  const [signupRole, setSignupRole] = useState('');
  const [signupDepartment, setSignupDepartment] = useState('Engineering');
  const [signupHybridPreference, setSignupHybridPreference] = useState('HIBRID');
  const [signupHireDate, setSignupHireDate] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.endsWith('@meridian.com')) {
      setError('Email must end with @meridian.com');
      return;
    }
    const success = await login(email);
    if (success) {
      if (email.includes('admin') || email === 'vlad.hr@meridian.com') {
        navigate('/admin/directory');
      } else {
        navigate('/dashboard');
      }
    } else {
      setError("Authentication failed: Email address not registered.");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const newEmployee = {
      id: 'emp-' + Date.now(),
      name: signupName,
      email: signupEmail,
      slackHandle: signupSlackHandle,
      role: signupRole,
      department: signupDepartment,
      hybridPreference: signupHybridPreference as 'BIROU' | 'REMOTE' | 'HIBRID',
      hireDate: signupHireDate,
      buddyId: 'emp-buddy',
      assignedDesk: null,
    };

    const validationResult = EmployeeSchema.safeParse(newEmployee);
    if (!validationResult.success) {
      const formattedErrors = validationResult.error.errors.map(err => err.message).join(' | ');
      setError(`Validation failed: ${formattedErrors}`);
      return;
    }

    try {
      const employees = await getEmployees();
      const isTaken = employees.some(
        emp => emp.email.toLowerCase() === signupEmail.toLowerCase()
      );
      if (isTaken) {
        setError("Email address already registered.");
        return;
      }

      await saveEmployee(newEmployee);

      const success = await login(signupEmail);
      if (success) {
        navigate('/dashboard');
      } else {
        setError("Account created, but automatic sign-in failed.");
      }
    } catch (err: any) {
      setError(`Signup failed: ${err.message || err}`);
    }
  };

  const renderSelectors = () => (
    <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
      <div className="bg-surface border border-border p-2.5 flex flex-wrap items-center gap-1.5 rounded-xl shadow-sm select-none font-mono text-[10px]">
        <span className="text-text-muted uppercase font-bold mr-1">Theme:</span>
        {([
          'meridian-light',
          'meridian-slate-dark',
          'meridian-obsidian-dark',
          'meridian-teal-dark',
          'meridian-steel-dark',
          'meridian-bronze-dark'
        ] as ThemeType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTheme(t)}
            className={`px-2 py-1 uppercase border rounded transition-colors ${
              theme === t 
                ? 'bg-[#0B2A3D] text-white border-[#0B2A3D] font-bold' 
                : 'bg-white border-border hover:bg-slate-50 text-text-primary'
            }`}
          >
            {t.replace('meridian-', '')}
          </button>
        ))}
      </div>
      <div className="bg-surface border border-border p-2.5 flex items-center gap-1.5 rounded-xl shadow-sm select-none font-mono text-[10px] self-end">
        <span className="text-text-muted uppercase font-bold mr-1">Style:</span>
        {(['split', 'centered', 'editorial'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setVariant(v)}
            className={`px-2 py-1 uppercase border rounded transition-colors ${
              variant === v 
                ? 'bg-[#0B2A3D] text-white border-[#0B2A3D] font-bold' 
                : 'bg-white border-border hover:bg-slate-50 text-text-primary'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );

  const renderForm = () => (
    <div className="w-full max-w-[400px] font-sans">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 bg-gradient-to-br from-[#2BC4D9] to-[#F2994A] rotate-45 transform rounded-sm shadow-sm" />
          <span className="font-bold text-xl tracking-tight">
            <span className="text-[#0B2A3D]">Qu</span>
            <span className="text-accent">biz</span>
          </span>
        </div>
        <h2 className="text-h2 font-bold text-[#0B2A3D] mb-2">
          {isSignup ? 'Sign Up' : 'Sign In'}
        </h2>
        <p className="text-body-sm text-text-muted">
          {isSignup ? 'Create your corporate account to get started.' : 'Enter your corporate credentials to continue.'}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-danger text-danger text-body-sm p-3 mb-4 rounded-xl font-mono">
          {error}
        </div>
      )}

      {!isSignup ? (
        <>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-caption text-text-primary uppercase font-bold" htmlFor="email">
                Corporate Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@meridian.com"
                className="border border-border bg-white text-text-primary px-3 py-2.5 rounded-xl focus:outline-none focus:border-accent text-body transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="font-mono text-caption text-text-primary uppercase font-bold" htmlFor="password">
                  Password
                </label>
                <a href="#" className="font-mono text-caption text-text-muted hover:text-text-primary transition-colors">
                  Forgot?
                </a>
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="border border-border bg-white text-text-primary px-3 py-2.5 rounded-xl focus:outline-none focus:border-accent text-body transition-colors"
              />
            </div>

            <div className="border border-border p-3.5 bg-slate-50 rounded-xl flex flex-col gap-2 transition-all">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={preboardingToggle}
                  onChange={(e) => setPreboardingToggle(e.target.checked)}
                  className="w-4 h-4 accent-[#0B2A3D] rounded cursor-pointer"
                />
                <span className="font-mono text-caption uppercase text-text-primary font-bold">Simulate Pre-boarding Mode</span>
              </label>
              {preboardingToggle && (
                <p className="text-[11px] text-text-muted font-mono leading-tight">
                  ℹ️ Forces the simulator to access pre-boarding flows (Locked settings & directory) by using a simulation date prior to the start date.
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-between bg-[#0B2A3D] hover:bg-[#13313F] text-white px-6 py-3.5 rounded-full font-sans font-medium text-body transition-colors mt-6 shadow-sm cursor-pointer"
            >
              <span>Authenticate</span>
              <span className="flex items-center justify-center w-6 h-6 bg-white rounded-full text-[#0B2A3D] shadow-sm">
                <span className="material-symbols-outlined text-[14px] font-bold">arrow_forward</span>
              </span>
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignup(true);
                setError('');
              }}
              className="font-mono text-caption text-[#0B2A3D] hover:text-accent font-bold transition-colors cursor-pointer"
            >
              Don't have an account? Sign Up
            </button>
          </div>
        </>
      ) : (
        <>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-caption text-text-primary uppercase font-bold" htmlFor="signupName">
                Name
              </label>
              <input
                id="signupName"
                type="text"
                required
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                placeholder="John Doe"
                className="border border-border bg-white text-text-primary px-3 py-2.5 rounded-xl focus:outline-none focus:border-accent text-body transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-caption text-text-primary uppercase font-bold" htmlFor="signupEmail">
                Email Address
              </label>
              <input
                id="signupEmail"
                type="email"
                required
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                placeholder="user@meridian.com"
                className="border border-border bg-white text-text-primary px-3 py-2.5 rounded-xl focus:outline-none focus:border-accent text-body transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-caption text-text-primary uppercase font-bold" htmlFor="signupSlackHandle">
                  Slack Handle
                </label>
                <input
                  id="signupSlackHandle"
                  type="text"
                  required
                  value={signupSlackHandle}
                  onChange={(e) => setSignupSlackHandle(e.target.value)}
                  placeholder="@handle"
                  className="border border-border bg-white text-text-primary px-3 py-2.5 rounded-xl focus:outline-none focus:border-accent text-body transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-caption text-text-primary uppercase font-bold" htmlFor="signupRole">
                  Role
                </label>
                <input
                  id="signupRole"
                  type="text"
                  required
                  value={signupRole}
                  onChange={(e) => setSignupRole(e.target.value)}
                  placeholder="Software Specialist"
                  className="border border-border bg-white text-text-primary px-3 py-2.5 rounded-xl focus:outline-none focus:border-accent text-body transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-caption text-text-primary uppercase font-bold" htmlFor="signupDepartment">
                  Department
                </label>
                <select
                  id="signupDepartment"
                  value={signupDepartment}
                  onChange={(e) => setSignupDepartment(e.target.value)}
                  className="border border-border bg-white text-text-primary px-3 py-2.5 rounded-xl focus:outline-none focus:border-accent text-body transition-colors"
                >
                  <option value="Engineering">Engineering</option>
                  <option value="Sales">Sales</option>
                  <option value="Marketing">Marketing</option>
                  <option value="HR">HR</option>
                  <option value="Finance">Finance</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-caption text-text-primary uppercase font-bold" htmlFor="signupHybridPreference">
                  Hybrid Preference
                </label>
                <select
                  id="signupHybridPreference"
                  value={signupHybridPreference}
                  onChange={(e) => setSignupHybridPreference(e.target.value)}
                  className="border border-border bg-white text-text-primary px-3 py-2.5 rounded-xl focus:outline-none focus:border-accent text-body transition-colors"
                >
                  <option value="HIBRID">HIBRID</option>
                  <option value="BIROU">BIROU</option>
                  <option value="REMOTE">REMOTE</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-caption text-text-primary uppercase font-bold" htmlFor="signupHireDate">
                Hire Date
              </label>
              <input
                id="signupHireDate"
                type="date"
                required
                value={signupHireDate}
                onChange={(e) => setSignupHireDate(e.target.value)}
                className="border border-border bg-white text-text-primary px-3 py-2.5 rounded-xl focus:outline-none focus:border-accent text-body transition-colors hover:cursor-pointer"
              />
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-between bg-[#0B2A3D] hover:bg-[#13313F] text-white px-6 py-3.5 rounded-full font-sans font-medium text-body transition-colors mt-6 shadow-sm cursor-pointer"
            >
              <span>Create Account</span>
              <span className="flex items-center justify-center w-6 h-6 bg-white rounded-full text-[#0B2A3D] shadow-sm">
                <span className="material-symbols-outlined text-[14px] font-bold">arrow_forward</span>
              </span>
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignup(false);
                setError('');
              }}
              className="font-mono text-caption text-[#0B2A3D] hover:text-accent font-bold transition-colors cursor-pointer"
            >
              Already have an account? Sign In
            </button>
          </div>
        </>
      )}

      <div className="mt-8 pt-6 border-t border-border text-center">
        <span className="text-caption text-text-muted block font-medium">
          Default Simulator Logins:
        </span>
        <div className="mt-2 flex flex-col gap-1 text-caption text-text-primary font-mono bg-slate-50 p-3 rounded-xl border border-border text-left">
          <span>Employee: <button type="button" onClick={() => setEmail('jane.doe@meridian.com')} className="underline hover:text-accent font-bold cursor-pointer">jane.doe@meridian.com</button></span>
          <span>HR Admin: <button type="button" onClick={() => setEmail('vlad.hr@meridian.com')} className="underline hover:text-accent font-bold cursor-pointer">vlad.hr@meridian.com</button></span>
        </div>
      </div>
    </div>
  );

  if (variant === 'split') {
    return (
      <div className="min-h-screen flex flex-col md:flex-row bg-[#F1F0EC] relative">
        {renderSelectors()}
        <div className="w-full md:w-1/2 bg-[#0B2A3D] text-white flex flex-col justify-between p-8 md:p-16 border-b md:border-b-0 md:border-r border-border">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gradient-to-br from-[#2BC4D9] to-[#F2994A] rotate-45 transform rounded-sm shadow-sm" />
            <span className="font-sans font-bold text-xl tracking-tight text-white select-none">
              Meridian
            </span>
          </div>
          <div className="my-12 md:my-0">
            <span className="font-mono text-caption text-accent uppercase tracking-widest font-semibold block mb-3">
              Onboarding Platform
            </span>
            <h1 className="text-display font-bold leading-tight mb-4 text-white">
              Enterprise-Grade AI Engineering.
            </h1>
            <p className="text-body-lg text-text-muted max-w-md">
              Welcome to the Meridian digital integration workspace. Access your personalized onboarding brief, track milestones, and manage hybrid schedules.
            </p>
          </div>
          <div>
            <p className="font-mono text-caption text-text-muted uppercase tracking-widest">
              System status: ONLINE (WCAG AAA)
            </p>
          </div>
        </div>
        <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-8 md:p-16">
          {renderForm()}
        </div>
      </div>
    );
  }

  if (variant === 'centered') {
    return (
      <div className="min-h-screen bg-[#F1F0EC] flex items-center justify-center p-6 relative">
        {renderSelectors()}
        <div className="w-full max-w-[480px] bg-white border border-border rounded-2xl p-8 md:p-12 shadow-sm flex flex-col gap-6">
          <div className="text-center border-b border-border pb-4 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-gradient-to-br from-[#2BC4D9] to-[#F2994A] rotate-45 transform rounded-sm shadow-sm" />
              <span className="font-sans font-bold text-xl tracking-tight">
                <span className="text-[#0B2A3D]">Meri</span>
                <span className="text-accent">dian</span>
              </span>
            </div>
            <p className="text-caption text-text-muted uppercase font-mono tracking-widest font-bold">Onboarding Portal</p>
          </div>
          {renderForm()}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F1F0EC] p-8 md:p-16 relative flex flex-col justify-between">
      {renderSelectors()}
      
      <header className="border-b border-border pb-6 flex justify-between items-baseline">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-gradient-to-br from-[#2BC4D9] to-[#F2994A] rotate-45 transform rounded-sm shadow-sm" />
          <span className="font-sans font-bold text-xl tracking-tight">
            <span className="text-[#0B2A3D]">Meri</span>
            <span className="text-accent">dian</span>
          </span>
        </div>
        <span className="font-mono text-caption text-text-muted uppercase font-bold">Issue 2026.06.30 // Vol I</span>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-12 items-center">
        <div className="lg:col-span-7 flex flex-col gap-6 border-b lg:border-b-0 lg:border-r border-border pb-8 lg:pb-0 lg:pr-12">
          <h1 className="text-[64px] md:text-[96px] font-bold text-[#0B2A3D] leading-none tracking-tight">
            WELCOME.
          </h1>
          <p className="text-body-lg text-[#0B2A3D] font-serif italic max-w-lg leading-relaxed">
            "A thoughtfully structured digital workspace for seamless employee transition, hybrid coordination, and high compliance accountability."
          </p>
        </div>

        <div className="lg:col-span-5 flex justify-center lg:justify-end">
          {renderForm()}
        </div>
      </div>

      <footer className="border-t border-border pt-6 flex flex-col md:flex-row justify-between text-caption text-text-muted font-mono uppercase gap-2 font-bold">
        <span>Meridian Onboarding // Precision Design</span>
        <span>© 2026 Meridian Inc. All rights reserved.</span>
      </footer>
    </div>
  );
};
