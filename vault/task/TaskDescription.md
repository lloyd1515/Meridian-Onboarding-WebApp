---
title: Task Description
tags: [onboarding, meridian, project-spec]
---

# Meridian Project Onboarding System

## Received Email Context

```text
Hi Vlad!

Congratulations! You have successfully passed the initial screening stage and have been selected as one of the candidates invited to complete the practical exercise for our internship program.

What's next
Please find the full assignment attached.
We kindly ask you to read it carefully before you start, including the section describing the required .md files, which are considered part of the final deliverable just like the source code itself.

Working period: June 26 – July 5, 2026 hour 23:59*

How to submit
At the end of the working period, please complete the form below with the following information:
🔗 [Technical Exercise Submission Form – Internship @Qubiz]

In the form, you will need to provide:
- A link to your public Git repository (GitHub or GitLab)
- A link to your demo video (YouTube Unlisted, Google Drive, or file in repo)

If you have any questions or need clarification regarding the assignment, feel free to contact us at internship@qubiz.com.

Good luck! We look forward to seeing what you build.
```

---

## Assignment Requirements (Extracted from PDF)

### Problem Context
You have just been hired at Meridian, a company of 200 employees working in a hybrid setup.
- Your first day starts in 3 days.
- You don't know anyone.
- You don't know how things work.
- The only email you received from HR says: *"Welcome! See you on Monday."*

As the newest employee, you are the first developer trying to solve this onboarding problem.
Your task is to build a web application that makes the first month at Meridian significantly less chaotic during the onboarding process.
**Build the application you wish you had on your first day at work.**

### What You Know About Meridian
- **Hybrid work model**: 3 days in the office, 2 days remote.
- **Departments**:
  - Engineering
  - Sales
  - Marketing
  - HR
  - Finance
- **Internal communication tools**:
  - Slack
  - Google Meet
- **Hiring rate**: The company hires 2–3 new employees per month.
- **HR**: Consists of a single person.
- **Everything else** about how the company operates is up to you.

---

### Key Requirements

#### Recommended Technology Stack
We recommend using:
- .NET
- React / Angular (TypeScript-based)
- or Python
- Any database of your choice

#### Authentication
Authentication is optional. If you decide to include it, it should make sense in the context of your application.

#### Deployment
Deployment is not required. However, your repository must include a README with clear instructions explaining how to run the application locally.

#### Autonomy and Flexibility
The following decisions are entirely yours:
- Application architecture
- Libraries and frameworks
- Database structure
- Data model
- User workflows
- UI/UX decisions

---

### Required Documentation

Your repository must include the following Markdown files at the root:

1. **`ASSUMPTIONS.md`**
   Describe what assumptions you made and why.
   - *About the users*: Who uses the application? (new employee, HR, managers, colleagues...). What does the user already know when opening the application for the first time?
   - *About the data*: Who enters the information into the application? When is the information added? What happens if information is missing or incorrect?
   - *About the context*: What device does the new employee use on the first day? Do they have access to the application before their first working day?

2. **`DECISIONS.md`**
   Explain what you decided to build, what you intentionally did not build, and why.
   - *Product decisions*: Which features did you include? How did you prioritize them? Which features did you intentionally leave out of scope?
   - *Technical decisions*: Why did you choose this database structure? Why did you choose these libraries/frameworks? If you had more time, what would you build differently?
   - *UX decisions*: Why did you choose this user flow? Did you test it with anyone? What changed after receiving feedback?

3. **`WHAT_I_WOULD_DO_NEXT.md`**
   Imagine you had two additional weeks. What would you build next?
   - *Priority 1*: Features that would fundamentally improve the experience.
   - *Priority 2*: Features that would add significant value.
   - *Priority 3*: Nice-to-have improvements and why they matter.

4. **`REFLECTION.md`** (Optional, but strong differentiator)
   Reflect on your work.
   - What turned out to be harder than you expected?
   - Which decision would you make differently if you started over?
   - What did you learn about yourself as a developer during this project?

---

### Deliverables
- **Source Code**: A public Git repository (GitHub/GitLab). Incremental commits showing work progress.
- **Demo Video**: Max 3-minute walkthrough demonstrating main workflows in English (YouTube Unlisted, Google Drive, or stored in repo). Filename: `Firstname_Lastname`.
