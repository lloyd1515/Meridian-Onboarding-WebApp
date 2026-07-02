import React, { createContext, useContext, useState, useEffect } from 'react';
import { Employee } from '../services/db';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function getCSRFToken(): string {
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : '';
}

const credentialsOptions = {
  credentials: 'include' as const
};

interface AuthContextType {
  currentUser: Employee | null;
  role: 'employee' | 'admin';
  isPreboarding: boolean;
  simulationDate: string; // YYYY-MM-DD
  setRole: (role: 'employee' | 'admin') => void | Promise<void>;
  setSimulationDate: (date: string) => void;
  login: (email: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [role, setRoleState] = useState<'employee' | 'admin'>('employee');
  const [simulationDate, setSimulationDateState] = useState<string>('2026-06-25');
  const [isPreboarding, setIsPreboarding] = useState<boolean>(true);

  // Sync session on mount via GET /employees/me
  const syncSession = async () => {
    try {
      const res = await fetch(`${API_URL}/employees/me`, credentialsOptions);
      if (res.ok) {
        const me = await res.json();
        const mappedUser: Employee = {
          id: me.id,
          name: me.name,
          email: me.email,
          slackHandle: me.slack_handle,
          role: me.role === 'hr_admin' ? 'HR Manager' : (me.role === 'buddy' ? 'Senior Software Engineer' : 'Software Specialist'),
          department: me.department,
          hireDate: me.hire_date,
          buddyId: me.buddy_id,
          hybridPreference: me.hybrid_preference || 'HIBRID',
          assignedDesk: me.assigned_desk,
        };
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

  // Sync preboarding status with simulation/hire date
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
    await login(email);
  };

  const setSimulationDate = (date: string) => {
    setSimulationDateState(date);
  };

  const login = async (email: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email,
          password: 'password123'
        }),
        ...credentialsOptions
      });

      if (res.ok) {
        await syncSession();
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
      await fetch(`${API_URL}/auth/logout`, {
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
