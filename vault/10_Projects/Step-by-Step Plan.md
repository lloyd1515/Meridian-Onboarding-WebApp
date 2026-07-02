---
title: Step-by-Step Plan & Feature Debate
tags: [onboarding, frontend, planning, debate]
---

# 📋 Step-by-Step Plan & Feature Debate

This document acts as our collaborative space to review, debate, and track the development of the **Meridian Onboarding App** frontend. Below, we analyze our current features, compare them with the PDF specifications, identify critical gaps, and establish a clear implementation roadmap.

---

## 🔍 Feature-by-Feature Review & Debate

### 5. [[5. Architecture and Deployment|Architecture & Deployment Decisions]]
* **Status**: Decided & documented.
* **The PDF Specification**: *"Recommended Technology Stack: .NET, React / Angular, Python, any database... Authentication is optional... README with clear instructions on how to run..."*
* **Debate**:
    * **SPA Architecture**: React + Vite + TypeScript with localForage (IndexedDB) for local data storage provides zero-dependency setup (no need for Docker/databases locally).
    * **Găzduire statică**: Aplicația este potrivită pentru Cloudflare Pages sau GitHub Pages.
    * **Auth Flow**: Pagina de login va avea butoane de "Quick Login" pentru testare ușoară și o pagină de "Signup/Înregistrare" care salvează profilul utilizatorului direct în IndexedDB.

---

## 📅 Step-by-Step Implementation Roadmap

We will divide the backend development and full-stack integration into the following sequential steps:

### 🟩 Step 1: Initialize Backend Structure & Database Schema
- Create `server/` directory and configure python virtual environment.
- Initialize database models with SQLAlchemy and migrations with Alembic.
- Set up SQLite for local development and Neon connection for production.

### 🟨 Step 2: Implement Authentication & Authorization
- Set up JWT token issuance and verification.
- Implement server-side password hashing with bcrypt.
- Implement role-based access control (RBES) middleware in FastAPI.

### 🟦 Step 3: Implement Core Domain Routes & Logic
- Create endpoints for employee management (CRUD).
- Integrate domain events (e.g. cascade deletes, ghost buddy auditing).
- Implement backend scheduler endpoints for hybrid scheduling.

### 🟪 Step 4: Full-Stack Integration & API Connection
- Replace client-side localForage/IndexedDB with TanStack Query fetching from the backend API.
- Connect React UI to the new FastAPI endpoints.


---

## 💬 Discussion & Review

> [!TIP]
> What are your thoughts on this roadmap? Let's proceed with **Step 1** to align the UI with the Playwright test code and ensure our core workflows are fully verified.
