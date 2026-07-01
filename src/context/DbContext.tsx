import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeDb, getEmployees, getScheduler, saveEmployee, saveScheduler, Employee } from '../services/db';

interface DbContextType {
  employees: Employee[];
  scheduler: Record<string, string[]>;
  isLoading: boolean;
  refreshData: () => Promise<void>;
  addEmployee: (employee: Employee) => Promise<void>;
  updateScheduler: (scheduler: Record<string, string[]>) => Promise<void>;
}

const DbContext = createContext<DbContextType | undefined>(undefined);

export const DbProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  useEffect(() => {
    const init = async () => {
      await initializeDb();
      await refreshData();
    };
    init();
  }, []);

  const addEmployee = async (employee: Employee) => {
    await saveEmployee(employee);
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
