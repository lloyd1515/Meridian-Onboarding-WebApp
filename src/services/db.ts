import localforage from 'localforage';
import { z } from 'zod';

const EMPLOYEES_KEY = 'meridian_employees';
const CHECKLISTS_KEY = 'meridian_checklists';
const SCHEDULER_KEY = 'meridian_scheduler';

// Zod Schemas for Data Integrity Validation
export const EmployeeSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address").endsWith("@meridian.com", "Email must end with @meridian.com"),
  slackHandle: z.string().min(1, "Slack handle is required").startsWith("@", "Slack handle must start with @"),
  role: z.string(),
  department: z.string(),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Hire date must be in YYYY-MM-DD format"),
  buddyId: z.string().nullable().optional(),
  hybridPreference: z.enum(['BIROU', 'REMOTE', 'HIBRID']),
  assignedDesk: z.string().nullable().optional(),
});

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'skipped', 'blocked']),
  skipReason: z.string().nullable().optional(),
  blockedBy: z.string().nullable().optional(),
  dependencies: z.array(z.string()).default([]),
});

export const BackupSchema = z.object({
  version: z.string(),
  employees: z.array(EmployeeSchema),
  checklists: z.record(z.string(), z.array(TaskSchema)), // Record<EmployeeId, Task[]>
  scheduler: z.record(z.string(), z.array(z.string())),  // Record<DayIndex, EmployeeId[]>
});

export type Employee = z.infer<typeof EmployeeSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type BackupData = z.infer<typeof BackupSchema>;

localforage.config({
  name: 'meridian_onboarding_db',
  storeName: 'onboarding_data',
});

const DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'];

// Mock Data Generator
const generateMockEmployees = (): Employee[] => {
  const list: Employee[] = [];
  
  list.push({
    id: 'emp-admin',
    name: 'Vlad HR Admin',
    email: 'vlad.hr@meridian.com',
    slackHandle: '@vlad.hr',
    role: 'HR Manager',
    department: 'HR',
    hireDate: '2022-01-15',
    buddyId: null,
    hybridPreference: 'HIBRID',
    assignedDesk: null,
  });

  list.push({
    id: 'emp-buddy',
    name: 'Alex Johnson (Buddy)',
    email: 'alex.j@meridian.com',
    slackHandle: '@alex.j',
    role: 'Senior Software Engineer',
    department: 'Engineering',
    hireDate: '2023-06-10',
    buddyId: null,
    hybridPreference: 'HIBRID',
    assignedDesk: 'desk-25',
  });

  list.push({
    id: 'emp-newhire',
    name: 'Jane Doe',
    email: 'jane.doe@meridian.com',
    slackHandle: '@jane.doe',
    role: 'Junior Frontend Developer',
    department: 'Engineering',
    hireDate: '2026-07-01', // Future start date for pre-boarding simulation
    buddyId: 'emp-buddy',
    hybridPreference: 'BIROU',
    assignedDesk: 'desk-24',
  });

  // Seed virtual employees for directory virtualization testing
  for (let i = 4; i <= 210; i++) {
    const isBuddy = i % 8 === 0;
    list.push({
      id: `emp-${i}`,
      name: `Employee Name ${i}`,
      email: `user.${i}@meridian.com`,
      slackHandle: `@user.${i}`,
      role: isBuddy ? 'Tech Buddy' : 'Software Specialist',
      department: DEPARTMENTS[i % DEPARTMENTS.length],
      hireDate: `2025-${(i % 12) + 1}-${(i % 28) + 1}`,
      buddyId: isBuddy ? null : `emp-${i - (i % 8)}`,
      hybridPreference: i % 3 === 0 ? 'BIROU' : i % 3 === 1 ? 'REMOTE' : 'HIBRID',
      assignedDesk: null,
    });
  }
  return list;
};

const generateMockTasks = (): Task[] => [
  {
    id: 'task-1',
    title: 'Sign employment contract',
    description: 'Complete electronic signing of your contract and annexes in the portal.',
    status: 'completed',
    dependencies: [],
  },
  {
    id: 'task-2',
    title: 'Configure work laptop',
    description: 'Install operating system, VPN client, and core development tools.',
    status: 'in_progress',
    dependencies: ['task-1'],
  },
  {
    id: 'task-3',
    title: 'First meeting with Buddy',
    description: 'Schedule a 30-minute Zoom or coffee meet to get to know each other.',
    status: 'pending',
    dependencies: ['task-2'],
  },
  {
    id: 'task-4',
    title: 'Install corporate security software',
    description: 'Install the local security agent before accessing the internal network.',
    status: 'blocked',
    blockedBy: 'task-2',
    dependencies: ['task-2', 'task-3'],
  },
  {
    id: 'task-5',
    title: 'Information security training',
    description: 'Complete the mandatory interactive training on the HR platform.',
    status: 'pending',
    dependencies: ['task-1'],
  },
  {
    id: 'task-60-1',
    title: 'Meet the team members',
    description: 'Schedule informal 1-on-1 chats with other engineers in your department.',
    status: 'pending',
    dependencies: [],
  },
  {
    id: 'task-90-1',
    title: 'Submit first Pull Request (PR)',
    description: 'Fix a small bug or implement a minor change in the main codebase.',
    status: 'pending',
    dependencies: ['task-2'],
  },
  {
    id: 'task-90-2',
    title: 'Present a mini-demo',
    description: 'Showcase your completed project during the weekly engineering sync.',
    status: 'pending',
    dependencies: ['task-90-1'],
  },
];

