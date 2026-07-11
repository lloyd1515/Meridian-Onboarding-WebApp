import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DbProvider } from './context/DbContext';
import { LayoutShell } from './components/LayoutShell';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/onboarding/DashboardPage';
import { OnboardingChecklist } from './features/onboarding/OnboardingChecklist';
import { CompanyGuidePage } from './features/onboarding/CompanyGuidePage';
import { AskHR } from './features/onboarding/AskHR';
import { BuddyViewPage } from './features/onboarding/BuddyViewPage';
import { EmployeeDirectory } from './features/hr-admin/EmployeeDirectory';
import { HybridScheduler } from './features/hr-admin/HybridScheduler';
import { BackupRestore } from './features/hr-admin/BackupRestore';
import { QuestionsInbox } from './features/hr-admin/QuestionsInbox';
import { ChecklistTemplateEditor } from './features/hr-admin/ChecklistTemplateEditor';

import { ThemeProvider } from './context/ThemeContext';

// Protected Route wrapper that enforces pre-boarding locks
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  requiresAdmin?: boolean;
  restrictedDuringPreboarding?: boolean;
}> = ({
  children,
  requiresAdmin = false,
  restrictedDuringPreboarding = false
}) => {
  const { currentUser, role, isPreboarding } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (requiresAdmin && role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  // Pre-boarding lock: declared per-route (same pattern as requiresAdmin)
  // instead of substring-matching the URL hash.
  if (isPreboarding && restrictedDuringPreboarding) {
    return <Navigate to="/dashboard" replace />;
  }

  return <LayoutShell>{children}</LayoutShell>;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DbProvider>
          <HashRouter>
            <Routes>
              {/* Public Route */}
              <Route path="/login" element={<LoginPage />} />

              {/* Employee Protected Routes */}
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/checklist" 
                element={
                  <ProtectedRoute>
                    <OnboardingChecklist />
                  </ProtectedRoute>
                } 
              />
              <Route
                path="/directory"
                element={
                  <ProtectedRoute restrictedDuringPreboarding>
                    <EmployeeDirectory readOnly />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/guide"
                element={
                  <ProtectedRoute>
                    <CompanyGuidePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ask-hr"
                element={
                  <ProtectedRoute>
                    <AskHR />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/buddy"
                element={
                  <ProtectedRoute restrictedDuringPreboarding>
                    <BuddyViewPage />
                  </ProtectedRoute>
                }
              />

              {/* HR Admin Protected Routes */}
              <Route 
                path="/admin/directory" 
                element={
                  <ProtectedRoute requiresAdmin restrictedDuringPreboarding>
                    <EmployeeDirectory />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/scheduler" 
                element={
                  <ProtectedRoute requiresAdmin restrictedDuringPreboarding>
                    <HybridScheduler />
                  </ProtectedRoute>
                } 
              />
              <Route
                path="/admin/backup"
                element={
                  <ProtectedRoute requiresAdmin restrictedDuringPreboarding>
                    <BackupRestore />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/questions"
                element={
                  <ProtectedRoute requiresAdmin restrictedDuringPreboarding>
                    <QuestionsInbox />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/checklist-templates"
                element={
                  <ProtectedRoute requiresAdmin restrictedDuringPreboarding>
                    <ChecklistTemplateEditor />
                  </ProtectedRoute>
                }
              />

              {/* Fallback Redirection */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </HashRouter>
      </DbProvider>
    </AuthProvider>
    </ThemeProvider>
  );
};
export default App;
