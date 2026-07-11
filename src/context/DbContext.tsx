import React, { createContext, useContext, useEffect, useState } from 'react';
import { getEmployees, getScheduler, saveEmployee, saveScheduler, updateEmployee as updateEmployeeApi, Employee, EmployeePatch } from '../services/db';
import { useAuth } from './AuthContext';

interface DbContextType {
  employees: Employee[];
  scheduler: Record<string, string[]>;
  isLoading: boolean;
  refreshData: () => Promise<void>;
  addEmployee: (employee: Employee) => Promise<void>;
  updateEmployee: (id: string, patch: EmployeePatch) => Promise<void>;
  updateScheduler: (scheduler: Record<string, string[]>) => Promise<void>;
}

const DbContext = createContext<DbContextType | undefined>(undefined);

export const DbProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [scheduler, setScheduler] = useState<Record<string, string[]>>({ '0': [], '1': [], '2': [], '3': [], '4': [] });
  const [isLoading, setIsLoading] = useState(true);

  const refreshData = async () => {
    try {
      const emps = await getEmployees();
      const sched = await getScheduler();
      setEmployees(emps);
      setScheduler(sched);
    } catch (err) {
      console.error('Failed to load database values:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Re-fetch whenever the signed-in identity changes -- otherwise switching
  // accounts (including the "Switch to HR Admin/Employee" dev toggle) keeps
  // showing whatever the very first fetch after app load happened to return,
  // which can itself be a role-restricted 403 fallback captured before login
  // finished.
  useEffect(() => {
    refreshData();
  }, [currentUser?.id]);

  const addEmployee = async (employee: Employee) => {
    await saveEmployee(employee);
    await refreshData();
  };

  const updateEmployee = async (id: string, patch: EmployeePatch) => {
    await updateEmployeeApi(id, patch);
    await refreshData();
  };

  const updateScheduler = async (newScheduler: Record<string, string[]>) => {
    await saveScheduler(newScheduler);
    setScheduler(newScheduler);
  };

  return (
    <DbContext.Provider
      value={{
        employees,
        scheduler,
        isLoading,
        refreshData,
        addEmployee,
        updateEmployee,
        updateScheduler,
      }}
    >
      {children}
    </DbContext.Provider>
  );
};

export const useDb = () => {
  const context = useContext(DbContext);
  if (!context) {
    throw new Error('useDb must be used within a DbProvider');
  }
  return context;
};