// Database Methods
export const initializeDb = async (forceReset = false): Promise<void> => {
  const existingEmployees = await localforage.getItem(EMPLOYEES_KEY);
  if (!existingEmployees || forceReset) {
    console.log('Seeding initial database...');
    const employees = generateMockEmployees();
    const checklists: Record<string, Task[]> = {};
    
    employees.forEach(emp => {
      checklists[emp.id] = generateMockTasks();
    });

    const scheduler: Record<string, string[]> = {
      '0': ['emp-newhire', 'emp-buddy'],
      '1': ['emp-newhire', 'emp-buddy'],
      '2': ['emp-buddy'],
      '3': ['emp-newhire', 'emp-buddy'],
      '4': [],
    };

    for (let i = 4; i <= 210; i++) {
      const empId = `emp-${i}`;
      const days = ['0', '1', '2', '3', '4'];
      const chosenDays: string[] = [];
      while (chosenDays.length < 3) {
        const randIdx = Math.floor(Math.random() * days.length);
        const day = days[randIdx];
        if (!chosenDays.includes(day)) {
          chosenDays.push(day);
        }
      }
      chosenDays.forEach(day => {
        scheduler[day].push(empId);
      });
    }

    await localforage.setItem(EMPLOYEES_KEY, employees);
    await localforage.setItem(CHECKLISTS_KEY, checklists);
    await localforage.setItem(SCHEDULER_KEY, scheduler);
  }
};

export const getEmployees = async (): Promise<Employee[]> => {
  const data = await localforage.getItem<Employee[]>(EMPLOYEES_KEY);
  return data || [];
};

export const saveEmployee = async (employee: Employee): Promise<void> => {
  const list = await getEmployees();
  const index = list.findIndex(emp => emp.id === employee.id);
  if (index >= 0) {
    list[index] = employee;
  } else {
    list.push(employee);
  }
  await localforage.setItem(EMPLOYEES_KEY, list);
  
  const checklists = await getChecklists();
  if (!checklists[employee.id]) {
    checklists[employee.id] = generateMockTasks();
    await localforage.setItem(CHECKLISTS_KEY, checklists);
  }
};

export const getChecklists = async (): Promise<Record<string, Task[]>> => {
  const data = await localforage.getItem<Record<string, Task[]>>(CHECKLISTS_KEY);
  return data || {};
};

export const getEmployeeChecklist = async (employeeId: string): Promise<Task[]> => {
  const checklists = await getChecklists();
  return checklists[employeeId] || generateMockTasks();
};

export const saveEmployeeChecklist = async (employeeId: string, tasks: Task[]): Promise<void> => {
  const checklists = await getChecklists();
  checklists[employeeId] = tasks;
  await localforage.setItem(CHECKLISTS_KEY, checklists);
};


export const getScheduler = async (): Promise<Record<string, string[]>> => {
  const data = await localforage.getItem<Record<string, string[]>>(SCHEDULER_KEY);
  return data || { '0': [], '1': [], '2': [], '3': [], '4': [] };
};

export const saveScheduler = async (scheduler: Record<string, string[]>): Promise<void> => {
  await localforage.setItem(SCHEDULER_KEY, scheduler);
};

// Import / Export operations with Ghost Buddy Validation
export interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

export const validateAndRestoreBackup = async (jsonString: string): Promise<ValidationResult> => {
  const result: ValidationResult = {
    success: false,
    errors: [],
    warnings: [],
  };

  try {
    const rawData = JSON.parse(jsonString);
    const parsedData = BackupSchema.parse(rawData);
    
    // Ghost Buddy Audits: find employees pointing to a missing buddy ID
    const employeeIds = new Set(parsedData.employees.map(emp => emp.id));
    
    parsedData.employees.forEach(emp => {
      if (emp.buddyId && !employeeIds.has(emp.buddyId)) {
        result.warnings.push(
          `⚠️ Employee [${emp.name}] is associated with a missing Buddy ID ([${emp.buddyId}]). Manual pairing required.`
        );
      }
    });

    await localforage.setItem(EMPLOYEES_KEY, parsedData.employees);
    await localforage.setItem(CHECKLISTS_KEY, parsedData.checklists);
    await localforage.setItem(SCHEDULER_KEY, parsedData.scheduler);
    
    result.success = true;
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      result.errors = err.errors.map(e => `[Field: ${e.path.join('.')}] - ${e.message}`);
    } else {
      result.errors = [err?.message || 'Invalid JSON format or structure'];
    }
  }

  return result;
};

export const generateBackupExport = async (): Promise<string> => {
  const employees = await getEmployees();
  const checklists = await getChecklists();
  const scheduler = await getScheduler();

  const backup: BackupData = {
    version: '2.1',
    employees,
    checklists,
    scheduler,
  };

  return JSON.stringify(backup, null, 2);
};
