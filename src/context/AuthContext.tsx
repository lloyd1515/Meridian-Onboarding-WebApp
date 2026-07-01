import React, { createContext, useContext, useState, useEffect } from 'react';
import { Employee, getEmployees, initializeDb } from '../services/db';
import { signSession, verifySession, freezeSession } from '../services/sessionSecurity';


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

  // Sync session on mount
  useEffect(() => {
    const initSession = async () => {
      await initializeDb();
      const stored = sessionStorage.getItem('meridian_secure_session');
      let sessionLoaded = false;

      if (stored) {
        try {
          const secureSession = JSON.parse(stored);
          const isValid = await verifySession(secureSession);
          if (isValid) {
            const sessionPayload = secureSession.payload;
            const employees = await getEmployees();
            const matchingUser = employees.find(
              emp => emp.email.toLowerCase() === sessionPayload.email.toLowerCase()
            );

            if (matchingUser) {
              const userRole = (matchingUser.id === 'emp-admin' || matchingUser.email.toLowerCase() === 'vlad.hr@meridian.com') 
                ? 'admin' 
                : 'employee';
              setRoleState(userRole);
              setCurrentUser(freezeSession(matchingUser));
              sessionLoaded = true;
            } else {
              console.warn('Session user not found in database. Clearing session...');
              sessionStorage.removeItem('meridian_secure_session');
            }
          }
        } catch (e) {
          console.error('Session verification failed, falling back to default login...', e);
          sessionStorage.removeItem('meridian_secure_session');
        }
      }

    };

    initSession();
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
    const employees = await getEmployees();
    const matchingUser = employees.find(emp => emp.email.toLowerCase() === email.toLowerCase());

    if (matchingUser) {
      setRoleState(newRole);
      setCurrentUser(freezeSession(matchingUser));

      const payload = {
        email: matchingUser.email,
        role: newRole,
        timestamp: Date.now(),
        expiry: Date.now() + 60 * 60 * 1000 // 1 hour
      };

      try {
        const secureSession = await signSession(payload);
        sessionStorage.setItem('meridian_secure_session', JSON.stringify(secureSession));
      } catch (e) {
        console.error('Failed to sign session when changing role:', e);
      }
    } else {
      console.error(`User for role ${newRole} (${email}) not found in database.`);
    }
  };

  const setSimulationDate = (date: string) => {
    setSimulationDateState(date);
  };

  const login = async (email: string): Promise<boolean> => {
    const employees = await getEmployees();
    const matchingUser = employees.find(emp => emp.email.toLowerCase() === email.toLowerCase());

    if (!matchingUser) {
      return false;
    }

    const mappedRole = (matchingUser.id === 'emp-admin' || matchingUser.email.toLowerCase() === 'vlad.hr@meridian.com') 
      ? 'admin' 
      : 'employee';

    setRoleState(mappedRole);
    setCurrentUser(freezeSession(matchingUser));

    const payload = {
      email: matchingUser.email,
      role: mappedRole,
      timestamp: Date.now(),
      expiry: Date.now() + 60 * 60 * 1000 // 1 hour
    };

    try {
      const secureSession = await signSession(payload);
      sessionStorage.setItem('meridian_secure_session', JSON.stringify(secureSession));
    } catch (e) {
      console.error('Failed to sign session during login:', e);
    }

    return true;
  };

  const logout = () => {
    sessionStorage.removeItem('meridian_secure_session');
    setCurrentUser(null);
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
