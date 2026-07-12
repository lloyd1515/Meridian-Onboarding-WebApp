import React, { createContext, useContext, useState, useEffect } from 'react';
import { Employee, customFetch, getCSRFToken, mapEmployeeToFrontend } from '../services/db';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8090';

const credentialsOptions = {
  credentials: 'include' as const
};

interface AuthContextType {
  currentUser: Employee | null;
  role: 'employee' | 'admin';
  isPreboarding: boolean;
  simulationDate: string;
  setRole: (role: 'employee' | 'admin') => void | Promise<void>;
  setSimulationDate: (date: string) => void;
  login: (email: string, password: string, simulatePreboarding?: boolean) => Promise<boolean>;
  logout: () => void;
}

// Today, in the app's YYYY-MM-DD format -- the real clock the server gates
// pre-boarding writes by (see the hire_date checks in checklist.py/scheduler.py).
// Defaulting simulationDate to today instead of a fixed past date keeps the
// UI's "Pre-boarding" badge in sync with server-side enforcement for whichever
// seeded account is actually pre-boarding relative to the real date.
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Seed password used only by the labeled demo controls below (role-switch toggle,
// quick-login buttons) — never used for a real user-submitted login/signup.
const DEMO_SEED_PASSWORD = 'password123';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [role, setRoleState] = useState<'employee' | 'admin'>('employee');
  const [simulationDate, setSimulationDateState] = useState<string>(todayIso);
  const [isPreboarding, setIsPreboarding] = useState<boolean>(true);

  const syncSession = async () => {
    try {
      const res = await customFetch(`${API_URL}/employees/me`, credentialsOptions);
      if (res.ok) {
        const me = await res.json();
        const mappedUser: Employee = mapEmployeeToFrontend(me);
        const mappedRole = me.role === 'hr_admin' ? 'admin' : 'employee';
        setRoleState(mappedRole);
        setCurrentUser(mappedUser);
      } else {
        setCurrentUser(null);
      }
    } catch (e) {
      console.error('Session sync failed:', e);
      setCurrentUser(null);
    }
  };

  useEffect(() => {
    syncSession();
  }, []);

  useEffect(() => {
    if (currentUser) {
      const hireTime = new Date(currentUser.hireDate).getTime();
      const simTime = new Date(simulationDate).getTime();
      setIsPreboarding(simTime < hireTime);
    } else {
      setIsPreboarding(false);
    }
  }, [currentUser, simulationDate]);

  const setRole = async (newRole: 'employee' | 'admin') => {
    const email = newRole === 'admin' ? 'vlad.hr@meridian.com' : 'jane.doe@meridian.com';
    await login(email, DEMO_SEED_PASSWORD);
  };

  const setSimulationDate = (date: string) => {
    setSimulationDateState(date);
  };

  const login = async (email: string, password: string, simulatePreboarding: boolean = false): Promise<boolean> => {
    try {
      const res = await customFetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken()
        },
        body: JSON.stringify({
          email: email,
          password: password
        }),
        ...credentialsOptions
      });

      if (res.ok) {
        const loggedInEmployee = await res.json();
        await syncSession();

        // "Simulate Pre-boarding Mode" checkbox on the login page: move the
        // simulation date to a few days before this account's real hire date
        // so the pre-boarding flows are demoable even for an account whose
        // hire date has already passed. Leaves simulationDate untouched when
        // unchecked, so a manually-set date (top bar) survives a login.
        if (simulatePreboarding && loggedInEmployee?.hire_date) {
          const preboardingDate = new Date(loggedInEmployee.hire_date);
          preboardingDate.setUTCDate(preboardingDate.getUTCDate() - 3);
          setSimulationDateState(preboardingDate.toISOString().slice(0, 10));
        }

        return true;
      }
      return false;
    } catch (e) {
      console.error('Login failed:', e);
      return false;
    }
  };

  const logout = async () => {
    try {
      await customFetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'X-CSRF-Token': getCSRFToken()
        },
        ...credentialsOptions
      });
    } catch (e) {
      console.error('Logout failed:', e);
    } finally {
      setCurrentUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role,
        isPreboarding,
        simulationDate,
        setRole,
        setSimulationDate,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
