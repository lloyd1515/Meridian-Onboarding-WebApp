export interface GuideEntry {
  id: string;
  question: string;
  answer: string;
  /** If omitted, applies to every department. */
  departments?: string[];
}

export interface GuideSection {
  id: string;
  title: string;
  entries: GuideEntry[];
}

export const COMPANY_GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'first-day',
    title: 'First Day Logistics',
    entries: [
      {
        id: 'where-when',
        question: 'Where do I go, and what time?',
        answer:
          "Head to the main Meridian office reception between 9:00 and 9:30 AM. Ask for your buddy or your HR contact by name -- both are shown on your Dashboard once you're logged in. Bring a photo ID for the front desk.",
      },
      {
        id: 'device',
        question: 'What device should I bring on day one?',
        answer:
          "Your own laptop is enough for day one -- you'll pick up your work laptop and set it up as part of the \"Configure work laptop\" checklist task. Charge your phone in advance: you'll need it for the security app 2FA setup.",
      },
      {
        id: 'desk',
        question: 'Do I have an assigned desk?',
        answer:
          'If a desk has been assigned to you, it will show on your Dashboard and Directory profile. If not, ask your buddy -- hot-desking is normal on office days for anyone without a fixed desk yet.',
      },
      {
        id: 'dress-code',
        question: 'What should I wear?',
        answer: 'Smart casual. There is no dress code beyond that, and it is the same every office day, not just day one.',
      },
      {
        id: 'preboarding-access',
        question: 'Can I look around before my start date?',
        answer:
          "Yes -- once HR creates your account you can log in before your hire date, but most of the app (directory, scheduler, admin tools) stays locked until then. Your checklist and this guide are available right away so you can prepare.",
      },
    ],
  },
  {
    id: 'it-setup',
    title: 'IT & Equipment Setup',
    entries: [
      {
        id: 'laptop-setup',
        question: 'What happens during laptop setup?',
        answer:
          'IT images your laptop with the standard OS, VPN client, and core tools before you arrive. On day one you finish setup yourself: connect to the VPN, install the corporate security agent, and set your password. This is tracked as the "Configure work laptop" and "Install corporate security software" tasks on your checklist.',
      },
      {
        id: 'accounts',
        question: 'When do I get my accounts (email, Slack, VPN)?',
        answer:
          'Your Meridian email and Slack account are created before your start date so your buddy can reach you. VPN and internal tool access activate once the security software task is complete -- that is why it is a dependency for later checklist items.',
      },
      {
        id: 'help',
        question: 'Something is broken on my laptop -- who do I ask?',
        answer: 'Message #it-helpdesk on Slack for anything device-related, or ask your buddy to loop in IT directly on your first day.',
      },
    ],
  },
  {
    id: 'comms',
    title: 'Slack & Google Meet',
    entries: [
      {
        id: 'slack-handle',
        question: 'How is Slack used here?',
        answer:
          'Slack is the default channel for day-to-day communication -- direct messages for anything quick, #announcements for company-wide news, and a department channel for your team. Your Dashboard can sync your hybrid schedule to your Slack status automatically.',
      },
      {
        id: 'meet',
        question: 'How do I set up meetings?',
        answer:
          'Google Meet is used for all video calls, from 1:1s to team syncs. Your buddy will usually send the first invite; after that you can generate a link straight from your Dashboard for anything informal, like a coffee chat.',
      },
    ],
  },
  {
    id: 'hybrid-policy',
    title: 'Hybrid Work Policy',
    entries: [
      {
        id: 'schedule',
        question: 'How does the 3/2 hybrid schedule work?',
        answer:
          'Everyone is in the office 3 days a week and remote 2 days, on whichever days suit your team. Use the weekly scheduler on your Dashboard to pick your office days -- it will warn you if the office is near capacity or if your buddy will not be in on the same days as you.',
      },
      {
        id: 'change-schedule',
        question: 'Can I change my office days later?',
        answer: 'Yes, any time, through the same weekly scheduler. Changes take effect immediately, subject to the office capacity limit.',
      },
    ],
  },
  {
    id: 'department-notes',
    title: 'Department Notes',
    entries: [
      {
        id: 'dept-engineering',
        question: 'Engineering: what should I expect in my first month?',
        answer:
          "You'll get read access to the main codebase on day one and push access once the security software task is done. Your first Pull Request (part of your checklist) is meant to be small -- a docs fix or a minor bug is completely normal.",
        departments: ['Engineering'],
      },
      {
        id: 'dept-sales',
        question: 'Sales: what should I expect in my first month?',
        answer:
          'CRM access is granted after your buddy meeting. Shadowing a live client call is part of your checklist -- your manager will pick a call that is a good fit for observing, not one you need to lead.',
        departments: ['Sales'],
      },
      {
        id: 'dept-marketing',
        question: 'Marketing: what should I expect in my first month?',
        answer:
          'You will get access to the shared asset library and campaign calendar in your first week. Your checklist includes drafting a small sample campaign brief -- it is a practice exercise, not a live campaign.',
        departments: ['Marketing'],
      },
      {
        id: 'dept-finance',
        question: 'Finance: what should I expect in my first month?',
        answer:
          'Access to financial systems is granted after your security software task and a short compliance briefing with your manager. The mock month-end reconciliation on your checklist uses last month\'s sample ledger, not live data.',
        departments: ['Finance'],
      },
      {
        id: 'dept-hr',
        question: 'HR: what should I expect in my first month?',
        answer:
          'You will shadow the onboarding of another new hire in your first two weeks -- since HR is a single person today, this is also how you learn the full process end to end before running one yourself.',
        departments: ['HR'],
      },
    ],
  },
];

export function guideSectionsForDepartment(department?: string): GuideSection[] {
  if (!department) return COMPANY_GUIDE_SECTIONS;
  return COMPANY_GUIDE_SECTIONS.map(section => ({
    ...section,
    entries: [...section.entries].sort((a, b) => {
      const aMatches = a.departments?.includes(department) ?? true;
      const bMatches = b.departments?.includes(department) ?? true;
      return aMatches === bMatches ? 0 : aMatches ? -1 : 1;
    }),
  }));
}
